# switch-profile

<p align="center"><img src="docs/images/hero.webp" width="100%" alt="switch-profile illustration: a girl rides a rope lift up a tower of lit workshops"></p>

**Jump between AWS accounts from your terminal in seconds, the way AWS recommends.**

If you work across many AWS accounts (clients, environments, organizations), you switch accounts dozens of times a day. `switch-profile` turns that into a few keystrokes: type part of a name, account ID or client, press Enter, and every AWS tool in that terminal is on the right account, logged in and verified. It works the same on your laptop and on a remote machine over SSH, and it never asks you to manage access keys.

```shell
npx switch-profile
```

```
┌   switch-profile  2.1.0
│
│  ● acme-prod · Admin · 111111111111 · ap-southeast-2 · PROD · SSO ✓ auto-refresh · logged in 3h ago
│
◆  Switch to · type a name, account, role or client
│  Search: dev█  (3 matches)
│  ● acme-dev        Admin     222222222222  ap-southeast-2  used 2d ago
│  ○ globex-dev      ReadOnly  333333333333  us-east-1
│  ○ initech-dev     Admin     444444444444  eu-west-1
│
│  [Log in] [Add] [Remove] [Log out] [Settings]
└  ↑↓ choose · enter switch · tab actions · esc quit
```

## Why it's great

- **Seconds, not minutes.** Fuzzy search across profile name, account ID, account name, role, client and region, with your most-used accounts first, and every other action one Tab away. `sp acme prod` switches without even opening the home screen.
- **Logged in when you need it.** If a session has expired, it logs you in on the spot, then never again until the session ends: credentials refresh on their own in the AWS CLI, SDKs and Terraform.
- **Every terminal on its own account.** With the `sp` shortcut, each terminal keeps its own `AWS_PROFILE`, plus tab-completion of your profile names.
- **Made for remote machines.** On a server reached over SSH, the login code lands in your laptop's clipboard, or scan a QR code with your phone.
- **A whole client in one step.** `sp add` creates a profile for every account and role in an IAM Identity Center portal, and re-syncs it later.
- **Scripts and AI agents welcome.** It never prompts without a terminal, offers `--json` output and stable exit codes.

## Built on AWS best practices

`switch-profile` does not invent its own security model. It follows what AWS recommends, lets the official AWS CLI do the sensitive work, and adds the guardrails that make switching accounts all day safe.

- **Temporary credentials, not access keys.** AWS recommends that people sign in through an identity provider, such as IAM Identity Center (AWS SSO), and use short-lived credentials instead of long-lived access keys ([IAM best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)). `switch-profile` is built around SSO and console sign-in (`aws login`). Access keys still work, but it warns you before creating new ones.
- **It never copies credentials.** Switching writes only a profile's *settings* into `[default]`. The AWS CLI and SDKs fetch short-lived credentials themselves and refresh them through `[sso-session]` ([AWS CLI SSO guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html)). There are no secrets in anything `switch-profile` writes, so nothing to leak and nothing to go stale.
- **The AWS CLI does the logging in.** Logins run through `aws sso login` and `aws login`: browser sign-in on your machine, device code where there is no browser. `switch-profile` stores no tokens and has no telemetry. Its only network calls are the AWS CLI's own and npx fetching the package.
- **Device codes, handled carefully.** Device-code approvals are a known phishing route, so they are used only where there is no browser, and the login screen tells you to approve only the exact code it shows.
- **You always know which account you are in.** Every switch confirms the real identity with `aws sts get-caller-identity`. Production accounts are flagged in red. Environment variables that would silently override your choice (such as `AWS_ACCESS_KEY_ID`) are flagged, and `sp` clears them.
- **One account per terminal.** `AWS_PROFILE` is scoped to a terminal, so switching in one window cannot move a deploy running in another.
- **Careful with your files.** Edits to `~/.aws` are atomic, upgrades back up your files first, and the shell setup lives in one clearly marked block that you can remove from Settings at any time.
- **Always the latest version.** Run through `npx`, every run uses the newest release: nothing to install, nothing to update.

## Table of Contents

