# AWS Profile Management

This document explains how `switch-profile` manages AWS profiles, SSO sessions, and credentials internally.

## Overview

All profile and credential logic lives in `src/aws/index.js`. This module directly reads and writes AWS configuration files using regex-based INI parsing - it does not shell out to `aws configure` for most operations.

## File Locations

| Path | Purpose | Managed By |
|------|---------|------------|
| `~/.aws/config` | Profile settings (region, output, SSO metadata) | `switch-profile` + `aws configure sso` |
| `~/.aws/credentials` | Access keys, secrets, session tokens | `switch-profile` |
| `~/.aws/sso/cache/` | SSO session tokens (JSON files) | AWS CLI |
| `~/.aws/cli/cache/` | Temporary SSO credentials (JSON files) | AWS CLI |

## Constants

```javascript
SSO_GET_CREDS_TIMEOUT = 300000  // 5 minutes to complete SSO login
```

## Functions Reference

### Profile Listing

#### `listProfiles()`

Reads `~/.aws/config` and extracts all profile sections except `[default]`.

**Returns:** `[errors, profiles[]]`

Each profile object contains:

```javascript
{
    name: 'sso-dev',                          // Profile name
    friendlyName: 'sso-dev (SSO [role:Admin - account:123456])', // Display name
    region: 'us-east-1',                      // AWS region
    output: 'json',                           // Output format
    sso_start_url: 'https://my.awsapps.com/start',  // null if not SSO
    sso_region: 'us-east-1',                  // null if not SSO
    sso_account_id: '123456789012',           // null if not SSO
    sso_role_name: 'Admin',                   // null if not SSO
    sso_session: 'my-session'                 // null if not using SSO sessions (legacy SSO format)
}
```

**Parsing logic:**
1. Matches all `[...]` sections in the config file.
2. For each section, extracts the content between it and the next `[` bracket.
3. Splits content by newline and extracts key-value pairs using `getParam()`.
4. Strips `[profile ...]` prefix to get the profile name.
5. For newer SSO profiles using `sso_session`, looks up the `[sso-session name]` section to retrieve `sso_start_url` and `sso_region`.
6. For SSO profiles, uses `sso_region` as the effective region.
7. Builds a `friendlyName` that includes role and account info for SSO profiles.

#### `getDefaultProfile()`

Reads the `[default]` section from `~/.aws/credentials`.

**Returns:** `[errors, profile]`

```javascript
{
    aws_access_key_id: 'AKIA...',
    aws_secret_access_key: '...',
    aws_session_token: '...',    // null for standard profiles
    expiry_date: '2021-07-17...', // null for standard profiles
    profile: 'sso-dev'           // Which profile these creds belong to
}
```

The `profile` and `expiry_date` fields are custom additions by `switch-profile` - they are not standard AWS CLI fields. They are written into the credentials file so the tool can track which profile is currently active and when it expires.

### Credential Retrieval

#### `getCredentials(profile, ssoUrl)`

The main credential retrieval function. Behaves differently for SSO vs. standard profiles.

**For SSO profiles** (when `ssoUrl` is provided):

1. Calls `refreshSsoSession()` to ensure a valid SSO session exists.
2. Calls `getSsoCredentials()` to get temporary AWS credentials via the CLI cache.
3. If credentials fail with "session associated with this profile has expired", forces a session refresh and retries.
4. If `getSsoCredentials()` returns `null` (cache-based lookup failed), falls back to `aws configure export-credentials --profile <name> --format process` which directly outputs credentials as JSON.
5. If both approaches fail, throws an error.

**For standard profiles** (when `ssoUrl` is null):

1. Reads `~/.aws/credentials`.
2. Finds the `[profile-name]` section.
3. Extracts `aws_access_key_id`, `aws_secret_access_key`, and `aws_session_token`.

**Returns:** `[errors, { aws_access_key_id, aws_secret_access_key, aws_session_token, expiry_date }]`

#### `getSsoCredentials(profile)`

Gets SSO credentials by running `aws configure list --profile <profile>`, which triggers the AWS CLI to populate its credential cache.

**Process:**
1. Executes `aws configure list --profile <profile>`.
2. Parses the output to extract the last 4 characters of the access key and secret key (the CLI masks them as `****XXXX`).
3. Calls `getSsoCredsFromCacheFile()` to find the full credentials in the CLI cache.

**Returns:** `[errors, creds]` or `[errors, null]` if credentials not found.

#### `getSsoCredsFromCacheFile(access_key_end, secret_key_end)`

Searches `~/.aws/cli/cache/` for a JSON file containing credentials that match the given key suffixes.

**Matching criteria:**
- `ProviderType` must be `"sso"`.
- `Credentials.Expiration` must be at least 2 minutes in the future.
- Last 4 characters of `AccessKeyId` must match `access_key_end`.
- Last 4 characters of `SecretAccessKey` must match `secret_key_end`.

**Returns:** `[errors, creds]` or `[errors, null]` if no match found.

### SSO Session Management

#### `getSsoSession(ssoUrl)`

Finds a valid SSO session token in `~/.aws/sso/cache/`.

**Process:**
1. Extracts the host from `ssoUrl` (e.g., `my.awsapps.com`).
2. Lists all `*.json` files in `~/.aws/sso/cache/`.
3. For each file, checks if:
   - `startUrl` host matches the SSO URL host.
   - `expiresAt` is at least 2 minutes in the future.
   - `accessToken` is present.

**Returns:** `[errors, session]` or `[errors, null]` if no valid session found.

#### `isSSOexpired(ssoSession)`

Checks if an SSO session will expire within the next 2 minutes.

**Returns:** `boolean`

