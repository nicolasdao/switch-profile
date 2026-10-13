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
npx switch-profile [args]    # recommended: always the latest release, nothing to install or update
sp [args]                    # the shortcut: runs npx switch-profile@latest and sets AWS_PROFILE in this terminal
switch-profile [args]        # optional global install (sp ignores it)
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
| `rename` / `mv` | `[profile]`, `[new-name]` |
| `remove` / `rm` | `[profiles...]`, `-y, --yes` |
| `portals` / `portal` | `[name]`, `--region <region>`, `--start-url <url>`, `--check` |
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

Errors with exit code 1 (and anything unexpected) add a pointer to the log:

```
✗ aws configure sso failed: Invalid start url provided
  The SSO region is most likely wrong: it must be the region where IAM Identity Center lives …
  Details: ~/.switch-profile/switch-profile.log
```

Exit codes 2 and 3 come with their own fix in the hint and skip that line; they are logged too. On the home screen, expected errors open the [error screen](#the-error-screen) instead of ending the run. Every run, AWS CLI call and error is recorded in the log (see [Configuration Files](configuration-files.md#switch-profileswitch-profilelog)). `--debug` (or `SWITCH_PROFILE_DEBUG=1`, or `DEBUG=switch-profile`) also prints the stack trace on screen.

## Startup (every command)

`preflight()` in `src/commands/common.js` runs first (skipped for actions started from the home screen, which already ran it):

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

## The home screen (`switch-profile`, no arguments)

```
┌   switch-profile  2.1.0
│
│  ● acme-prod · Admin · 111111111111 · ap-southeast-2 · PROD · SSO ✓ auto-refresh · logged in 3h ago
│  This terminal uses acme-dev (AWS_PROFILE)
│
▲  AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY are set in this terminal and override profiles.
│  Switching clears them from this terminal.
│
◆  Switch to · type a name, account, role or client
│  Search: _
│  ● acme-prod        Admin       111111111111  ap-southeast-2  PROD  current default
│  ○ acme-dev         Admin       222222222222  ap-southeast-2
│  ○ globex-readonly  ReadOnly    333333333333  us-east-1       PROD
│  ○ sandbox          access keys               us-west-2
│
│  [Log in] [Add] [Portals] [Rename] [Remove] [Log out] [Settings]
└  ↑↓ choose · enter switch · tab actions · esc quit
```

The home screen is a custom prompt (`src/home.js`, built on `@clack/core`'s `AutocompletePrompt`): a search box, the profile list, and an action bar that is always drawn below the list, however many profiles there are.

### Keys

| Focus | Keys |
|-------|------|
| List (default) | Type to search, `↑` `↓` choose, `Enter` switch, `Tab` go to the action bar, `Esc` quit |
| Action bar | `←` `→` choose an action, `Enter` open it, `Tab`, `↑` `↓` or typing go back to the list, `Esc` quit |

When there are no rows (no match, or no profiles), the focus moves to the action bar.

### Navigation

- **Actions open as pages.** The home screen collapses to a breadcrumb (`◇  switch-profile › Settings`), the page runs, then the home screen comes back with a fresh status line and profile list.
- **Esc inside a page goes back** (`└  ← Back`) to the home screen.
- **Errors open the [error screen](#the-error-screen)** instead of returning to the home screen at once, both for pages and for switches (picked on the home screen or with `sp <name>`). Unexpected errors (bugs) still end the run with the error and the log path.
- **Ctrl+C or Esc during a switch** (the login screen, the `sp` shortcut offer) ends the run, as the profile may already be switched.
- **Esc on the home screen quits** (`└  Bye 👋`, exit 0).
- **A successful switch ends the session**, also when it happens inside a page (e.g. "Switch to it now?" after adding a profile): `sp` can only set `AWS_PROFILE` once the process exits.
- The environment-variable warning is shown on the first home screen only.

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
- With a query: match quality, with a small frecency bonus. When the list changes, the focus stays on the same profile if it is still listed.

### Actions

| Action | Runs |
|--------|------|
| Log in | `login` for the default profile (a fresh session, even if the current one is valid) |
| Add | `add` |
| Portals | `portals` (pick a portal, then edit it) |
| Rename | `rename` (pick the profile, then edit its name) |
| Remove | `remove` |
| Log out | `logout` |
| Settings | `settings` ("Done" returns to the home screen) |

No profiles at all: `No AWS profiles yet. Let's add your first one ✨` and the `add` menu opens. Non-interactive: exit 3.

### The error screen

`src/commands/recovery.js`. When a page or a switch fails with an expected error (`CliError`), the error stays on screen and the user picks what happens next:

```
■  SSO login for happyskills failed.
│  error: invalid_request
│  error_description: Invalid request
│
│  The SSO region is most likely wrong: it must be the region where IAM Identity Center lives, not where you deploy. Check and fix it with: sp portals
│
│  Portal      happyskills  https://storyleaps.awsapps.com/start/#/
│  SSO region  us-east-1  ▲ its portal page says ap-southeast-2
│
│  Details: ~/.switch-profile/switch-profile.log
│
◆  What now?
│  ● Change the SSO region of happyskills to ap-southeast-2 (currently us-east-1)
│  ○ Edit the portal happyskills (start URL and SSO region)
│  ○ Try again
│  ○ Back to the home screen
```

- The portal lines appear when the failure was an SSO login (`error.target` set by the login screen): the `[sso-session]` of the session, or of the profile that logged in.
- The region is read from the portal page (`aws.detectSsoRegion`) only when AWS answered as it does for a wrong region (`error.wrongRegion`).
- **Change the SSO region…** (only when the portal page names another region) saves it and tries again. **Edit the portal** opens the [portal page](#portals-name); when something changed, it tries again. **Try again** reruns the page or the switch with a fresh state. **Back** (or Esc) returns to the home screen; from `sp <name>`, that opens the home screen.
- Every error shown here is logged (`<what> failed (error screen)`).

## Switching with arguments (`sp acme prod`)

Words are joined into one query (`rank.resolveQuery`):

1. An exact name (case-insensitive) switches directly.
2. Otherwise, if exactly one profile matches the fuzzy search, it switches directly.
3. Otherwise the home screen opens with the query pre-filled. Non-interactive: exit 3, with up to five candidates in the hint (`"acme" matches 2 profiles.` / `Be more specific: acme-prod, acme-dev`), or `No profile matches "x".`

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

On success: `🔓 Logged in`, and the time is remembered (`settings.logins`). On failure: `SSO login for acme failed.` with the AWS CLI's error lines; a wrong SSO region (`invalid_request`, `Invalid start url provided`) or an `invalid_grant` adds a hint about the SSO region.

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

- Target: the argument, else `AWS_PROFILE`, else the default profile (from the home screen: the default profile). None: exit 3.
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

- **A single SSO profile.** A short guide (a short session name to reuse per portal, not the URL; start URL; SSO region) that lists the portals already set up with their regions, then `aws configure sso --profile <name>` takes over the terminal, with a device code instead of a browser over SSH or without a display (same login mode as `sp login`). Its error output is shown as it arrives and captured: when it fails, the message is the AWS CLI's error, and `Invalid start url provided` gets a hint that the SSO region is most likely wrong, with the regions of the known portals. If no session name was given, the profile is converted to an `[sso-session]` and you log in once more.
- **Console sign-in.** Pick a default region, then `aws login --profile <name>` (AWS CLI 2.32+). For accounts reached with `aws login` (for example IAM account access manager assignments), without long-lived keys.
- **Access keys.** A warning (keys never expire, stored in plain text), a confirmation (default No), then key id, secret (masked) and region.

Then `Profile x created` and `Switch to x now?`.

### Import from an SSO portal

```
◆  Which SSO portal?
│  ● acme      (https://acme.awsapps.com/start)
│  ○ A new portal…
```

A new portal asks for the start URL, the SSO region (`where IAM Identity Center lives`) and a short name (suggested from the URL). The region picker starts on the region read from the portal's start page (`…: ap-southeast-2, read from the portal`), else `us-east-1`. The portal is saved as an `[sso-session]` right away.

If there is no valid cached token for the session, the login screen runs. If the login fails because the SSO region is wrong (AWS answers `invalid_request` / `Invalid start url provided`), the import offers to fix it instead of going back to the home screen:

```
▲  happyskills is set to the SSO region us-east-1, but its portal is in ap-southeast-2.
◆  Change happyskills to ap-southeast-2 and log in again?
```

Yes updates `sso_region` of the `[sso-session]` and logs in again. No (or no region found on the portal page) opens the region picker; keeping the current region ends with the login error. Then:

```
◇  Found 14 accounts and 31 roles
◆  Default region for these profiles
│  ap-southeast-2
◆  Name prefix (profiles become <prefix>-<account>-<role>)
│  acme
│  +17 new: acme-prod-workloads-admin, acme-dev-readonly, …
│  14 already set up (kept as they are)
│  −1 no longer available: acme-old-sandbox-admin
◆  Add which profiles? (all selected: space to untick, type to search, enter to confirm)
│  Search: _
│  ◼ acme-prod-workloads-admin   Prod Workloads · 111111111111 · Admin
│  ◻ acme-dev-readonly           Dev · 222222222222 · ReadOnly
│  ◼ …
◆  Remove the 1 profile that no longer exists?   (default No)
└  ✓ Added 16 profiles, removed 1 🎉
     Try: sp acme
```

- Only new profiles are listed, all selected: Enter adds them all, or untick the ones you don't want. Search matches the profile name, account name, account id and role. Unticked pairs are not remembered: they are offered again on the next import.
- The region defaults to the region already used by this session's profiles, else the SSO region.
- Removing stale profiles backs up the AWS files first. Only profiles generated by the import (`switch_profile_generated`) can be stale.
- Nothing new and nothing stale: `✓ Everything is already set up (14 profiles)`.

**Non-interactive** (`--from-sso <session>`): the session must exist (exit 3 otherwise, listing known sessions), a valid token must be cached (exit 2, `Run: aws sso login --sso-session acme`), the region defaults to the SSO region and the prefix to the session name, stale profiles are removed only with `--prune`. `--yes` skips the selection and confirmations in a terminal and adds every new profile (region and prefix are still asked unless passed). `--json`: `{"added", "existing", "removed", "stale"}`.

## `remove [profiles...] [--yes]`

Without names, a searchable multi-select (the current default is disabled: `current default: switch first`). Then a confirmation (default No). Non-interactive: names and `--yes` are required (exit 3 otherwise). Removing the current default, or an unknown name, exits 3. `[sso-session]` sections are kept.

## `rename [profile] [new-name]`

Gives a profile a new name, typically a friendlier one than the generated `<prefix>-<account>-<role>`.

```
◆  Rename which profile?
│  Search: workloads_
│  ● acme-prod-workloads-administratoraccess   AdministratorAccess · 111111111111 · ap-southeast-2
◆  New name for acme-prod-workloads-administratoraccess
│  acme-prod_
◆  Renamed acme-prod-workloads-administratoraccess to acme-prod
│  still the default profile
│  source_profile updated in deploy
└  Other terminals, scripts and tools that use acme-prod-workloads-administratoraccess (AWS_PROFILE or --profile) need the new name.
```

- Without a profile, a searchable list opens; without a new name, a text prompt opens pre-filled with the current name. Non-interactive: both are required (exit 3).
- The new name follows the `add` rules (lowercase letters, numbers, `-`, `_`, at least 2 characters) and must not be taken or `default` (exit 3).
- What changes is listed in [AWS Profile Management](aws-profile-management.md#renaming-profiles). SSO logins keep working: tokens are keyed by session, not profile name.
- When this terminal's `AWS_PROFILE` is the old name, `sp` sets it to the new one. Without `sp`, a warning shows the `export` command.
- A `credential_process` that passes `--profile <old>` is not rewritten; a warning names it.
- `--json`: `{"from", "to", "default", "sources", "processes", "terminal"}`.

## `portals [name]`

Alias `portal`. SSO portals are the `[sso-session]` sections that SSO profiles share. Changing a portal's start URL or SSO region fixes every profile that uses it, with no need to remove and re-add them.

Interactive, without a name: reads the region of every portal from its start page (spinner `Reading the portals`), then:

```
◆  Which portal?
│  ● happyskills (us-east-1 · ▲ its portal is in ap-southeast-2 · 1 profile · https://storyleaps.awsapps.com/start/#/)
│  ○ acme (ap-southeast-2 · matches the portal · 6 profiles · https://acme.awsapps.com/start)
```

The portal page (also with a name, and from the error screen):

```
●  Portal happyskills
│  Start URL   https://storyleaps.awsapps.com/start/#/
│  SSO region  us-east-1 · ▲ its portal is in ap-southeast-2
│  Profiles    happyskills-dev
│
◆  Edit happyskills
│  ● Change the SSO region to ap-southeast-2 (what the portal page says)
│  ○ Start URL
│  ○ SSO region
│  ○ Back
```

- The first option appears only on a mismatch. `(could not read the region from the portal page)` when the page names none.
- Each change is saved at once (`transforms.updateSsoSession`) and the page shows again; the last option becomes **Done**. After a change: `Log in to happyskills now to check it works?` (not from the error screen, which tries again instead).

Non-interactive:

- `portals --json`: `{"portals": [{ "name", "startUrl", "region", "profiles": [names] }]}`; `--check` adds `detectedRegion` (one HTTPS request per portal). Without `--json`, one tab-separated line per portal.
- `portals <name> --region <region>` and/or `--start-url <https://…>`: saves without prompting (`--json` prints the portal). Unknown portal, unknown region, a non-https URL or a missing name: exit 3.

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
