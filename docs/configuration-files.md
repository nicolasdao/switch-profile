# Configuration Files

This document describes the exact format of all AWS configuration files that `switch-profile` reads and writes.

## `~/.aws/config`

The AWS CLI configuration file. Stores profile settings including region, output format, and SSO metadata.

### Format

Standard INI-style format. The default profile uses `[default]`, all other profiles use `[profile name]`.

### Example

```ini
[default]
region = us-east-1
output = json

[profile my-standard]
region = ap-southeast-2
output = json

[profile sso-dev]
sso_start_url = https://my-company.awsapps.com/start
sso_region = us-east-1
sso_account_id = 123456789012
sso_role_name = CloudlessAdmin
region = us-east-1
output = json
```

### Fields

**Standard profile fields:**

| Field | Description | Example |
|-------|-------------|---------|
| `region` | AWS region for API calls | `us-east-1` |
| `output` | CLI output format | `json` |

**SSO profile additional fields:**

| Field | Description | Example |
|-------|-------------|---------|
| `sso_start_url` | SSO portal URL | `https://my-company.awsapps.com/start` |
| `sso_region` | Region where SSO is configured | `us-east-1` |
| `sso_account_id` | AWS account ID (12 digits) | `123456789012` |
| `sso_role_name` | IAM role name in the account | `CloudlessAdmin` |

### How `switch-profile` Modifies This File

When setting a profile as default, only the `[default]` section is updated (region and output). Other profile sections are preserved unchanged.

When creating a standard profile, a new `[profile name]` section is appended. When creating an SSO profile, the `aws configure sso` command writes the section.

When deleting a profile, the `[profile name]` section and its contents (up to the next `[` bracket) are removed via regex.

---

## `~/.aws/credentials`

Stores AWS access credentials. All profiles use `[name]` syntax (no `profile` prefix).

### Example

```ini
[default]
aws_access_key_id = ASIAZOCWXABCD123456
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
aws_session_token = AQoDYXdzEJr...
expiry_date = 2021-07-17T11:33:12.000Z
profile = sso-dev

[my-standard]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

### Standard AWS Fields

| Field | Description | Present For |
|-------|-------------|-------------|
| `aws_access_key_id` | AWS access key | All profiles |
| `aws_secret_access_key` | AWS secret key | All profiles |
| `aws_session_token` | Temporary session token | SSO profiles only |

### Custom Fields (added by `switch-profile`)

These fields are written into the `[default]` section only:

| Field | Description | Purpose |
|-------|-------------|---------|
| `profile` | Name of the profile these credentials belong to | Track which profile is currently active |
| `expiry_date` | ISO 8601 timestamp of when credentials expire | Display expiry status, detect expired profiles |

These are non-standard fields. The AWS CLI ignores them, but `switch-profile` reads them back to show profile status.

### How `switch-profile` Modifies This File

When setting a profile as default, the `[default]` section is replaced with the selected profile's credentials plus the custom `profile` and `expiry_date` fields.

When creating a standard profile, a new `[name]` section with access key and secret key is appended.

When deleting a profile, the `[name]` section and its contents are removed via regex.

---

## `~/.aws/sso/cache/` (Read-only)

`switch-profile` reads but does not write to this directory. It is managed entirely by the AWS CLI.

### Purpose

Stores SSO session tokens obtained through the `aws sso login` flow.

### File Format

Files are named with hash-based identifiers (e.g., `bdc1be3a4f0c3b5e8c0e4d6a1b2c3d4e.json`).

```json
{
    "startUrl": "https://my-company.awsapps.com/start",
    "region": "us-east-1",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2021-07-17T11:33:12Z"
}
```

### Fields

| Field | Description |
|-------|-------------|
| `startUrl` | The SSO portal URL this session belongs to |
| `region` | The SSO region |
| `accessToken` | JWT token for the SSO session |
| `expiresAt` | ISO 8601 expiry timestamp |

### How `switch-profile` Uses It

The tool searches all `*.json` files in this directory when it needs to verify or find an SSO session. It matches by comparing the `startUrl` host with the profile's `sso_start_url` host. A session is considered valid if it expires more than 2 minutes from now.

---

## `~/.aws/cli/cache/` (Read-only)

`switch-profile` reads but does not write to this directory. It is managed entirely by the AWS CLI.

### Purpose

Stores temporary AWS credentials (access key, secret key, session token) obtained through SSO authentication.

### File Format

Files are named with hash-based identifiers.

```json
{
    "ProviderType": "sso",
    "Credentials": {
        "AccessKeyId": "ASIAZOCWXABCD123456",
        "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        "SessionToken": "AQoDYXdzEJr...",
        "Expiration": "2021-07-17T11:33:12Z"
    }
}
```

### Fields

| Field | Description |
|-------|-------------|
| `ProviderType` | Credential source type (`"sso"` for SSO) |
| `Credentials.AccessKeyId` | AWS access key ID |
| `Credentials.SecretAccessKey` | AWS secret access key |
| `Credentials.SessionToken` | Temporary session token |
| `Credentials.Expiration` | ISO 8601 expiry timestamp |

### How `switch-profile` Uses It

After running `aws configure list --profile <name>` (which populates this cache), the tool searches for a file where:

1. `ProviderType` is `"sso"`.
2. The last 4 characters of `AccessKeyId` match what `aws configure list` reported.
3. The last 4 characters of `SecretAccessKey` match what `aws configure list` reported.
4. `Expiration` is at least 2 minutes in the future.

This matching-by-suffix approach is necessary because `aws configure list` only shows masked keys (e.g., `****3456`), not the full values.

---

## Default File Contents

When `switch-profile` creates a standard profile and the AWS config files don't exist yet, it initializes them with these defaults:

**`~/.aws/config`:**
```ini
[default]
region = ap-southeast-1
output = json

```

**`~/.aws/credentials`:**
```ini
[default]
aws_access_key_id = 1234_DUMMY
aws_secret_access_key = 4567_DUMMY

```

These are dummy values that serve as placeholders until a real profile is set as default.

---

## INI Parsing Approach

`switch-profile` does not use a dedicated INI parser. Instead, it uses regex-based string operations:

**Reading a section:**
```javascript
// Extract [default] section content (everything until the next [ or end of file)
const section = fileContent.match(/\[default\]((.|\n|\r)*?)(\[|$)/)[0]
```

**Extracting a parameter:**
```javascript
// Match "  paramName = value" with flexible whitespace
const regexp = new RegExp(`\\s*${paramName}\\s*=\\s*`)
const value = params.filter(p => regexp.test(p)).map(p => p.replace(regexp,'').trim())[0]
```

**Replacing a section:**
```javascript
// Replace the [default] section while preserving the opening bracket of the next section
const lastChar = defaultSection.slice(-1)  // Either '[' or end-of-string
updatedContent = fileContent.replace(defaultSection, newSection + lastChar)
```

This approach works for the tool's use case but depends on well-formed config files. It preserves all content outside the targeted section unchanged.
