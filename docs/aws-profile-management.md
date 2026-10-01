# AWS Profile Management

This document explains how `switch-profile` manages AWS profiles, SSO logins, migrations and per-terminal switching internally.

## Overview

The profile logic is split across a few modules:

| Module | Role |
|--------|------|
| `src/aws/index.js` | I/O: reads and writes the AWS files, runs the AWS CLI, reads the SSO cache |
| `src/aws/transforms.js` | Pure functions that compute the new content of `~/.aws/config` and `~/.aws/credentials` |
| `src/aws/login.js` | Chooses the `aws sso login` flow (device code or browser) |
| `src/ini.js` | Line-preserving INI helpers used by the transforms |
| `src/migrate.js` | Upgrades what previous versions left behind |
| `src/settings.js` | The tool's own state (`~/.switch-profile/settings.json`) |
| `src/shell.js` | The `sp` shell function for per-terminal switching |

The key design rule: **`switch-profile` never copies credentials for SSO or role profiles.** Switching copies the profile's settings into `[default]`, and AWS tools resolve and refresh credentials themselves. The tool only shells out to the AWS CLI to check that a profile works (`aws configure export-credentials`), to log in (`aws sso login`) and to create SSO profiles (`aws configure sso`).

## File Locations

| Path | Purpose | Managed By |
|------|---------|------------|
| `~/.aws/config` | Profile settings (region, output, SSO and role settings), `[sso-session]` sections | `switch-profile` + `aws configure sso` |
| `~/.aws/credentials` | Access keys of standard profiles | `switch-profile` |
| `~/.aws/sso/cache/` | SSO tokens (JSON files). Read for the status line only | AWS CLI |
| `~/.switch-profile/settings.json` | Tool state (format version, prompts answered, login mode) | `switch-profile` |
| Shell startup file | Managed block defining `sp` | `switch-profile` |

`~/.aws/cli/cache/` is no longer read. See [Configuration Files](configuration-files.md) for every format.

## Functions Reference: `src/aws/index.js`

### Profile Listing

#### `listProfiles()`

Reads `~/.aws/config` and returns every profile section except `[default]` and `[sso-session ...]` sections (via `transforms.listProfiles`).

**Returns:** `[errors, profiles[]]`

Each profile object contains:

```javascript
{
    name: 'sso-dev',                          // Profile name
    friendlyName: 'sso-dev (SSO [role:Admin - account:123456])', // Display name
    region: 'us-east-1',                      // The profile's own region, or null
    output: 'json',                           // Output format, or null
    sso_start_url: 'https://my.awsapps.com/start',  // From the profile or its [sso-session]; null if not SSO
    sso_region: 'us-east-1',                  // From the profile or its [sso-session]; null if not SSO
    sso_account_id: '123456789012',           // null if not SSO
    sso_role_name: 'Admin',                   // null if not SSO
    sso_session: 'my-session',                // null for legacy SSO and non-SSO profiles
    version: '2.0.0',                         // switch_profile_version, or null
    isSso: true,                              // Has a start URL (directly or via sso_session)
    isLegacySso: false                        // SSO without sso_session (no auto-refresh)
}
```

`region` is always the profile's own `region` key. It is never replaced by the SSO region.

#### `getDefaultProfile()`

**Returns:** `[errors, { profile }]`, where `profile` is the name of the profile `switch-profile` last set as default, or `null`. It is read from `switch_profile_name` in `[default]` of `~/.aws/config`, falling back to the 1.x `profile` key in `[default]` of `~/.aws/credentials`.

### Login and Credentials

#### `ensureCredentials(profile, { loginMode, force })`

Makes sure a profile can produce credentials. Nothing is written to disk.

- **Standard and other non-SSO profiles:** returns immediately.
- **SSO profiles:**
  1. Unless `force` is set, runs `aws configure export-credentials --profile <name> --format process`. If it returns credentials, the login is valid and the function returns.
  2. Otherwise runs `ssoLogin(profile.name, loginMode)`.
  3. Runs `export-credentials` again. If it still fails, throws `Logged in, but failed to get credentials for profile <name>`.

