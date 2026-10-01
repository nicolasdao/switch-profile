# Configuration Files

This document describes the exact format of all files that `switch-profile` reads and writes: the AWS configuration files, its own settings file, and the block it adds to your shell startup file.

## `~/.aws/config`

The AWS CLI configuration file. Stores profile settings including region, output format, SSO and role settings.

### Format

Standard INI-style format. The default profile uses `[default]`, all other profiles use `[profile name]` (`[name]` is tolerated). Shared SSO settings live in `[sso-session name]` sections.

### Example

```ini
[default]
sso_session = acme
sso_account_id = 123456789012
sso_role_name = CloudlessAdmin
region = us-east-1
output = json
switch_profile_name = sso-dev
switch_profile_version = 2.0.0

[profile my-standard]
region = ap-southeast-2
output = json
switch_profile_version = 2.0.0

[profile sso-dev]
sso_session = acme
sso_account_id = 123456789012
sso_role_name = CloudlessAdmin
region = us-east-1
output = json

[profile sso-legacy]
sso_start_url = https://other-company.awsapps.com/start
sso_region = eu-west-1
sso_account_id = 210987654321
sso_role_name = ReadOnly
region = eu-west-1

[sso-session acme]
sso_start_url = https://acme.awsapps.com/start
sso_region = us-east-1
sso_registration_scopes = sso:account:access
```

### Fields

**Standard profile fields:**

| Field | Description | Example |
|-------|-------------|---------|
| `region` | AWS region for API calls | `us-east-1` |
| `output` | CLI output format | `json` |

**SSO profile fields:**

| Field | Description | Example |
|-------|-------------|---------|
| `sso_session` | Name of the `[sso-session]` section to use (recommended format, auto-refresh) | `acme` |
| `sso_start_url` | SSO portal URL. Only in legacy SSO profiles; otherwise in `[sso-session]` | `https://acme.awsapps.com/start` |
| `sso_region` | Region where SSO is configured. Only in legacy SSO profiles; otherwise in `[sso-session]` | `us-east-1` |
| `sso_account_id` | AWS account ID (12 digits) | `123456789012` |
| `sso_role_name` | Permission set (role) name in the account | `CloudlessAdmin` |

**`[sso-session name]` fields:** `sso_start_url`, `sso_region`, and `sso_registration_scopes` (`sso:account:access`).

