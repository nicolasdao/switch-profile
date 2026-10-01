---
description: Exact formats of the AWS files, the settings file and the shell block written by switch-profile.
tags: [configuration, aws-config, settings, shell]
source:
  - src/aws/transforms.js
  - src/ini.js
  - src/settings.js
  - src/shell.js
---

# Configuration Files

Exact formats of the files `switch-profile` reads and writes: the AWS files, the SSO token cache, its own settings file, and the block it adds to your shell startup file.

## Writing rules

- `~/.aws/config` and `~/.aws/credentials` are written atomically: temp file (`~/.aws/.<name>.<pid>.tmp`) then rename, so a crash never leaves a half-written file. Existing permissions are kept; new files are `0600`. `~/.aws` is created if needed. Empty content for a missing file is not written.
- Edits are line-based (`src/ini.js`): untouched lines, comments and CRLF line endings are preserved.
- Anything that rewrites many sections at once (migrations, legacy SSO upgrade, import with prune) backs up both files first.

## `~/.aws/config`

INI format. `[default]`, `[profile name]` (`[name]` is tolerated), and `[sso-session name]` for shared SSO settings.

### Example

```ini
[default]
sso_session = acme
sso_account_id = 111111111111
sso_role_name = Admin
region = ap-southeast-2
output = json
switch_profile_account_name = Prod Workloads
switch_profile_name = acme-prod-workloads-admin
switch_profile_version = 2.0.0

[sso-session acme]
sso_start_url = https://acme.awsapps.com/start
sso_region = us-east-1
sso_registration_scopes = sso:account:access
switch_profile_version = 2.0.0

[profile acme-prod-workloads-admin]
sso_session = acme
sso_account_id = 111111111111
sso_role_name = Admin
region = ap-southeast-2
output = json
switch_profile_account_name = Prod Workloads
switch_profile_generated = acme
switch_profile_version = 2.0.0

[profile my-hand-written]
sso_session = acme
sso_account_id = 222222222222
sso_role_name = ReadOnly
region = us-east-1

[profile deploy-role]
role_arn = arn:aws:iam::333333333333:role/Deploy
source_profile = my-hand-written

[profile my-keys]
region = us-west-2
output = json
switch_profile_version = 2.0.0
```

### Profile kinds

`switch-profile` classifies each profile (first match wins):

| Kind | Key that defines it | Notes |
|------|---------------------|-------|
| `sso` | `sso_session` (recommended) or `sso_start_url` (legacy) | Logs in with `aws sso login` |
| `login` | `login_session` | Console sign-in, written by `aws login` (AWS CLI 2.32+) |
| `role` | `role_arn` | Account id read from the ARN; logs in through `source_profile` |
| `process` | `credential_process` | |
| `keys` | none of the above | Keys in `~/.aws/credentials` |

### SSO fields

| Field | Where | Example |
|-------|-------|---------|
| `sso_session` | profile | `acme` |
| `sso_account_id` | profile | `111111111111` |
| `sso_role_name` | profile | `Admin` |
| `sso_start_url` | `[sso-session]` (legacy: profile) | `https://acme.awsapps.com/start` |
| `sso_region` | `[sso-session]` (legacy: profile) | `us-east-1` |
| `sso_registration_scopes` | `[sso-session]` | `sso:account:access` |

A profile with `sso_start_url` and no `sso_session` uses the **legacy SSO format**: a fixed-lifetime token, no refresh token. `switch-profile` offers to upgrade it.

### Keys added by `switch-profile`

The AWS CLI and SDKs ignore unknown keys.

| Key | Where | Purpose |
|-----|-------|---------|
| `switch_profile_name` | `[default]` only | Profile last selected. This is how the tool knows the current default. |
| `switch_profile_version` | Sections it writes | CLI version that last wrote the section, for diagnosis |
| `switch_profile_generated` | Profiles created by the SSO import | Name of the `[sso-session]` they came from. Only these profiles can be pruned. |
| `switch_profile_account_name` | Profiles created by the SSO import | Account name from the portal. Shown in the picker, searchable, and used for `PROD` detection. |

### How `switch-profile` changes this file