**Returns:** `[errors, { expiry_date }]` where `expiry_date` is when the current role credentials expire (informational, SSO only).

`force` is used by **More options** > **Log in again**.

#### `ssoLogin(profile, loginMode)`

Runs `aws sso login --profile <name>` with the flags returned by `login.loginFlags()`. The child process inherits the terminal (`stdio: 'inherit'`), so the user sees the login URL and, in device code mode, the code. The function waits for the command to exit; a non-zero exit code is an error. There is no polling or timeout.

#### `getSsoLoginStatus(ssoUrl)`

Describes the local SSO login for a start URL from `~/.aws/sso/cache/`. Only used for the status line at startup.

1. Reads every `*.json` file with a `startUrl` and an `accessToken`, and keeps those whose `startUrl` host matches the host of `ssoUrl`.
2. If any has a `refreshToken` and its `registrationExpiresAt` has not passed, returns `{ state: 'refreshable' }`.
3. Otherwise takes the latest `expiresAt`: `active` if it is more than 2 minutes away, `expired` otherwise.
4. Returns `{ state: 'none' }` if no token matches.

**Returns:** `[errors, { state, expiresAt }]` (`expiresAt` only for `active` and `expired`).

### Profile Modification

#### `setDefaultProfile(name)`

Reads both AWS files, applies `transforms.setDefaultProfile()` and writes the result:

- `[default]` of `~/.aws/config` gets a copy of the profile's keys plus `switch_profile_name` and `switch_profile_version`.
- `[default]` of `~/.aws/credentials` mirrors the profile's credentials section if it has one (standard profiles), stamped with `switch_profile_version`. Otherwise it is removed, because static keys there would override the SSO settings.

#### `createProfile({ name, aws_access_key_id, aws_secret_access_key, region })`

Creates a standard (non-SSO) profile. All four arguments are required.

**Appends to `~/.aws/config`:**
```ini
[profile my-profile]
region = us-east-1
output = json
switch_profile_version = 2.0.0
```

**Appends to `~/.aws/credentials`:**
```ini
[my-profile]
aws_access_key_id = AKIA...
aws_secret_access_key = ...
switch_profile_version = 2.0.0
```

No `[default]` section is created. Files that do not exist are created with owner-only permissions (`0600`).

#### `createSsoProfile(name)`

Runs the interactive `aws configure sso --profile <name>` with the terminal inherited, so the user answers the AWS CLI prompts directly. A non-zero exit code is reported as an error. Then:

- If the new profile uses the `[sso-session]` format, it is stamped with `switch_profile_version`.
- If the user skipped the SSO session name (legacy format), it is upgraded with `transforms.upgradeLegacySsoProfiles()` so it gets auto-refresh.

**Returns:** `[errors, upgraded]`. When `upgraded` is true, the CLI tells the user they will log in once more.

#### `deleteProfiles(profiles)`

Deletes one or more profiles from both `~/.aws/config` and `~/.aws/credentials`.

**Rules:**
- The `default` profile cannot be deleted.
- Uses regex matching to find and remove the profile section and everything up to the next `[` bracket (`deleteProfileFromConfig` handles `[profile name]` and `[name]`, `deleteProfileFromCreds` handles `[name]`).
- `[sso-session]` sections are not removed.

### File Helpers

| Function | Purpose |
|----------|---------|
| `getConfigFile()` / `getCredsFile()` | Read a file as a string (empty string if missing) |
| `writeAwsFiles({ config, creds })` | Write one or both files; creates `~/.aws` if needed, new files get mode `0600`, an empty content for a missing file is not written |
| `backupAwsFiles()` | Copies both files to `<file>.bak-<UTC timestamp>` and returns the paths |
| `getAwsCliVersion()` | Parses `aws --version` (e.g., `2.33.17`); cached |

### AWS CLI Detection

#### `awsCliV2Exists(noFailIfMissing)`

Checks that AWS CLI v2+ is installed.

1. Runs `which aws` (or `where aws` on Windows) to check if the command exists.
2. Runs `aws --version` and parses the major version number.
3. Rejects if version is 1 or lower.