A profile with `sso_start_url` directly inside it and no `sso_session` uses the **legacy SSO format**. Its login token has a fixed lifetime and no refresh token, so you must log in again each time it expires. `switch-profile` offers to upgrade these profiles (see [Legacy SSO upgrade](#legacy-sso-upgrade)).

**Keys added by `switch-profile`:**

| Field | Where | Purpose |
|-------|-------|---------|
| `switch_profile_name` | `[default]` only | Name of the profile last selected. This is how the tool knows the current default profile. |
| `switch_profile_version` | Sections written by the tool | Version of `switch-profile` that last wrote the section, for diagnosis. |

The AWS CLI and SDKs ignore unknown keys. `switch_profile_version` is written on: `[default]`, standard profiles created by the tool, SSO profiles created or upgraded by the tool, and `[sso-session]` sections it creates.

### How `switch-profile` Modifies This File

**Setting a profile as default:** the whole body of `[default]` is replaced with a copy of the selected profile's keys, followed by `switch_profile_name` and `switch_profile_version`. Every key is copied as is (`sso_session`, `sso_account_id`, `sso_role_name`, `region`, `output`, `role_arn`, `source_profile`, `credential_process`, ...), except existing `switch_profile_*` keys. If `[default]` does not exist, it is created at the top of the file. No credentials are written. AWS tools resolve and refresh credentials from these settings themselves.

Examples of `[default]` after switching:

```ini
# SSO profile ([sso-session] format)
[default]
sso_session = acme
sso_account_id = 123456789012
sso_role_name = CloudlessAdmin
region = us-east-1
switch_profile_name = sso-dev
switch_profile_version = 2.0.0
```

```ini
# Standard profile (keys are mirrored in ~/.aws/credentials, see below)
[default]
region = ap-southeast-2
output = json
switch_profile_name = my-standard
switch_profile_version = 2.0.0
```

**Creating a standard profile:** a new `[profile name]` section with `region`, `output = json` and `switch_profile_version` is appended. The tool does not add any `[default]` section.

**Creating an SSO profile:** the `aws configure sso` command writes the section, then `switch-profile` stamps it with `switch_profile_version`. If no SSO session name was given (legacy format), the profile is upgraded to the `[sso-session]` format right away.

**Deleting a profile:** the `[profile name]` section and its contents (up to the next `[` bracket) are removed via regex. `[sso-session]` sections are kept.

All other lines (comments, blank lines, other sections) are preserved exactly. New files are created with owner-only permissions (`0600`).

---

## `~/.aws/credentials`

Stores AWS access credentials for standard profiles. All profiles use `[name]` syntax (no `profile` prefix).

### Example

```ini
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
switch_profile_version = 2.0.0

[my-standard]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
switch_profile_version = 2.0.0
```

### Fields

| Field | Description |
|-------|-------------|
| `aws_access_key_id` | AWS access key |
| `aws_secret_access_key` | AWS secret key |
| `aws_session_token` | Session token, if the profile uses temporary keys |
| `switch_profile_version` | Version of `switch-profile` that last wrote the section |

### How `switch-profile` Modifies This File

**Setting a profile as default:**
- If the selected profile has a section in this file (standard profile), `[default]` is replaced with a copy of it, stamped with `switch_profile_version`.
- Otherwise (SSO, role or other config-only profiles), `[default]` is **removed**. Static keys in `[default]` would take precedence over the SSO settings in `[default]` of `~/.aws/config`.

**Creating a standard profile:** a new `[name]` section with the access key, secret key and `switch_profile_version` is appended.

**Deleting a profile:** the `[name]` section and its contents are removed via regex.

### Format used by switch-profile 1.x

Version 1.x copied temporary credentials into `[default]` and added two custom keys, `profile` (the active profile) and `expiry_date`:

```ini
[default]
aws_access_key_id = ASIAZOCWXABCD123456
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
aws_session_token = AQoDYXdzEJr...
expiry_date = 2021-07-17T11:33:12.000Z
profile = sso-dev
```

Version 2 no longer writes these keys. When it finds them, it migrates `[default]` to the new format (see [Migrations and backups](#migrations-and-backups)).

---

## `~/.aws/sso/cache/` (Read-only)

`switch-profile` reads but does not write to this directory. It is managed entirely by the AWS CLI.

### Purpose

Stores SSO tokens obtained through the `aws sso login` flow. For `[sso-session]` profiles, the token includes a refresh token, which lets AWS tools renew role credentials without a new login until the SSO session ends.

### File Format

Files are named with hash-based identifiers (e.g., `bdc1be3a4f0c3b5e8c0e4d6a1b2c3d4e.json`). The name is derived from the session name for `[sso-session]` profiles, and from the start URL for legacy profiles.

```json
{
    "startUrl": "https://acme.awsapps.com/start",
    "region": "us-east-1",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2026-10-01T11:33:12Z",
    "refreshToken": "Atzr|...",
    "registrationExpiresAt": "2026-12-30T10:00:00Z"
}
```

### Fields

| Field | Description |
|-------|-------------|
| `startUrl` | The SSO portal URL this token belongs to |
| `region` | The SSO region |
| `accessToken` | SSO access token |
| `expiresAt` | ISO 8601 expiry of the access token |
| `refreshToken` | Present for `[sso-session]` logins only |
| `registrationExpiresAt` | Expiry of the client registration that the refresh token depends on |

### How `switch-profile` Uses It

Only for the status line shown at startup. The tool reads every `*.json` file with an `accessToken` whose `startUrl` host matches the default profile's start URL host:

| State | Condition | Displayed |
|-------|-----------|-----------|
| Refreshable | A token has a `refreshToken` and its registration has not expired | `INFO: SSO login active, auto-refresh on` |
| Active | No refresh token, latest `expiresAt` is more than 2 minutes away | `INFO: SSO login expires in N minutes (no auto-refresh)` |
| Expired | No refresh token, latest `expiresAt` is within 2 minutes or past | `WARNING: SSO login expired` |
| None | No matching token | `WARNING: Not logged in` |

Whether a profile actually works is checked with `aws configure export-credentials` when you switch, not with this cache.

---

## `~/.aws/cli/cache/` (Not used)

The AWS CLI caches role credentials here. `switch-profile` 1.x read this directory to find credentials to copy into `[default]`. Version 2 no longer reads it.

---

## `~/.switch-profile/settings.json`

The tool's own state. Created on the first run.

### Example

```json
{
  "formatVersion": 2,
  "createdBy": "2.0.0",
  "lastWrittenBy": "2.0.0",
  "updatedAt": "2026-10-01T10:12:00.000Z",
  "migratedFrom": 1,
  "perTerminalPrompted": true,
  "ssoUpgradeDeclined": false,
  "loginMode": "auto"
}
```

### Fields

| Field | Description |
|-------|-------------|
| `formatVersion` | How `switch-profile` stores things in the AWS files (see below). Migrations key off it. |
| `createdBy` | Version of `switch-profile` that created the file |
| `lastWrittenBy` | Version that last wrote the file |
| `updatedAt` | ISO 8601 timestamp of the last write |
| `migratedFrom` | Set to `1` when a 1.x `[default]` was migrated |
| `perTerminalPrompted` | `true` once the user answered the "Enable per-terminal switching?" prompt (or changed it in Settings), so it is not asked again |
| `ssoUpgradeDeclined` | `true` if the user declined the legacy SSO upgrade, so it is not asked at every start |
| `loginMode` | SSO login mode: `auto` (default), `device` or `browser` |

Every write stamps `lastWrittenBy` and `updatedAt`.

### Format versions

| Version | Used by | Storage |
|---------|---------|---------|
| 1 | `switch-profile` <= 1.x (no settings file) | Temporary credentials copied into `[default]` of `~/.aws/credentials`, with custom `profile` and `expiry_date` keys |
| 2 | `switch-profile` 2.x | `[default]` of `~/.aws/config` holds the selected profile's settings, stamped with `switch_profile_name` and `switch_profile_version` |

If `formatVersion` is higher than the running version supports (the files were managed by a newer `switch-profile`), the tool stops and asks you to run `npx switch-profile@latest`. The history is also documented in `src/settings.js`.

---

## Shell startup file (managed block)

When per-terminal switching is enabled, `switch-profile` adds a block defining the `sp` function to your shell startup file:

| Shell | File |
|-------|------|
| zsh | `${ZDOTDIR:-~}/.zshrc` |
| bash | `~/.bashrc` on Linux, `~/.bash_profile` on macOS |
| fish | `$XDG_CONFIG_HOME/fish/config.fish` (default `~/.config/fish/config.fish`) |
| PowerShell | `$PROFILE.CurrentUserAllHosts`, for each of `pwsh` and `powershell` that is installed |

The block is delimited by markers that include the version that wrote it:

```sh
# >>> switch-profile v2.0.0 (managed by switch-profile, do not edit) >>>
sp() {
	local __sp_file __sp_status
	__sp_file="$(mktemp "${TMPDIR:-/tmp}/switch-profile.XXXXXX")" || return 1
	if command -v switch-profile >/dev/null 2>&1; then
		SWITCH_PROFILE_SHELL=zsh SWITCH_PROFILE_ENV_FILE="$__sp_file" switch-profile "$@"
	else
		SWITCH_PROFILE_SHELL=zsh SWITCH_PROFILE_ENV_FILE="$__sp_file" npx --yes switch-profile "$@"
	fi
	__sp_status=$?
	if [ -s "$__sp_file" ]; then
		export AWS_PROFILE="$(cat "$__sp_file")"
	fi
	rm -f "$__sp_file"
	return $__sp_status
}
# <<< switch-profile <<<
```

fish and PowerShell get an equivalent function in their own syntax.

- **Enabling** appends the block at the end of the file (creating the file and its folder if needed). Everything else in the file is untouched.
- **Disabling** removes the block only.
- **Updating:** at every start, if the installed block's body differs from the one the running version would write, it is rewritten in place and a notice is printed. A change in the version marker alone does not trigger a rewrite.

Do not edit the content between the markers; put your own code outside the block.

---

## Migrations and backups

Before any migration changes the AWS files, `~/.aws/config` and `~/.aws/credentials` are copied next to themselves with a UTC timestamp suffix, for example:

```
~/.aws/config.bak-2026-10-01T10-12-00Z
~/.aws/credentials.bak-2026-10-01T10-12-00Z
```

Backups are never deleted by the tool.

### 1.x `[default]` migration

Runs on every start, silently, when `[default]` of `~/.aws/credentials` contains the 1.x `profile` or `expiry_date` keys (also after 1.x was run again following an upgrade):
- If the profile named by the 1.x `profile` key still exists, `[default]` is rewritten in the format 2 (as if you had switched to it).
- Otherwise (the profile no longer exists), `[default]` is removed if it holds temporary keys (they expired long ago); static keys are kept and only the `profile` and `expiry_date` keys are removed.

`settings.json` is then set to `formatVersion: 2` and `migratedFrom: 1`, and a notice lists the backups.

### Legacy SSO upgrade

Asked once at startup when some profiles use the legacy SSO format (declining is remembered in `ssoUpgradeDeclined`; Settings still offers it). It also runs automatically for a new SSO profile created without a session name. The upgrade:
- Groups profiles by start URL and SSO region. Each group shares one `[sso-session]`.
- Reuses an existing `[sso-session]` with the same start URL and region. Otherwise creates one named after the portal subdomain (`acme` for `https://acme.awsapps.com/start`), with `-2`, `-3`, ... appended on name clashes.
- Moves `sso_start_url` and `sso_region` out of each profile, adds `sso_session` and `switch_profile_version`.
- Rewrites `[default]` if the current default profile was upgraded.

After the upgrade, log in once per session (the token cache is keyed by session name).

---

## INI Parsing Approach

`switch-profile` uses a small line-based INI helper (`src/ini.js`) rather than a parse/re-serialize round trip. Every function takes the file content as a string and returns a new string, and lines it does not touch (comments, blank lines, other sections) are kept exactly as they were:

| Function | Purpose |
|----------|---------|
| `listSections(str)` | Section names in order (e.g., `default`, `profile dev`, `sso-session acme`) |
| `getEntries(str, name)` / `getSection(str, name)` | Key/value pairs of a section, as an array or an object |
| `setSection(str, name, entries, { position })` | Replaces a section's body, or creates it at the `top` or `end` |
| `removeSection(str, name)` | Removes a section |
| `setKeys(str, name, changes)` | Sets or deletes individual keys in place (`null` deletes) |

CRLF line endings are preserved. Profile deletion still uses the older regex approach in `src/aws/index.js`.