| Operation | Change |
|-----------|--------|
| Switch | The body of `[default]` is replaced by a copy of the profile's keys (minus existing `switch_profile_*` keys), then `switch_profile_name` and `switch_profile_version`. Created at the top if missing. No credentials. |
| Import from SSO | New `[profile <prefix>-<account>-<role>]` sections (see the example). New `[sso-session]` when you add a portal. With prune: removes stale generated profiles. |
| Single SSO profile | `aws configure sso` writes the section, then it is stamped (or upgraded to `[sso-session]` if no session name was given). |
| Console sign-in | `[profile <name>]` with `region` and `switch_profile_version`, then `aws login` adds its own settings. |
| Access keys | `[profile <name>]` with `region`, `output = json`, `switch_profile_version`. |
| Remove | The profile section is removed (regex up to the next `[`). `[sso-session]` sections are kept. |
| Legacy SSO upgrade | See [Legacy SSO upgrade](#legacy-sso-upgrade). |

---

## `~/.aws/credentials`

Access keys. Sections are `[name]` (no `profile` prefix).

```ini
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
switch_profile_version = 2.0.0

[my-keys]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
switch_profile_version = 2.0.0
```

| Operation | Change |
|-----------|--------|
| Switch to a profile with a credentials section | `[default]` becomes a copy of it, stamped |
| Switch to any other profile | `[default]` is removed (static keys there would override the settings in `~/.aws/config`) |
| Add access keys | New `[name]` section with the keys and the stamp |
| Remove | The `[name]` section is removed |

### Format used by switch-profile 1.x

```ini
[default]
aws_access_key_id = ASIAZOCWXABCD123456
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
aws_session_token = AQoDYXdzEJr...
expiry_date = 2021-07-17T11:33:12.000Z
profile = sso-dev
```

Version 2 never writes `profile` or `expiry_date`. When it finds them, it migrates `[default]` (see [Migrations and backups](#migrations-and-backups)).

---

## `~/.aws/sso/cache/` (read-only)

Managed by the AWS CLI. Files are named `sha1(<session name>).json` for `[sso-session]` logins, `sha1(<start URL>).json` for legacy ones.

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

`switch-profile` reads it for two things:

| Use | How |
|-----|-----|
| Login state in the picker and `status` | Every file whose `startUrl` host matches: `refreshToken` with a valid registration → `auto-refresh`; else latest `expiresAt` more than 2 minutes away → `N min left`; else `expired`; no match → `not logged in` |
| SSO import | Reads `sha1(<session>).json` directly and uses `accessToken` (must be valid for another minute) for `aws sso list-accounts` and `list-account-roles` |

Whether a profile actually works is decided by `aws sts get-caller-identity` at switch time, not by this cache. `~/.aws/cli/cache/` (read by 1.x) is not used.

---

## `~/.switch-profile/settings.json`

The tool's own state. Created on the first run. Written with a plain (non-atomic) write.

```json
{
  "formatVersion": 2,
  "createdBy": "2.0.0",
  "lastWrittenBy": "2.0.0",
  "updatedAt": "2026-10-01T10:12:00.000Z",
  "migratedFrom": 1,
  "perTerminalPrompted": true,
  "ssoUpgradeDeclined": false,
  "loginMode": "auto",
  "usage": {
    "acme-prod-workloads-admin": { "count": 42, "last": "2026-10-01T10:11:58.000Z" }
  },
  "logins": {
    "acme": "2026-10-01T07:02:13.000Z"
  },
  "awsCli": { "path": "/opt/homebrew/bin/aws", "mtimeMs": 1759300000000, "version": "2.33.17" }
}
```

| Field | Description |
|-------|-------------|
| `formatVersion` | How `switch-profile` stores things in the AWS files. Migrations key off it. |
| `createdBy` / `lastWrittenBy` / `updatedAt` | Stamped on every write |
| `migratedFrom` | `1` when a 1.x `[default]` was migrated |
| `perTerminalPrompted` | The one-time `sp` offer was answered (or Settings was used) |
| `ssoUpgradeDeclined` | The legacy SSO upgrade was declined; not asked at startup again |
| `loginMode` | `auto` (default), `device` or `browser` |
| `usage` | Per profile: switch count and last use. Drives the picker order (frecency) and `used Xh ago`. |
| `logins` | Last successful login per key (`sso_session`, else start URL, else profile name). Shown as `logged in Xh ago`. Cleared by `logout`. |
| `awsCli` | Cached `aws --version`, keyed by the resolved binary path and its mtime. Avoids starting Python (0.5 to 1 s) on every run. |

### Format versions

| Version | Used by | Storage |
|---------|---------|---------|
| 1 | `switch-profile` <= 1.x (no settings file) | Temporary credentials in `[default]` of `~/.aws/credentials`, with `profile` and `expiry_date` keys |
| 2 | `switch-profile` 2.x | `[default]` of `~/.aws/config` holds the profile's settings, stamped with `switch_profile_name` and `switch_profile_version` |

`usage`, `logins`, `awsCli` and the `switch_profile_generated`/`switch_profile_account_name` keys did not change the format version: older 2.x versions ignore them. If `formatVersion` is higher than the running version supports, the tool stops and asks you to run `npx switch-profile@latest`.

---

## Shell startup file (managed block)

When per-terminal switching is on, a block defining `sp` and its tab-completion is added to:

| Shell | File |
|-------|------|
| zsh | `${ZDOTDIR:-~}/.zshrc` |
| bash | `~/.bashrc` on Linux, `~/.bash_profile` on macOS |
| fish | `${XDG_CONFIG_HOME:-~/.config}/fish/config.fish` |
| PowerShell | `$PROFILE.CurrentUserAllHosts`, for each of `pwsh` and `powershell` that is installed |

zsh version (bash is the same function with a `complete -F` completion):

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
		unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_DEFAULT_PROFILE
	fi
	rm -f "$__sp_file"
	return $__sp_status
}
_switch_profile_complete() {
	local -a items
	items=(${(f)"$(sed -n 's/^\[profile \(.*\)\]$/\1/p' "${AWS_CONFIG_FILE:-$HOME/.aws/config}" 2>/dev/null)"})
	if (( CURRENT == 2 )); then
		compadd -- $items status login logout add remove settings use
	elif (( CURRENT == 3 )) && [[ $words[2] == (use|login) ]]; then
		compadd -- $items
	fi
}
if (( $+functions[compdef] )); then
	compdef _switch_profile_complete sp switch-profile
fi
# <<< switch-profile <<<
```

fish and PowerShell get the same behavior in their own syntax (PowerShell: a `$Rest` parameter collecting all arguments, `Remove-Item Env:\…` for the cleared variables, `Register-ArgumentCompleter`).

- **Enabling** appends the block (creating the file and folder if needed).
- **Disabling** removes the block only.
- **Updating:** at every start, if an installed block's body differs from what the running version writes, it is rewritten in place. A version marker change alone does not trigger a rewrite.

Put your own code outside the markers. In zsh, the block must come after `compinit` for completion to register.

---

## Migrations and backups

Backups sit next to the originals with a UTC timestamp and are never deleted by the tool:

```
~/.aws/config.bak-2026-10-01T10-12-00Z
~/.aws/credentials.bak-2026-10-01T10-12-00Z
```

Created before: the 1.x migration, the legacy SSO upgrade, and pruning during an SSO import.

### 1.x `[default]` migration

Runs on every start when `[default]` of `~/.aws/credentials` has the 1.x `profile` or `expiry_date` keys:

- If the profile named by `profile` exists, `[default]` is rewritten in format 2.
- Otherwise `[default]` is removed if it holds temporary keys, or only the 1.x keys are removed if it holds static keys.

Then `formatVersion: 2` and `migratedFrom: 1` are written, and a notice lists the backups.

### Legacy SSO upgrade

Offered once at startup (Settings keeps offering it), and applied automatically to a new SSO profile created without a session name:

- Profiles sharing a start URL and SSO region share one `[sso-session]`.
- An existing matching `[sso-session]` is reused; otherwise one is created, named after the portal (`acme` for `https://acme.awsapps.com/start`), with `-2`, `-3`, … on clashes.
- `sso_start_url` and `sso_region` move out of each profile; `sso_session` and `switch_profile_version` are added.
- `[default]` is rewritten if the current default was upgraded.

Log in once per session afterwards (the token cache is keyed by session name).

---

## INI helpers (`src/ini.js`)

| Function | Purpose |
|----------|---------|
| `listSections(str)` | Section names in order (`default`, `profile dev`, `sso-session acme`) |
| `getEntries(str, name)` / `getSection(str, name)` | Key/value pairs as an array or object |
| `setSection(str, name, entries, { position })` | Replaces a section's body, or creates it at the `top` or `end` |
| `removeSection(str, name)` | Removes a section |
| `setKeys(str, name, changes)` | Sets or deletes (`null`) individual keys in place |

Profile removal still uses the older regex in `src/aws/index.js`.