With `noFailIfMissing`, returns `false` instead of throwing when the AWS CLI is not found.

## Transforms: `src/aws/transforms.js`

Pure functions over file contents, with no I/O, so every rule about what is written can be unit tested.

| Function | Purpose |
|----------|---------|
| `setDefaultProfile(config, creds, name, version)` | Returns `{ config, creds }` with the new `[default]` sections. Throws if the profile does not exist. Drops any previous `switch_profile_*` keys and the 1.x keys. |
| `getDefaultProfileName(config, creds)` | `switch_profile_name` from config `[default]`, else the 1.x `profile` key |
| `hasLegacyDefault(creds)` | True if `[default]` of the credentials has the 1.x `profile` or `expiry_date` keys |
| `getLegacyDefaultProfileName(creds)` | The 1.x `profile` key |
| `stripLegacyDefault(creds)` | Cleans an orphaned 1.x `[default]`: removes it if it holds temporary keys (session token), otherwise removes only the `profile` and `expiry_date` keys |
| `findLegacySsoProfiles(config)` | Names of profiles with `sso_start_url` and no `sso_session` |
| `upgradeLegacySsoProfiles(config, names, version)` | Converts legacy SSO profiles; returns `{ config, sessions }` |
| `sessionNameFromUrl(url)` | `https://acme.awsapps.com/start` -> `acme`; `ssoins-...` IDs are used as is; falls back to the first host label, then `sso` |
| `stampProfile(config, name, version)` | Sets `switch_profile_version` on a profile |
| `configSectionName(config, name)` | `profile <name>` or `<name>`, or `null` |
| `listProfiles(config)` | See `listProfiles()` above |

### Legacy SSO upgrade rules

`upgradeLegacySsoProfiles` converts each listed legacy profile:

1. Profiles with the same start URL (compared without trailing slash, fragment or case) and the same SSO region share one session.
2. An existing `[sso-session]` with the same URL and region is reused.
3. Otherwise a new `[sso-session <name>]` is created with `sso_start_url`, `sso_region`, `sso_registration_scopes = sso:account:access` and `switch_profile_version`. The name comes from `sessionNameFromUrl`; if taken, `-2`, `-3`, ... is appended.
4. In the profile, `sso_start_url` and `sso_region` are removed and `sso_session` and `switch_profile_version` are added. Other keys stay in place.

The AWS CLI keys the SSO token cache by session name, so the user must log in once per session after the upgrade.

## SSO Login Mode: `src/aws/login.js`

Since AWS CLI 2.22.0, `aws sso login` uses the PKCE flow by default, which needs a browser on the same machine. Over SSH it hangs. `--use-device-code` prints a URL and a code to approve from any device. Before 2.22.0, device code was the only flow and the flag did not exist.

| Function | Purpose |
|----------|---------|
| `isRemoteSession(env, platform)` | True if `SSH_CONNECTION`, `SSH_CLIENT` or `SSH_TTY` is set, or on Linux with neither `DISPLAY` nor `WAYLAND_DISPLAY` |
| `resolveLoginMode(mode, { env, platform })` | `device` or `browser`. `auto` resolves to `device` for remote sessions, `browser` otherwise |
| `loginFlags(mode, { env, platform, cliVersion })` | `['--use-device-code']` when the resolved mode is `device` and the CLI is >= 2.22.0, otherwise `[]` |

The mode comes from `loginMode` in `~/.switch-profile/settings.json` (`auto` by default), changed in **More options** > **Settings**.

## Migrations: `src/migrate.js`

Called by `startup()` in `index.js` on every run, before the profile list is shown.

#### `runMigrations()`

1. If `settings.formatVersion` is higher than `settings.FORMAT_VERSION`, throws `NewerFormatError` asking the user to run `npx switch-profile@latest`. The CLI stops.
2. If `[default]` of `~/.aws/credentials` has the 1.x keys (checked on every start, so a later 1.x run is healed too):
   - Backs up both AWS files.
   - If the profile in the 1.x `profile` key exists, rewrites `[default]` with `transforms.setDefaultProfile()`. The 1.x key wins over any 2.x stamp because it is the most recent choice.
   - Otherwise strips the `profile` and `expiry_date` keys.
