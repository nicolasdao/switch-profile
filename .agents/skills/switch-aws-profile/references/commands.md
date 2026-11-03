# Command catalog

Every command of `switch-profile` 2.6.0+, as you call it: `npx --yes switch-profile@latest <command> ... --no-input --json`.

## Contents

- [Global options](#global-options)
- [Switching](#switching)
- [status](#status)
- [login and logout](#login-and-logout)
- [add](#add)
- [portals](#portals)
- [rename and remove](#rename-and-remove)
- [settings](#settings)
- [Every interactive feature and its equivalent](#every-interactive-feature-and-its-equivalent)
- [Files](#files)
- [Environment variables](#environment-variables)

## Global options

Accepted before or after the command.

| Option | Effect |
|---|---|
| `--json` | Result as JSON on stdout. Expected errors as `{"error","hint","code"}` on stderr |
| `--no-input` | Never prompt: fail with a hint instead. Also the case with no terminal or when `CI` is set |
| `--debug` | Print stack traces |
| `-v`, `--version` | Print the version |
| `-h`, `--help` | Print help (also per command) |

Every command first checks the AWS CLI, repairs what switch-profile 1.x left in `[default]` (with backups) and refreshes an outdated `sp` block. A hidden `switch` command, with no arguments, exists for 1.x compatibility: never use it.

## Switching

| Command | Behavior |
|---|---|
| `use <profile>` | Exact name only, else exit 3. Use this in anything scripted |
| `<words...>` | Words joined into one query. An exact name (any case), or a unique fuzzy match across name, account id, account name, role, portal and region, switches. Several matches or none: exit 3, with up to 5 candidates in `hint` |

Output: `{"profile","account","arn","region","default":true,"terminal":false}`.

Steps: runs `aws sts get-caller-identity`. If it fails, exit 2 for a profile that can log in (without a terminal it never logs in by itself). Then rewrites `[default]` in `~/.aws/config` with the profile's settings, never its credentials. For access key profiles, `[default]` of `~/.aws/credentials` mirrors its section; for others it is removed. Records usage for the home screen order.

`--json` hides the warnings a person would see, so do these checks yourself:

- The result's `account` differs from the profile's `account` in `status`: the profile resolves to another account. Tell the user.
- The profile has `"prod": true`: say so.
- `AWS_REGION` or `AWS_DEFAULT_REGION` is set and differs from `region`: it overrides the profile's region.

## status

Reads local state, changes nothing. No login check beyond the token cache.

```json
{
  "default": { "name":"acme-prod", "kind":"sso", "account":"111111111111", "role":"Admin", "region":"ap-southeast-2", "sso_session":"acme", "prod":true, "needsLogin":false, "loggedInAt":"2026-10-01T09:00:00.000Z" },
  "terminal": "acme-dev",
  "shortcut": { "installed":true, "active":false, "shell":"zsh" },
  "profiles": [
    { "name":"acme-prod", "kind":"sso", "account":"111111111111", "accountName":"Prod Workloads", "role":"Admin", "region":"ap-southeast-2", "sso_session":"acme", "prod":true, "legacySso":false, "generated":true, "needsLogin":false }
  ]
}
```

- `default`: `null` when none is set. `terminal`: this process's `AWS_PROFILE`, or `null`.
- `kind`: `sso`, `login` (console sign-in), `role`, `process` or `keys`. A profile with none of the other keys counts as `keys`.
- `generated`: created by an import, so it can become stale.
- `needsLogin`: `true` or `false` for SSO profiles and for role profiles with an SSO source, from the token cache. `null` when the cache cannot tell (keys, process, console sign-in).
- `source_profile`: set on role profiles.

## login and logout

| Command | Behavior |
|---|---|
| `login [profile]` | Fresh login even if the session is valid. Target: the argument, else `AWS_PROFILE`, else the default. None: exit 3. Does not change the default |
| `login --sso-session <portal>` | Logs in to a portal directly, before it has profiles. Not combinable with a profile (exit 3) |
| `--device` | Device code: URL and code on stderr, approve from any device |
| `--browser` | Browser on this machine |
| `logout --yes` | `aws sso logout`, plus `aws logout --all` on AWS CLI 2.32+, and clears the login history. Ends every SSO session on the machine. Without `--yes`: exit 3 |

Output: `{"profile","account","arn"}`, `{"session"}` or `{"loggedOut":true}`. With no flag, `settings.loginMode` decides. A failed login exits 2.

Keys and process profiles, and role profiles whose source is neither: exit 3 (nothing to log in to). Other role profiles log in through their `source_profile`. Console sign-in without a browser here: exit 2, the user runs it in a terminal. A login that works but leaves the profile without access: exit 1, `Logged in, but <profile> still has no access`.

## add

`add` alone is the human menu: without a terminal it exits 3. Pass exactly one of these:

### `add --from-sso <session>`: import or re-sync a portal

| Flag | Effect |
|---|---|
| `--region <r>` | Default region of new profiles. Without it: the SSO region, usually wrong. Always pass it. Exit 3 if it does not look like a region |
| `--prefix <p>` | Name prefix, default the session name. Names are `<prefix>-<account>-<role>`, a clash adds `-2` |
| `--dry-run` | Writes nothing, reports what would change |
| `--only <a,b>` | Adds only these new profiles (names from `--dry-run`, same prefix). An unknown name or an empty list: exit 3 |
| `--prune` | Removes `stale` generated profiles, after backing up the AWS files. It does not protect the default: if the default is stale, switch first, or `status` loses track of it while `[default]` stays in effect |
| `-y`, `--yes` | Skips confirmation in a terminal. No effect without one, which never asks |

Result: `{"added":[names],"existing":[names],"removed":[names],"stale":[names]}`.
Dry run adds: `{"dryRun":true,"session","region","prefix","addedEntries":[{"name","accountId","accountName","roleName"}]}`. Its `added` is what would be added.

Exit 3: unknown session (`hint` lists them). Exit 2: no valid token, log in with `login --sso-session <session>`.

### `add --sso <session> --name <n> --account <id> --role <role> --region <r>`: one SSO profile

All flags required. `--account` is 12 digits. The role is not checked until first use. Result: `{"profile","session","account","role","region"}`.

### `add --console --name <n> --region <r>`: one console sign-in profile

Runs `aws login` (AWS CLI 2.32+), blocking until signed in. A failed sign-in removes the profile: exit 1. No browser on this machine: exit 3, the user runs `npx switch-profile add` in a terminal. Result: `{"profile","region"}`.

## portals

Alias `portal`. A portal is an `[sso-session]` section. Editing one fixes every profile that uses it.

| Command | Effect | Output |
|---|---|---|
| `portals` | Lists all | `{"portals":[{"name","startUrl","region","profiles":[names]}]}` |
| `portals --check` | Adds `detectedRegion`: reads each portal's start page, one HTTPS request each | Same, with `detectedRegion` (`null` if none) |
| `portals <name>` | One portal (exit 3 if unknown) | Same, one entry |
| `portals --check --start-url <url>` | Reads the region of a portal not saved yet. Writes nothing | `{"startUrl","detectedRegion"}` |
| `portals <name> --create --start-url <url> --region <r>` | Saves a new portal. All required. Taken name: exit 3 | `{"name","startUrl","region","profiles":[]}` |
| `portals <name> --region <r>` and/or `--start-url <url>` | Edits a portal, unless `--check` is passed: `--check` never writes | `{"name","startUrl","region","profiles"}` |

Start URLs must be `https://`. Regions must look like one (`ap-southeast-2`, `us-gov-west-1`), and their existence is not checked. A mismatch between `region` and `detectedRegion` is the usual cause of failed logins. Portals are never removed by the CLI: `remove` keeps them.

## rename and remove

| Command | Effect | Output |
|---|---|---|
| `rename <profile> <new-name>` (alias `mv`) | Renames the section in both AWS files, `source_profile` references, the default, and usage history. SSO logins keep working | `{"from","to","default","sources":[names],"processes":[names],"terminal"}` |
| `remove <names...> --yes` (alias `rm`) | Removes profiles from both AWS files. Portals stay | `{"removed":[names]}` |

- `rename`: both names required without a terminal. The new name must be valid and free (exit 3). It cannot reach other terminals, scripts, CI, kubeconfigs or Terraform settings using the old name: tell the user. `processes` lists `credential_process` lines still using `--profile <old>`, which need a manual fix.
- `remove`: unknown names and the current default exit 3 (switch first, then remove). Without `--yes`: exit 3. A role profile whose `source_profile` is removed stops working: check `status` first.

## settings

Without a terminal, or with any flag or `--json`, it never prompts.

| Flag | Effect |
|---|---|
| (none) | Reports the state |
| `--login-mode <auto\|device\|browser>` | How SSO logins happen by default |
| `--shortcut <on\|off>` | Adds or removes the `sp` block in the shell startup file. Unsupported shell: exit 3 |
| `--upgrade-legacy-sso` | Converts every profile with no `[sso-session]`, after backups. Log in once per portal afterwards |

```json
{
  "loginMode": "auto",
  "loginModeHere": "device",
  "shortcut": { "supported":true, "installed":false, "active":false, "outdated":false, "shell":"bash", "files":["/home/me/.bashrc"], "reload":"source ~/.bashrc" },
  "legacySso": [],
  "settingsFile": "/home/me/.switch-profile/settings.json",
  "formatVersion": 2,
  "changed": {}
}
```

`changed` holds what this run changed: `loginMode`, `shortcut {state, files}`, `legacySso {upgraded, sessions, backups}`.

## Every interactive feature and its equivalent

| Feature in a terminal | What you do |
|---|---|
| Home screen: search and switch | `status`, then `use <name>` or `<words...>` |
| Home screen header: default, login state | `status` |
| Warning about overriding variables | Check `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_DEFAULT_PROFILE` are unset (check presence, never print values) |
| Add menu: Accounts from an SSO portal | `portals --create`, `login --sso-session`, `add --from-sso` |
| Add menu: A single SSO profile | `add --sso` |
| Add menu: Console sign-in | `add --console`, or the user's terminal when there is no browser |
| Add menu: Access keys | The user's terminal only |
| Import: pick profiles | `--dry-run`, then `--only` |
| Import: fix a wrong region after a failed login | `portals <name> --check`, `portals <name> --region <r>`, then log in again |
| Login screen: QR code, clipboard | Relay the URL and code |
| Portal page | `portals`, `--check`, `--region`, `--start-url` |
| Error screen: fix, retry | The exit code, stderr, `portals --check`, then run it again |
| Settings page | `settings` flags |
| Offer of the `sp` shortcut after a switch | `settings --shortcut on` |
| Offer of the legacy SSO upgrade at startup | `settings --upgrade-legacy-sso` |

## Files

| Path | What it is |
|---|---|
| `~/.aws/config` | Profiles, `[sso-session]`, `[default]`. Written atomically. The CLI's own keys start with `switch_profile_`; AWS tools ignore them |
| `~/.aws/credentials` | Access keys only. **Never read or print it** |
| `~/.aws/sso/cache/` | SSO tokens, managed by the AWS CLI. **Never read or print it** |
| `~/.aws/config.bak-<timestamp>` | Backups before the 1.x migration, the legacy upgrade and pruning. Never deleted by the tool |
| `~/.switch-profile/settings.json` | Login mode, usage, login history |
| `~/.switch-profile/switch-profile.log` | Every run, AWS CLI call and error. Secrets redacted. Rotates at 1 MB |
| Shell startup file | The `sp` block, between `# >>> switch-profile` markers |

## Environment variables

| Variable | Effect |
|---|---|
| `AWS_PROFILE` | Target of `login` with no argument, and of `status`'s `terminal` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` | Override every profile in the AWS CLI and boto3 |
| `AWS_DEFAULT_PROFILE` | Read before `AWS_PROFILE` by boto3 |
| `AWS_REGION`, `AWS_DEFAULT_REGION` | Override a profile's region. The CLI leaves them alone, and warns only without `--json` |
| `AWS_CONFIG_FILE`, `AWS_SHARED_CREDENTIALS_FILE` | Not followed: the CLI always uses `~/.aws/`, while AWS tools follow them. If one is set, the two disagree: tell the user |
| `SHELL`, `ZDOTDIR`, `XDG_CONFIG_HOME` | Decide which shell and startup file `settings --shortcut` edits |
| `CI` | Set and not `false`: never prompt |
| `SWITCH_PROFILE_DEBUG=1`, `DEBUG=switch-profile` | Same as `--debug` |
| `SWITCH_PROFILE_LOG_FILE` | Moves the log |
| `NO_COLOR`, `FORCE_COLOR`, `TERM=dumb`, `ACCESSIBLE` | Colors and spinners |
