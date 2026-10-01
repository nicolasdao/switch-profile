---
description: Walkthrough of every command and screen of the CLI.
tags: [cli, ux, commands]
source:
  - src/cli.js
  - src/commands/**
  - src/ui.js
  - src/rank.js
  - src/clipboard.js
---

# CLI Interface

Walkthrough of every command and screen. Mocks are approximate: real output uses colors and, on terminals without Unicode (older Windows consoles), ASCII symbols.

## Invocation

```shell
sp [args]                    # the shortcut: same as switch-profile, and also sets AWS_PROFILE in this terminal
switch-profile [args]        # global install
npx switch-profile [args]    # no install (slower: npx checks the registry each run)
```

Commands are defined in `src/cli.js` (commander). `sp` passes its arguments through unchanged.

| Command | Arguments and options |
|---------|-----------------------|
| *(default)* | `[profile...]` |
| `use` | `<profile>` |
| `status` | (uses the global `--json`) |
| `login` | `[profile]`, `--device`, `--browser` |
| `logout` | `-y, --yes` |
| `add` | `--from-sso [session]`, `--region <region>`, `--prefix <prefix>`, `--prune`, `-y, --yes` |
| `remove` / `rm` | `[profiles...]`, `-y, --yes` |
| `settings` | |
| `switch` | Hidden. 1.x compatibility, same as the default command without arguments. |

Global options, accepted before or after the command: `--json`, `--no-input`, `--debug`, `-v, --version`, `-h, --help`.

### Interactive vs non-interactive

A run is interactive only when stdin and stdout are both TTYs, `CI` is unset (or `false`), and `--no-input` is not passed (`ui.isInteractive`). Non-interactive runs never prompt: anything that would need an answer fails with a hint and exit code 3 (or 2 for a needed login).

| Exit code | Meaning |
|-----------|---------|
| 0 | OK |
| 1 | Unexpected error |
| 2 | Login required |
| 3 | Bad input: unknown or ambiguous profile, missing argument, missing `--yes`, interactive-only command |
| 130 | Cancelled (Ctrl+C or Esc in a prompt) |

With `--json`, results go to stdout as JSON. Errors raised as `CliError` (the expected ones) go to stderr as `{"error", "hint", "code"}`; anything else is printed as text.

### Errors

```
✗ No profile matches "nope".
  List them with: switch-profile status --json
```

Unexpected errors add `Run with --debug for details.`. `--debug` (or `SWITCH_PROFILE_DEBUG=1`, or `DEBUG=switch-profile`) prints the stack trace.

## Startup (every command)

`preflight()` in `src/commands/common.js` runs first (skipped for actions started from the picker, which already ran it):

1. **AWS CLI check.** Missing: `✗ The AWS CLI is not installed.` with an install hint per OS. Version 1: refused.
2. **Migrations** (`src/migrate.js`). A newer storage format stops the CLI with "run the latest version". A 1.x `[default]` is migrated with backups:
   ```
   ●  Upgraded your AWS setup for switch-profile 2.0.0 🎉
      [default] now holds acme-dev's settings instead of copied keys, so credentials refresh on their own.
      Backups: /home/me/.aws/config.bak-2026-10-01T10-12-00Z, /home/me/.aws/credentials.bak-...
   ```
3. **Legacy SSO offer** (interactive only, until declined):
   ```
   ▲  2 profiles use the old SSO format, which never auto-refreshes: sso-dev, sso-prod
   ◆  Upgrade them now? You'll log in once per SSO portal.
   ```
   Declining is remembered (`ssoUpgradeDeclined`); Settings still offers it.
4. **`sp` upkeep.** If the installed block differs from what this version writes, it is rewritten: `Updated the sp shortcut in ~/.zshrc (new terminals pick it up)`.

`--json` suppresses these notices.

## The picker (`switch-profile`, no arguments)

```
┌   switch-profile  2.0.0
│
│  ● acme-prod · Admin · 111111111111 · ap-southeast-2 · PROD · SSO ✓ auto-refresh · logged in 3h ago
│  This terminal uses acme-dev (AWS_PROFILE)
│
▲  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY are set in this terminal and override profiles.
│  Switching clears them from this terminal.
│
◆  Switch to · type a name, account, role or client
│  Search: _
│  ● acme-prod        Admin       111111111111  ap-southeast-2  PROD  (current default)
│  ○ acme-dev         Admin       222222222222  ap-southeast-2
│  ○ globex-readonly  ReadOnly    333333333333  us-east-1       PROD
│  ○ sandbox          access keys               us-west-2
│  ○ + Add profiles
│  ○ ↻ Log in again
│  ○ − Remove profiles
│  ○ ⏻ Log out
│  ○ ⚙ Settings
└
```

### Status header

- **Default profile line**: name · role · account · region · `PROD` badge · login state.
- **Login state** (SSO profiles only, from `~/.aws/sso/cache`): `SSO ✓ auto-refresh` (refresh token present), `SSO ✓ N min left` (legacy token still valid), `SSO login expired`, or `not logged in`. Followed by `logged in Xh ago` when `switch-profile` remembers the last login (`settings.logins`).
- No default yet: `No default profile yet. Pick one below.`
- `This terminal uses X (AWS_PROFILE)` when `AWS_PROFILE` differs from the default.
- A warning when `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` or `AWS_DEFAULT_PROFILE` is set. Through `sp`: "Switching clears them from this terminal." Otherwise: "Unset them, or switch with sp to clear them automatically."

### Rows

- Columns: name, role (hidden under 80 columns), account id, region (hidden under 100 columns), red `PROD` badge.
- Role column for non-SSO profiles: `access keys`, `console sign-in`, `role`, `process`.
- `PROD`: the profile name or account name contains `prod`, `prd`, `production` or `live` as a separate word (`client_prd` yes, `products-dev` no).
- Hint on the focused row: `current default`, or the account name and `used Xh ago`.
- Up to 14 rows are visible (fewer on short terminals); arrows scroll.

### Search and order

- Typing filters with fuzzy matching (`fuzzysort`) across name, account name, account id, role, SSO session (client) and region. Multiple words narrow the results (`acme prod`).
- Without a query: current default first, then frecency (use count × recency weight, from `settings.usage`), then config file order.
- With a query: match quality, with a small frecency bonus.
- The actions at the bottom are also matched by their label (`log` shows Log in again and Log out).

### Actions

| Action | Runs |
|--------|------|
| Add profiles | `add` |
| Log in again | `login` for the default profile |
| Remove profiles | `remove` |
| Log out | `logout` |
| Settings | `settings` |

No profiles at all: `No AWS profiles yet. Let's add your first one ✨` and the `add` menu opens. Non-interactive: exit 3.

## Switching with arguments (`sp acme prod`)

Words are joined into one query (`rank.resolveQuery`):

1. An exact name (case-insensitive) switches directly.
2. Otherwise, if exactly one profile matches the fuzzy search, it switches directly.
3. Otherwise the picker opens with the query pre-filled. Non-interactive: exit 3, with up to five candidates in the hint (`"acme" matches 2 profiles.` / `Be more specific: acme-prod, acme-dev`), or `No profile matches "x".`

Without arguments, non-interactive runs exit 3: `Which profile? Pass its name.`

`use <profile>` skips the fuzzy step: exact name or exit 3.

## The switch

```
◒  Connecting to acme-prod
▲  🔥 Production account. Careful out there.
└  ✓ acme-prod · Admin · 111111111111 · ap-southeast-2
      this terminal now uses it (cleared AWS_ACCESS_KEY_ID) 🎯
```

1. **Identity check.** One `aws sts get-caller-identity --profile <name>` behind a spinner.
2. **Login if it fails**, when the profile (or the `source_profile` of a role profile) can log in:
   - SSO: the [login screen](#the-login-screen).
   - Console sign-in (`login_session`): `aws login --profile <name>` in this terminal (`--remote` over SSH).
   - Other kinds (keys, process, role without an SSO source): `✗ Could not get credentials for X.` with the AWS CLI's last error line.
   - Non-interactive: exit 2, `X needs a login.` / `Run: switch-profile login X`.
   Then the identity check runs again. Still failing: `Logged in, but X still has no access.`
3. **Default.** `[default]` is rewritten with the profile's settings, usage is recorded, and the name is handed to `sp` when launched through it.
4. **Warnings**: account mismatch (`configured for account A but resolved to B`), production account, `AWS_REGION`/`AWS_DEFAULT_REGION` overriding the profile's region.
5. **Outcome.**
   - Through `sp`: `this terminal now uses it`, plus `(cleared …)` listing credential variables that were set.
   - Without `sp`:
     ```
     ◇  ✓ acme-prod · Admin · 111111111111 · ap-southeast-2
        set as the default profile
     │  To use it in this terminal only, run:
     │     export AWS_PROFILE=acme-prod
     ◆  Set up the sp shortcut? It switches this terminal automatically and adds tab-completion (adds a few lines to ~/.zshrc)
     ```
     The offer appears once (`perTerminalPrompted`), only for supported shells. Later runs show a tip instead. When `sp` is installed but not used, the tip says to use it (and how to load it). On Windows the hint shows both `$env:AWS_PROFILE = "x"` (PowerShell) and `set AWS_PROFILE=x` (CMD).

`--json` output: `{"profile", "account", "arn", "region", "default": true, "terminal": <handed to sp>}`.

## The login screen

`src/commands/login-flow.js` runs `aws sso login` with its output piped, parses the URL and code (`parseLoginOutput`), and presents them.

**Device code** (`auto` over SSH, `--device`, or the setting; passes `--use-device-code --no-browser`, AWS CLI 2.22+; on older CLIs device code is the default flow and the screen shows the same code, without the auto-fill URL):

```
◇  Approve the login for acme
│
│  Open  https://device.sso.us-east-1.amazonaws.com/?user_code=WXYZ-ABCD
│  Code  WXYZ-ABCD  📋 copied
│
│  🔒 Only approve if the page shows exactly this code.
│  opened in your browser · q QR code · c copy again · o open browser · ctrl+c cancel
◐  Waiting for approval 0:07
```

- The URL pre-fills the code.
- The code is copied: locally with `pbcopy`, `wl-copy`, `xclip`, `xsel` or `clip` (`📋 copied`); over SSH with OSC 52 to the local terminal (`📋 sent to your clipboard`).
- The browser opens automatically on local machines, never over SSH.
- Keys: `q` QR code of the URL, `c` copy again, `o` or Enter open the browser (local only), Ctrl+C cancel (exit 130).
- The timer spinner leaves stdin free for these keys.

**Browser** (PKCE, local default):

```
◇  Opening your browser to log in to acme…
│  If nothing opens, visit: https://oidc.us-east-1.amazonaws.com/authorize?...
◐  Waiting for approval 0:03
```

If the AWS CLI prints something unparseable, its raw output is shown after 10 seconds.

On success: `🔓 Logged in`, and the time is remembered (`settings.logins`). On failure: `SSO login for acme failed.` with the AWS CLI's error lines; an `invalid_grant` adds a hint about the SSO region.

**Non-interactive**: `Logging in to acme. Approve the request using the URL and code below.` then the AWS CLI's own output, all on stderr, so `--json` stdout stays clean.

## `status`

```
┌   switch-profile  2.0.0
│
│  ● acme-prod · default
│    Admin · 111111111111 · ap-southeast-2 · PROD
│    SSO ✓ auto-refresh · logged in 3h ago
│  This terminal uses acme-dev
│  12 profiles · per-terminal switching on
│
└  All good.
```

When a login is needed, the last line reads `Run sp login to log in again.`

`--json`:

```json
{
  "default": { "name": "acme-prod", "kind": "sso", "account": "111111111111", "role": "Admin", "region": "ap-southeast-2", "sso_session": "acme", "prod": true, "needsLogin": false, "loggedInAt": "2026-10-01T09:00:00.000Z" },
  "terminal": "acme-dev",
  "shortcut": { "installed": true, "active": true, "shell": "zsh" },
  "profiles": [ { "name": "acme-prod", "kind": "sso", "account": "111111111111", "role": "Admin", "region": "ap-southeast-2", "sso_session": "acme", "prod": true } ]
}
```

## `login [profile] [--device|--browser]`

Starts a fresh login now, even if the session is valid.

- Target: the argument, else `AWS_PROFILE`, else the default profile (from the picker: the default profile). None: exit 3.
- SSO profile: the [login screen](#the-login-screen). `--device`/`--browser` override the setting for this run.
- Console sign-in, or a role whose source is SSO/console sign-in: forced login through the same path as a switch.
- Keys or credential process: exit 3, `nothing to log in to`.
- Then one identity check: `└  ✓ acme-dev · Admin · 222222222222 · ap-southeast-2`. `--json`: `{"profile", "account", "arn"}`.

`login` does not change the default profile.

## `logout [--yes]`

```
◆  Log out of every SSO session on this machine?
│  No
```

Runs `aws sso logout`, then `aws logout --all` on AWS CLI 2.32+, and clears `settings.logins`. Over SSH it adds `This machine no longer has AWS access.` Non-interactive without `--yes`: exit 3.

## `add`

Interactive menu (non-interactive without `--from-sso`: exit 3):

```
◆  What would you like to add?
│  ● Accounts from an SSO portal   (recommended: one profile per account and role, in one go)
│  ○ A single SSO profile          (guided by aws configure sso)
│  ○ Console sign-in               (aws login: IAM users and roles, no access keys)
│  ○ Access keys                   (not recommended)
```

The last three ask for a profile name first (lowercase letters, numbers, `-`, `_`, at least 2 characters, not taken).

- **A single SSO profile.** A short guide (session name to reuse per portal, start URL, SSO region), then `aws configure sso --profile <name>` takes over the terminal. If no session name was given, the profile is converted to an `[sso-session]` and you log in once more.
- **Console sign-in.** Pick a default region, then `aws login --profile <name>` (AWS CLI 2.32+). For accounts reached with `aws login` (for example IAM account access manager assignments), without long-lived keys.
- **Access keys.** A warning (keys never expire, stored in plain text), a confirmation (default No), then key id, secret (masked) and region.

Then `Profile x created` and `Switch to x now?`.

### Import from an SSO portal

```
◆  Which SSO portal?
│  ● acme      (https://acme.awsapps.com/start)
│  ○ A new portal…
```

A new portal asks for the start URL, the SSO region (`where IAM Identity Center lives`) and a short name (suggested from the URL). It is saved as an `[sso-session]` right away.

If there is no valid cached token for the session, the login screen runs. Then:

```
◇  Found 14 accounts and 31 roles
◆  Default region for these profiles
│  ap-southeast-2
◆  Name prefix (profiles become <prefix>-<account>-<role>)
│  acme
│  +17 new: acme-prod-workloads-admin, acme-dev-readonly, …
│  14 already set up (kept as they are)
│  −1 no longer available: acme-old-sandbox-admin
◆  Add 17 profiles?
◆  Remove the 1 profile that no longer exists?   (default No)
└  ✓ Added 17 profiles, removed 1 🎉
     Try: sp acme
```

- The region defaults to the region already used by this session's profiles, else the SSO region.
- Removing stale profiles backs up the AWS files first. Only profiles generated by the import (`switch_profile_generated`) can be stale.
- Nothing new and nothing stale: `✓ Everything is already set up (14 profiles)`.

**Non-interactive** (`--from-sso <session>`): the session must exist (exit 3 otherwise, listing known sessions), a valid token must be cached (exit 2, `Run: aws sso login --sso-session acme`), the region defaults to the SSO region and the prefix to the session name, stale profiles are removed only with `--prune`. `--yes` skips the confirmations in a terminal (region and prefix are still asked unless passed). `--json`: `{"added", "existing", "removed", "stale"}`.

## `remove [profiles...] [--yes]`

Without names, a searchable multi-select (the current default is disabled: `current default: switch first`). Then a confirmation (default No). Non-interactive: names and `--yes` are required (exit 3 otherwise). Removing the current default, or an unknown name, exits 3. `[sso-session]` sections are kept.

## `settings`

Interactive only. Loops until **Done**.

```
│  Per-terminal switching  on (~/.zshrc)
│  SSO login               Auto: device code over SSH, browser otherwise (here: browser)
│  Legacy SSO profiles     none
│  ~/.switch-profile/settings.json · format v2 · written by 2.0.0
│
◆  Change something?
│  ● Turn off per-terminal switching
│  ○ Change how SSO logins happen
│  ○ Done
```

Per-terminal switching shows `off`, `on (files)`, `on (files), not loaded here: run source ~/.zshrc`, or `not available for this shell (zsh, bash, fish)` (`… in this shell (use PowerShell)` on Windows).

| Action | Shown when | Effect |
|--------|-----------|--------|
| Turn on per-terminal switching | Shell supported, block absent | Installs the block (`Added sp to ~/.zshrc`; PowerShell also gets the execution policy hint) |
| Turn off per-terminal switching | Block installed | Removes it (`open terminals keep it until closed`) |
| Change how SSO logins happen | Always | `auto`, always device code, always browser |
| Upgrade N legacy SSO profiles | Legacy profiles exist | Converts them (with backups), clears `ssoUpgradeDeclined` |
| Done | Always | `Settings saved.` |

## Visual conventions

| Style | Meaning |
|-------|---------|
| Green `✓` | Success, valid login |
| Yellow `▲` | Warnings: expired login, overriding environment variables, region override |
| Red `✗` / `PROD` | Errors, production accounts |
| Cyan | Profile names in messages, the `sp` command, action icons |
| Dim | Secondary details and hints |

Colors use Node's `util.styleText`. They are off when stdout is not a TTY, with `NO_COLOR`, or with `TERM=dumb`; `FORCE_COLOR` turns them on. Spinners become static lines when stdout is not a TTY or `ACCESSIBLE` is set.