<!-- BEGIN toc -->
- [Why it's great](#why-its-great)
- [Built on AWS best practices](#built-on-aws-best-practices)
- [Quick start](#quick-start)
- [The home screen](#the-home-screen)
- [Commands](#commands)
- [Working on remote machines (SSH)](#working-on-remote-machines-ssh)
- [Importing a client's accounts](#importing-a-clients-accounts)
- [Scripts and AI agents](#scripts-and-ai-agents)
- [Settings](#settings)
  - [The `sp` shortcut](#the-sp-shortcut)
- [Upgrading from 1.x](#upgrading-from-1x)
- [Requirements](#requirements)
- [Troubleshooting](#troubleshooting)
  - [`invalid_grant` during an SSO login](#invalid_grant-during-an-sso-login)
  - [`Invalid start url provided` when adding an SSO profile](#invalid-start-url-provided-when-adding-an-sso-profile)
  - [Something failed and the message is not enough](#something-failed-and-the-message-is-not-enough)
  - [`Error loading SSO Token` or "session has expired"](#error-loading-sso-token-or-session-has-expired)
  - [SSO login hangs on a remote machine](#sso-login-hangs-on-a-remote-machine)
  - [The code is not in my clipboard over SSH](#the-code-is-not-in-my-clipboard-over-ssh)
  - [`sp: command not found`](#sp-command-not-found)
  - [Tab-completion does not work in zsh](#tab-completion-does-not-work-in-zsh)
  - [Commands still use the wrong account](#commands-still-use-the-wrong-account)
  - [AWS CLI not found](#aws-cli-not-found)
- [Documentation](#documentation)
- [License](#license)
<!-- END toc -->

## Quick start

```shell
npx switch-profile
```

On the first switch, `switch-profile` offers to set up the `sp` shortcut (a small function in your shell startup file). Say yes, open a new terminal, and from then on:

```shell
sp                 # pick a profile
sp acme-prod       # switch straight to a profile
sp acme prod       # fuzzy match: switches if exactly one profile matches
```

**Why npx?** It always runs the latest release, so you never have to update anything. `sp` uses `npx switch-profile@latest` under the hood. The cost is a second or two while npm checks for a newer version, and the tool needs a connection to AWS anyway. A global install (`npm install -g switch-profile`) also works, but then updating is up to you, and `sp` keeps using npx regardless.

No profiles yet? `switch-profile` starts the **Add profiles** flow. To import every account of your company's or client's SSO portal, see [Importing a client's accounts](#importing-a-clients-accounts).

## The home screen

Running `sp` (or `npx switch-profile`) with no arguments opens the home screen:

- **Type and press Enter** to switch. That's the whole path for everyday use.
- **Tab** moves to the action bar below the list, which is always visible however many profiles you have: **Log in**, **Add**, **Remove**, **Log out**, **Settings**. Use ←→ to choose and Enter to open.
- **Every action opens as a page and comes back** to the home screen when it's done. **Esc** goes back from a page, and quits from the home screen.
- A switch ends the session, which is what lets `sp` set `AWS_PROFILE` in your terminal.

## Commands

| Command | What it does |
|---------|--------------|
| `switch-profile [profile...]` | Opens the home screen (search and switch, plus the action bar). With words: an exact name or a unique fuzzy match switches directly; otherwise the home screen opens pre-filtered (or exits 3 when non-interactive). |
| `use <profile>` | Switches to a profile by its exact name (no fuzzy matching). |
| `status [--json]` | Shows the default profile, its login state, and what this terminal uses. |
| `login [profile] [--device\|--browser]` | Starts a fresh login now, even if the session is still valid. Defaults to this terminal's `AWS_PROFILE`, then the default profile. |
| `logout [--yes]` | Ends every SSO session on this machine (`aws sso logout`, plus `aws logout --all` on AWS CLI 2.32+). |
| `add` | Adds profiles: import accounts from an SSO portal (recommended), a single SSO profile, a console sign-in profile, or access keys. |
| `add --from-sso [session]` | Imports or re-syncs every account and role of an `[sso-session]`. Options: `--region`, `--prefix`, `--prune`, `--yes`. |
| `remove [profiles...] [--yes]` | Removes profiles (alias `rm`). The current default cannot be removed. |
| `settings` | Per-terminal switching, SSO login mode, legacy SSO upgrade. |

Global options: `--json`, `--no-input` (never prompt), `--debug` (show stack traces), `-v, --version`. Every run, AWS CLI call and error is logged to `~/.switch-profile/switch-profile.log` (secrets redacted). In examples, `sp` and `switch-profile` are interchangeable; only `sp` changes the current terminal.

See [CLI Interface](docs/cli-interface.md) for every screen.

## Working on remote machines (SSH)

Since AWS CLI 2.22, `aws sso login` opens a browser on the machine running the CLI. Over SSH there is none, so the login hangs. `switch-profile` detects remote sessions (`SSH_CONNECTION`, `SSH_CLIENT` or `SSH_TTY` set, or Linux without `DISPLAY`/`WAYLAND_DISPLAY`) and uses a device code instead:

```
◇  Approve the login for acme

   Open  https://device.sso.us-east-1.amazonaws.com/?user_code=WXYZ-ABCD
   Code  WXYZ-ABCD  📋 sent to your clipboard

   🔒 Only approve if the page shows exactly this code.
   q QR code · c copy again · ctrl+c cancel
◒  Waiting for approval 0:12
```

- **Clipboard over SSH.** The code is sent to your local clipboard with the OSC 52 terminal escape sequence. iTerm2, Ghostty, kitty, WezTerm and Windows Terminal support it; tmux needs `set -g set-clipboard on` (or `allow-passthrough on`). If your terminal ignores it, copy the code by hand.
- **QR code.** Press `q` to show the URL as a QR code and approve from your phone.
- **Log in any time.** `sp login` starts a fresh session now, for example before a long task. `--device` and `--browser` override the automatic choice; Settings can make either permanent.
- **Log out.** `sp logout` ends every SSO session on the machine, so a shared or rented server keeps no AWS access.

How often you log in is set by IAM Identity Center, not by `switch-profile`:

- The **user interactive session** duration decides when you must log in again. The default is 8 hours, up to 90 days. Your administrator sets it once for the whole Identity Center instance (Settings > Authentication).
- The **permission set** session duration (1 to 12 hours) matters less: role credentials refresh automatically while the SSO session is valid, as long as the profile uses an `[sso-session]` (the format `switch-profile` writes).

## Importing a client's accounts

```shell
sp add          # then choose "Accounts from an SSO portal"
```

1. Pick an existing `[sso-session]` or create one: start URL (e.g. `https://acme.awsapps.com/start`), SSO region (where Identity Center lives, not where you deploy), and a short name, usually the client.
2. Log in if needed.
3. `switch-profile` lists every account and role you can access, then asks for a default region and a name prefix. Profiles are named `<prefix>-<account-name>-<role>`, for example `acme-prod-workloads-admin`.
4. A preview shows the new profiles, the ones already set up, and the ones that no longer exist. Then pick the new profiles to add: all are selected, so press Enter to add everything, or untick the ones you don't want (type to search by name, account or role).

Run it again later to pick up new accounts. Account/role pairs that already have a profile are never duplicated, whatever its name. Generated profiles that no longer exist can be pruned (after a backup); profiles you wrote by hand are never pruned.

Non-interactive (after `aws sso login --sso-session acme` or `sp login`):

```shell
switch-profile add --from-sso acme --region eu-west-1 --prefix acme --yes --json
```

## Scripts and AI agents

`switch-profile` never prompts when stdin or stdout is not a terminal, when `CI` is set, or with `--no-input`. It fails with a hint and an exit code instead.

| Exit code | Meaning |
|-----------|---------|
| 0 | OK |
| 1 | Error |
| 2 | Login required (run `switch-profile login <profile>` in a terminal) |
| 3 | Bad input: unknown or ambiguous profile, missing argument or `--yes` |
| 130 | Cancelled |

- `--json` prints machine-readable results on stdout. Expected errors are printed as JSON on stderr: `{"error": "...", "hint": "...", "code": 3}`.
- `switch-profile status --json` lists every profile with its kind, account, role, region and whether it is production.
- Non-interactive logins still work: `switch-profile login acme-dev --device` prints the AWS CLI's URL and code on stderr and waits for approval.
- A shell tool's environment does not survive between commands, so `sp` and `export AWS_PROFILE` do not help an agent. Prefix each AWS command instead:

```shell
AWS_PROFILE=acme-dev aws s3 ls
AWS_PROFILE=acme-dev terraform plan
```

## Settings

Open **Settings** from the home screen's action bar (Tab, then → to Settings), or run it directly:

```shell
sp settings
```

- **Per-terminal switching**: turns the `sp` shortcut (and tab-completion) on or off.
- **SSO login**: `auto` (device code over SSH, browser otherwise), always device code, or always browser.
- **Legacy SSO profiles**: upgrades SSO profiles that have no `[sso-session]` (no auto-refresh).

The tool's own state lives in `~/.switch-profile/settings.json`. See [Configuration Files](docs/configuration-files.md).

### The `sp` shortcut

`sp` is a shell function added to your startup file inside a `# >>> switch-profile ... >>>` block. It runs `switch-profile`, then sets `AWS_PROFILE` in the current terminal and clears `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` and `AWS_DEFAULT_PROFILE`, which would otherwise override the profile. It also completes profile names and subcommands with Tab. Do not edit the block: `switch-profile` rewrites it when a new version changes it.

| Shell | Startup file |
|-------|--------------|
| zsh | `${ZDOTDIR:-~}/.zshrc` |
| bash | `~/.bashrc` (Linux), `~/.bash_profile` (macOS) |
| fish | `~/.config/fish/config.fish` |
| PowerShell | `$PROFILE.CurrentUserAllHosts` (for `pwsh` and/or Windows PowerShell) |

## Upgrading from 1.x

Version 1.x copied temporary credentials into `[default]` of `~/.aws/credentials`, which expired after about an hour. Version 2 upgrades your setup automatically on its first run:

- `~/.aws/config` and `~/.aws/credentials` are backed up next to themselves (e.g. `~/.aws/config.bak-2026-10-01T10-12-00Z`).
- `[default]` is rewritten with the settings of the profile you last selected, and the 1.x `profile` and `expiry_date` keys are removed.
- If some SSO profiles use the legacy format (no `sso_session`), you are asked once whether to upgrade them. Profiles of the same portal share one session, so one login covers them all.

The old `switch-profile switch` command still works. If you run 1.x again later (e.g. `npx switch-profile@1`), the next 2.x run repairs `[default]` (with backups).

## Requirements

- **Node.js 20.12 or later.** Older versions get a clear message.
- **[AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).** 2.22 or later is recommended (choice between device code and browser login); console sign-in (`aws login`) needs 2.32+.
- **macOS and Linux** are first-class (zsh, bash, fish). **Windows PowerShell** is supported. **CMD** is limited: no `sp`, so run the `set AWS_PROFILE=<name>` command shown after each switch.

The published package has no runtime dependencies: everything is bundled into one file.

## Troubleshooting

### `invalid_grant` during an SSO login

The SSO region is wrong. It must be the region of your IAM Identity Center instance, not the region you deploy to. Fix `sso_region` in the `[sso-session]` section of `~/.aws/config` (or remove the portal and add it again).

### `Invalid start url provided` when adding an SSO profile

The start URL is usually fine: AWS sends this error when the **SSO region** is wrong. Use the region where IAM Identity Center lives (Identity Center console › Settings), not where you deploy. If the portal is already set up, type its existing session name instead (`sp add` lists them with their regions).

### Something failed and the message is not enough

Open `~/.switch-profile/switch-profile.log`. It has every run, every AWS CLI call with its exit code and output, and every error with its full chain. Secrets are redacted, so you can share it.

### `Error loading SSO Token` or "session has expired"

The SSO login is missing or expired. Run `sp login` (or just switch to the profile again: `switch-profile` logs in when needed). There is no need to recreate the profile.

### SSO login hangs on a remote machine

The AWS CLI is waiting for a browser on the remote machine. Run `sp login --device`, or set **Settings > SSO login** to always use a device code.

### The code is not in my clipboard over SSH

Your terminal does not accept OSC 52, or tmux blocks it. In tmux, add `set -g set-clipboard on` to `~/.tmux.conf`. Otherwise copy the code from the screen (press `c` to try again).

### `sp: command not found`

The terminal was opened before `sp` was set up. Open a new terminal or run `source ~/.zshrc` (or your shell's equivalent). `sp settings` shows whether it is on.

### Tab-completion does not work in zsh

The completion registers only if `compinit` ran before the `switch-profile` block. Move the block below `compinit` (or below the line that loads oh-my-zsh) in `~/.zshrc`.

### Commands still use the wrong account

`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` in the environment override every profile, and `AWS_REGION` overrides the profile's region. The home screen warns about them; switching with `sp` clears the credential variables (not the region).

### AWS CLI not found

**macOS:** `brew install awscli`

**Linux and Windows:** follow the [AWS CLI install guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

## Documentation

<!-- BEGIN doc-index -->
- [Architecture](docs/architecture.md) — Module map, data flow and bundling of the switch-profile CLI.
- [AWS Profile Management](docs/aws-profile-management.md) — Profile kinds, switching, SSO logins, SSO import, migrations and the sp shell function.
- [CLI Interface](docs/cli-interface.md) — Walkthrough of every command and screen of the CLI.
- [Configuration Files](docs/configuration-files.md) — Exact formats of the AWS files, the settings and log files and the shell block written by switch-profile.
- [Development Guide](docs/development-guide.md) — Build, lint, tests, manual testing and releases.
- [Gotchas](docs/gotchas.md) — Non-obvious pitfalls for users and maintainers.
<!-- END doc-index -->

## License

[BSD 3-Clause](LICENSE)
