---
description: Profile kinds, switching, SSO logins, SSO import, migrations and the sp shell function.
tags: [aws, sso, profiles, login, migrations, shell]
source:
  - src/aws/**
  - src/migrate.js
  - src/shell.js
  - src/commands/login-flow.js
---

# AWS Profile Management

How `switch-profile` reads profiles, switches, logs in, imports SSO portals, migrates old setups and switches per terminal.

## Overview

| Module | Role |
|--------|------|
| `src/aws/index.js` | I/O: reads and writes the AWS files, runs the AWS CLI, reads the SSO token cache |
| `src/aws/transforms.js` | Pure functions computing the new content of `~/.aws/config` and `~/.aws/credentials` |
| `src/aws/login.js` | Remote detection, login mode, `aws sso login` flags, login output parser |
| `src/commands/switch.js` | Identity check, login, and the switch itself |
| `src/commands/login-flow.js` | The SSO login screen |
| `src/ini.js` | Line-preserving INI helpers used by the transforms |
| `src/migrate.js` | Upgrades what previous versions left behind |
| `src/settings.js` | The tool's own state |
| `src/shell.js` | The `sp` shell block |

The key rule: **`switch-profile` never copies credentials for SSO, role or console sign-in profiles.** Switching copies the profile's settings into `[default]`, and AWS tools resolve and refresh credentials themselves. The AWS CLI is only called to check an identity, to log in or out, to list SSO accounts and roles, and to create SSO profiles.

## File locations

| Path | Purpose | Written by |
|------|---------|------------|
| `~/.aws/config` | Profiles, `[sso-session]` sections, `[default]` | `switch-profile`, `aws configure sso`, `aws login` |
| `~/.aws/credentials` | Access keys | `switch-profile` |
| `~/.aws/sso/cache/` | SSO tokens. Read for the login state and the import | AWS CLI |
| `~/.switch-profile/settings.json` | Tool state | `switch-profile` |
| Shell startup file | The `sp` block | `switch-profile` |

Every write to `~/.aws/config` and `~/.aws/credentials` is atomic: the content goes to a temp file in `~/.aws`, which is then renamed over the target. Existing permissions are kept; new files are created `0600`. See [Configuration Files](configuration-files.md) for the formats.

## Profiles and kinds

`transforms.listProfiles(config)` returns every section except `[default]` and `[sso-session …]`, resolving `sso_start_url`/`sso_region` from the referenced `[sso-session]`. Each profile has a `kind`, checked in this order:

| Kind | Detected by | Can log in | Picker label |
|------|-------------|-----------|--------------|
| `sso` | `sso_start_url` (directly or via `sso_session`) | `aws sso login` | the role name |
| `login` | `login_session` (console sign-in, `aws login`) | `aws login` | `console sign-in` |
| `role` | `role_arn` | through its `source_profile`, if that is `sso` or `login` | `role` |
| `process` | `credential_process` | no | `process` |
| `keys` | anything else (static keys in `~/.aws/credentials`) | no | `access keys` |

Other fields: `name`, `region` (the profile's own, never the SSO region), `sso_account_id` (parsed from `role_arn` for role profiles), `sso_role_name`, `sso_session`, `accountName` (`switch_profile_account_name`), `generated` (`switch_profile_generated`), `source_profile`, `isSso`, `isLegacySso` (SSO without `sso_session`).

## Switching

`switchTo()` in `src/commands/switch.js`:

1. **`connect()`**: one `aws sts get-caller-identity --profile <name>`. The role name is parsed from the ARN (`AWSReservedSSO_<role>_<hash>` or `user/<name>`).
2. If it fails, the profile that can log in is the profile itself, or the `source_profile` of a role profile. If it is `sso`: `ssoLogin()`. If `login`: `aws login --profile <name>` (`--remote` over SSH, AWS CLI 2.32+). Otherwise the switch fails with the AWS CLI's error. Non-interactive runs exit 2 instead of logging in. After a login the identity check runs once more.
3. **`aws.setDefaultProfile(name)`** applies `transforms.setDefaultProfile()`:
   - `[default]` of `~/.aws/config` gets a copy of the profile's keys (minus `switch_profile_*` keys) plus `switch_profile_name` and `switch_profile_version`. Created at the top if missing.
   - `[default]` of `~/.aws/credentials` mirrors the profile's credentials section if it has one (keys profiles). Otherwise it is removed, because static keys there would override the settings in `~/.aws/config`.
4. `settings.usage[name]` is incremented (`rank.recordUsage`), for the picker order.
5. `shell.exportProfile(name)` writes the name to `SWITCH_PROFILE_ENV_FILE` when launched through `sp`.

Any identity check failure on a loginable profile triggers a login, not only expired tokens.

## SSO login

### Mode (`src/aws/login.js`)

Since AWS CLI 2.22.0, `aws sso login` defaults to PKCE, which needs a browser on the same machine. `--use-device-code` prints a URL and code to approve from any device.

| Function | Purpose |
|----------|---------|
| `isRemoteSession(env, platform)` | `SSH_CONNECTION`, `SSH_CLIENT` or `SSH_TTY` set, or Linux without `DISPLAY` and `WAYLAND_DISPLAY` |
| `resolveLoginMode(mode, ctx)` | `device` or `browser`; `auto` → `device` when remote |
| `loginFlags(mode, ctx)` | `['--use-device-code', '--no-browser']` for device mode on CLI >= 2.22.0, else `[]`. `--no-browser` makes the CLI print the URL that pre-fills the code; `switch-profile` opens the browser itself on local machines. |
| `parseLoginOutput(text)` | `{ url, code, completeUrl }` from what `aws sso login` printed so far |

The mode comes from `--device`/`--browser`, else `settings.loginMode` (`auto` by default). `aws.ssoLoginArgs(target, mode)` builds `sso login --profile <name>` or `sso login --sso-session <name>` plus the flags.

### The login screen (`src/commands/login-flow.js`)

- Interactive: spawns `aws sso login` with stdout and stderr piped. As soon as the output contains the code and pre-filled URL (device) or a URL (browser), it shows them. Device mode copies the code (`clipboard.copy`), opens the browser locally, and listens for `q` (QR code via `uqr`), `c` (copy again), `o`/Enter (open browser, local only) and Ctrl+C (kills the child, `CancelError`). A `timerSpinner` shows the wait. If nothing parseable arrives within 10 seconds, the raw output is printed.
- Non-interactive (`plainLogin`): the AWS CLI's output is passed through on stderr; a failure exits 2.
- Success stores the time in `settings.logins[loginKey]` (`sso_session`, else start URL, else profile name).
- Failure shows the AWS CLI's error lines; `invalid_grant` adds a hint about the SSO region.

### Login state (`aws.getSsoLoginStatus(startUrl)`)

Used by the picker header and `status`. Reads every `~/.aws/sso/cache/*.json` with an `accessToken` whose `startUrl` host matches:

1. A token with a `refreshToken` whose `registrationExpiresAt` has not passed → `refreshable` (`SSO ✓ auto-refresh`).
2. Otherwise the latest `expiresAt`: more than 2 minutes away → `active` (`SSO ✓ N min left`), else `expired`.
3. No matching token → `none` (`not logged in`).

`expired` and `none` set `needsLogin`.

### `login` and `logout` commands

- `login` forces a new session: `ssoLogin()` for SSO profiles; for `login` and `role` profiles, `connect(…, { force:true })` logs in without trying the identity first. Then one identity check.
- `logout` runs `aws.logoutAll()`: `aws sso logout`, then `aws logout --all` on CLI 2.32+ (errors ignored), and clears `settings.logins`.

## Import from an SSO portal

`importFromSso()` in `src/commands/index.js`, with the pure part in `transforms.populateSsoProfiles()`.

1. **Session.** An existing `[sso-session]` (`transforms.listSsoSessions`) or a new one (`transforms.addSsoSession`: `sso_start_url`, `sso_region`, `sso_registration_scopes = sso:account:access`, `switch_profile_version`), written immediately.
2. **Token.** `aws.readSsoToken({ ssoSession })` reads `~/.aws/sso/cache/<sha1(session name)>.json` and returns it if it is valid for at least another minute. Otherwise `ssoLogin({ ssoSession })` (interactive) or exit 2.
3. **Accounts and roles.** `aws sso list-accounts --access-token … --region <sso_region>`, then `aws sso list-account-roles` per account, 6 at a time.
4. **Region and prefix.** Defaults: the region of the session's existing profiles (else the SSO region), and the session name.
5. **Preview.** `populateSsoProfiles(config, { ssoSession, entries, region, prefix, prune:false, version })` returns `{ config, added, existing, stale, removed }`.
6. **Confirm**, then optionally prune (backup first), then write with the final call.

`populateSsoProfiles` rules:

- An account/role pair that already has an SSO profile on the same portal (same `sso_session`, or same start URL for legacy profiles) is `existing`, whatever its name. It is not changed.
- New profiles are named `generatedProfileName(prefix, accountName, accountId, roleName)`: slugs joined with `-`, e.g. `acme-prod-workloads-admin` (account id when there is no account name). A name clash appends `-2`, `-3`, …
- A new profile has `sso_session`, `sso_account_id`, `sso_role_name`, `region`, `output = json`, `switch_profile_account_name` (when known), `switch_profile_generated = <session>` and `switch_profile_version`.
- `stale` lists profiles with `switch_profile_generated = <session>` whose account/role is no longer returned. Hand-written profiles never have that key, so they are never stale. `prune` removes stale profiles.

## Creating single profiles

| Function | What it writes |
|----------|----------------|
| `aws.createSsoProfile(name)` | Runs `aws configure sso --profile <name>` (terminal inherited), then stamps the profile. If no session name was given (legacy format), upgrades it with `transforms.upgradeLegacySsoProfiles()` and returns `true` (one more login needed). |
| Console sign-in (in `add`) | `[profile <name>]` with `region` and `switch_profile_version`, then `aws login --profile <name>`, which adds the login settings. |
| `aws.createProfile({ name, aws_access_key_id, aws_secret_access_key, region })` | `[profile <name>]` (`region`, `output = json`, stamp) in config and `[<name>]` (keys, stamp) in credentials. |

## Removing profiles

`aws.deleteProfiles(names)` removes `[profile <name>]` (or `[<name>]`) from config and `[<name>]` from credentials with a regex that cuts up to the next `[`. `default` cannot be deleted; the command refuses the current default. `[sso-session]` sections are kept.

## AWS CLI version

`aws.getAwsCliVersion()` parses `aws --version`. That starts Python and costs 0.5 to 1 second, so the result is cached in `settings.awsCli` as `{ path, mtimeMs, version }`, keyed by the resolved binary path and its modification time. Upgrading the AWS CLI changes the mtime and invalidates the cache. `awsCliV2Exists()` checks the command exists (`which`/`where`) and that the major version is at least 2.

Version gates: device code flags need 2.22.0 (before that, device code is the CLI's only flow: the login screen still shows the code, but there is no auto-fill URL, so the QR code opens the plain verification page); `aws login` and `aws logout --all` need 2.32.0.

## Migrations (`src/migrate.js`)

Run by `preflight()` before every command.

### `runMigrations()`

1. If `settings.formatVersion` is higher than `FORMAT_VERSION`, throws `NewerFormatError` ("run `npx switch-profile@latest`").
2. If `[default]` of `~/.aws/credentials` has the 1.x `profile` or `expiry_date` keys (checked on every start, so a later 1.x run is healed too):
   - backs up both files;
   - if the 1.x `profile` still exists, rewrites `[default]` with `setDefaultProfile` (the 1.x key wins over a 2.x stamp: it is the most recent choice);
   - otherwise `stripLegacyDefault`: removes `[default]` if it holds a session token, else only the 1.x keys.
3. Writes `formatVersion: 2` (and `migratedFrom: 1` when something changed).

Returns `{ migrated, backups, defaultProfile }`.

### Legacy SSO upgrade

`findLegacySsoProfiles()` / `upgradeLegacySsoProfiles(names)` wrap the transforms with backups, and rewrite `[default]` if the current default was upgraded. `transforms.upgradeLegacySsoProfiles` rules:

1. Profiles with the same start URL (ignoring trailing slash, fragment and case) and SSO region share one session.
2. An existing `[sso-session]` with that URL and region is reused.
3. Otherwise a new one is created, named by `sessionNameFromUrl` (`https://acme.awsapps.com/start` → `acme`, `ssoins-…` ids as is, else the first host label), with `-2`, `-3`, … on clashes.
4. In each profile, `sso_start_url` and `sso_region` are removed, `sso_session` and `switch_profile_version` added.

The AWS CLI keys the token cache by session name, so the user logs in once per session afterwards.

## Per-terminal switching (`src/shell.js`)

A child process cannot change its parent shell's environment, so `sp` is a shell function in a managed block of the startup file.

What `sp` does:

1. Creates a temp file and runs `npx --yes switch-profile@latest` with `SWITCH_PROFILE_SHELL=<shell>` and `SWITCH_PROFILE_ENV_FILE=<temp file>`. It always uses npx, even when `switch-profile` is installed globally, so every run gets the latest release. `SWITCH_PROFILE_DEV_BIN`, when set, replaces the npx call with a local build (see the development guide).
2. If the file is not empty after the run: sets `AWS_PROFILE` to its content and unsets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` and `AWS_DEFAULT_PROFILE` (`CLEARED_VARS`). Credentials in the environment win over `AWS_PROFILE` in the CLI and boto3, and boto3 reads `AWS_DEFAULT_PROFILE` first. Region variables are not cleared; the CLI only warns about them.
3. Deletes the file and returns the CLI's exit code.

Tab-completion (same block):

- Candidates: subcommands (`status login logout add remove settings use`) and profile names at the first position; profile names after `use` and `login` (one), and after `remove`/`rm` (any number).
- Profile names are read with `sed` from `${AWS_CONFIG_FILE:-~/.aws/config}` (`[profile <name>]` lines), so completing never starts Node.
- zsh: `compdef`, only if `compinit` already ran. bash: `complete -F`. fish: `complete -c`. PowerShell: `Register-ArgumentCompleter` on the function's `$Rest` parameter (which collects all arguments).

| Function | Purpose |
|----------|---------|
| `detectShell()` | From `$SHELL`: zsh (`${ZDOTDIR:-~}/.zshrc`), bash (`~/.bash_profile` on macOS, `~/.bashrc` elsewhere), fish (`${XDG_CONFIG_HOME:-~/.config}/fish/config.fish`). On Windows without `$SHELL`, asks `pwsh` and `powershell` for `$PROFILE.CurrentUserAllHosts`. Cached. |
| `getStatus(version)` | `{ supported, installed, active, outdated, installedVersion, shell }`. `active`: launched through `sp`. `outdated`: an installed block's body (markers excluded) differs from this version's. |
| `install(version)` / `uninstall()` | Add or replace / remove the block in every startup file of the shell |
| `exportProfile(name)` | Writes the name to `SWITCH_PROFILE_ENV_FILE` when launched through `sp` |
| `buildBlock`, `findBlock`, `addBlock`, `removeBlock` | Pure block helpers |

## Profile names

- `~/.aws/config`: `[profile name]` (`[name]` tolerated), `[default]`, `[sso-session name]`.
- `~/.aws/credentials`: `[name]`.
- Names entered in `add`: lowercase letters, numbers, `-` and `_`, at least 2 characters. Imported names are slugs of the prefix, account name and role.