#### `refreshSsoSession(profile, ssoUrl, options)`

Ensures a valid SSO session exists. If not, triggers a new SSO login.

**Process:**
1. Check for existing valid session via `getSsoSession()`.
2. If expired or `options.force` is true:
   - Runs `aws sso login --profile <profile>` (opens browser).
   - Polls `getSsoSession()` every 2 seconds.
   - Waits up to 5 minutes (`SSO_GET_CREDS_TIMEOUT`) for the session to appear.
3. Returns the session object, or throws a timeout error.

### Profile Modification

#### `updateDefaultProfile({ profile, region, expiry_date, aws_access_key_id, aws_secret_access_key, aws_session_token })`

Updates the `[default]` section in both `~/.aws/credentials` and `~/.aws/config`.

**In `~/.aws/credentials`:**
```ini
[default]
aws_access_key_id = AKIA...
aws_secret_access_key = ...
aws_session_token = ...          # Only for SSO profiles
expiry_date = 2021-07-17T...     # Only for SSO profiles
profile = sso-dev                # Custom field: tracks active profile
```

**In `~/.aws/config`:**
```ini
[default]
region = us-east-1
output = json
```

**Approach:** Uses regex to find the existing `[default]` section and replaces it. If no `[default]` section exists, prepends it. All other profile sections are preserved unchanged.

#### `createProfile({ name, aws_access_key_id, aws_secret_access_key, region })`

Creates a standard (non-SSO) profile.

**Writes to `~/.aws/config`:**
```ini
[profile my-profile]
region = us-east-1
output = json
```

**Writes to `~/.aws/credentials`:**
```ini
[my-profile]
aws_access_key_id = AKIA...
aws_secret_access_key = ...
```

If the config or credentials files don't exist, they are created with a default `[default]` section first.

#### `createSsoProfile(name)`

Creates an SSO profile by spawning the interactive `aws configure sso --profile <name>` command. This hands control to the AWS CLI, which walks the user through the SSO setup (URL, region, account, role).

Uses `spawn` with `stdio: 'inherit'` so the user interacts directly with the AWS CLI process. Checks the exit code of the spawned process and throws an error if it is non-zero, indicating the SSO setup failed.

#### `deleteProfiles(profiles)`

Deletes one or more profiles from both `~/.aws/config` and `~/.aws/credentials`.

**Rules:**
- The `default` profile cannot be deleted.
- Uses regex matching to find and remove the profile section and everything up to the next `[` bracket.

#### `deleteProfileFromConfig(profile, fileContent)` / `deleteProfileFromCreds(profile, fileContent)`

Internal helpers that remove a single profile section from file content using regex. The config version handles both `[profile name]` and `[name]` syntax. The creds version handles `[name]` syntax only.

### AWS CLI Detection

#### `awsCliV2Exists(noFailIfMissing)`

Checks that AWS CLI v2+ is installed.

**Process:**
1. Runs `which aws` (or `where aws` on Windows) to check if the command exists.
2. Runs `aws --version` and parses the major version number.
3. Rejects if version is 1 or lower.

**Parameters:**
- `noFailIfMissing`: If `true`, returns `false` instead of throwing when AWS CLI is not found.

### Utility

#### `getParam(params, paramName)`

Extracts a parameter value from an array of lines in `key = value` format.

```javascript
getParam(['  region = us-east-1', '  output = json'], 'region')
// Returns: 'us-east-1'
```

#### `getCredsFile()` / `getConfigFile()`

Reads the credentials or config file and returns its contents as a string. Returns an empty string if the file doesn't exist.

## SSO Credential Flow Diagram

```
User selects an SSO profile
            │
            ▼
    getCredentials(profile, ssoUrl)
            │
            ▼
    refreshSsoSession(profile, ssoUrl)
            │
            ├── getSsoSession(ssoUrl)
            │       │
            │       ▼
            │   Search ~/.aws/sso/cache/*.json
            │   for matching, non-expired session
            │       │
            │       ├── Found valid session → continue
            │       │
            │       └── Not found or expired
            │               │
            │               ▼
            │       aws sso login --profile <name>
            │       (opens browser for SSO auth)
            │               │
            │               ▼
            │       Poll ~/.aws/sso/cache/ every 2s
            │       (up to 5 min timeout)
            │
            ▼
    getSsoCredentials(profile)
            │
            ▼
    aws configure list --profile <name>
    (populates ~/.aws/cli/cache/)
            │
            ▼
    getSsoCredsFromCacheFile(keyEnd, secretEnd)
            │
            ▼
    Search ~/.aws/cli/cache/*.json
    for matching credentials
            │
            ├── Found → return credentials
            │
            └── Not found (null)
                    │
                    ▼
            Fallback: aws configure export-credentials
                      --profile <name> --format process
            (directly outputs credentials as JSON)
                    │
                    ├── Success → return credentials
                    │
                    └── Failure → throw error
            │
            ▼
    Return { aws_access_key_id,
             aws_secret_access_key,
             aws_session_token,
             expiry_date }
```

## Expiry Handling

The tool uses a 2-minute buffer for expiry checks throughout. A session or credential is considered expired if it expires within the next 2 minutes:

```javascript
const credStillValid = (Date.now() - 2*60*1000) < new Date(expiresAt).getTime()
```

This prevents credentials from expiring between the time they're fetched and the time they're used.

## Profile Name Conventions

- In `~/.aws/config`: Non-default profiles use `[profile name]` syntax. The default uses `[default]`.
- In `~/.aws/credentials`: All profiles use `[name]` syntax (no `profile` prefix).
- Profile names must be: lowercase alphanumeric characters, dashes, and underscores. Minimum 2 characters.