3. Writes `formatVersion: 2` (plus `migratedFrom: 1` if something was migrated) to the settings file when needed.

**Returns:** `{ migrated, backups, defaultProfile }`. The CLI prints a notice with the backups when `migrated` is true.

#### `findLegacySsoProfiles()` / `upgradeLegacySsoProfiles(names)`

Wrap the transforms with I/O. `upgradeLegacySsoProfiles` backs up the files first, and rewrites `[default]` if the current default profile is one of the upgraded profiles. Returns `{ sessions, backups }`.

## Per-terminal Switching: `src/shell.js`

A child process cannot change its parent shell's environment, so per-terminal switching uses a shell function, `sp`, stored in a managed block in the user's startup file.

| Function | Purpose |
|----------|---------|
| `detectShell()` | From `$SHELL`: zsh, bash or fish and their startup file. On Windows without `$SHELL`, asks `pwsh` and `powershell` for `$PROFILE.CurrentUserAllHosts`. Returns `{ name, files, reload }`, `name` is `null` if unsupported. Cached per process. |
| `getStatus(version)` | `{ supported, installed, active, outdated, installedVersion, shell }`. `active` means `SWITCH_PROFILE_SHELL` is set (launched through `sp`). `outdated` means an installed block's body (markers excluded) differs from what this version would write. |
| `install(version)` / `uninstall()` | Add or replace / remove the block in every startup file of the detected shell |
| `exportProfile(name)` | When launched through `sp`, writes the profile name (and nothing else) to `SWITCH_PROFILE_ENV_FILE`. Returns `false` otherwise. |
| `buildBlock(shell, version)`, `findBlock(content)`, `addBlock(content, block)`, `removeBlock(content)` | Pure helpers for the managed block |

The function itself creates a temp file, runs `switch-profile` (or `npx --yes switch-profile` if not installed globally) with `SWITCH_PROFILE_SHELL` and `SWITCH_PROFILE_ENV_FILE`, then sets `AWS_PROFILE` from the file if it is not empty, deletes it, and returns the CLI's exit code.

## Switch Flow Diagram

```
User selects a profile
            │
            ▼
    ensureCredentials(profile, { loginMode })
            │
            ├── Not SSO → continue
            │
            └── SSO
                    │
                    ▼
            aws configure export-credentials --profile <name>
                    │
                    ├── Success → continue
                    │
                    └── Failure
                            │
                            ▼
                    aws sso login --profile <name> [--use-device-code]
                    (in this terminal: URL / code visible)
                            │
                            ▼
                    aws configure export-credentials (retry)
                            │
                            ├── Success → continue
                            └── Failure → error
            │
            ▼
    setDefaultProfile(name)
    - ~/.aws/config [default]      ← profile settings + stamps
    - ~/.aws/credentials [default] ← mirrored keys (standard) or removed
            │
            ▼
    settings.update({})  (stamps lastWrittenBy)
            │
            ▼
    afterSwitch(name)
    - launched via sp → write name to SWITCH_PROFILE_ENV_FILE
    - otherwise       → export hint (+ sp tips or one-time prompt)
```

## Expiry Handling

`switch-profile` no longer tracks credential expiry. AWS tools refresh role credentials themselves while the SSO login is valid. The only remaining check is in `getSsoLoginStatus()`, which treats a legacy SSO token as expired when it expires within the next 2 minutes.

How long a login lasts depends on the SSO format:
- **`[sso-session]` profiles** get a refresh token. Role credentials are renewed automatically until the IAM Identity Center user interactive session ends (8 hours by default, configurable up to 90 days).
- **Legacy SSO profiles** get a fixed-lifetime token and no refresh token. A new login is needed each time it expires.

## Profile Name Conventions

- In `~/.aws/config`: Non-default profiles use `[profile name]` syntax. The default uses `[default]`. SSO sessions use `[sso-session name]`.
- In `~/.aws/credentials`: All profiles use `[name]` syntax (no `profile` prefix).
- Profile names must be: lowercase alphanumeric characters, dashes, and underscores. Minimum 2 characters.
