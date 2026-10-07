---
description: Non-obvious pitfalls for users and maintainers.
tags: [gotchas, pitfalls]
---

# Gotchas

Pitfalls that are not obvious, for users first, then for maintainers.

## Table of contents

- [Profile switching is global by default](#profile-switching-is-global-by-default)
    - [Why the CLI cannot set `AWS_PROFILE`, and how `sp` does](#why-the-cli-cannot-set-aws_profile-and-how-sp-does)
    - [`sp` does not make `[default]` per-terminal](#sp-does-not-make-default-per-terminal)
    - [Environment variables that override profiles](#environment-variables-that-override-profiles)
    - [LLM agents and automation](#llm-agents-and-automation)
- [Switching and search](#switching-and-search)
    - [A fuzzy match switches only when it is unique](#a-fuzzy-match-switches-only-when-it-is-unique)
- [Logins](#logins)
    - [Account access manager needs `aws login`, not `aws sso login`](#account-access-manager-needs-aws-login-not-aws-sso-login)
    - [The clipboard over SSH depends on your terminal](#the-clipboard-over-ssh-depends-on-your-terminal)
    - [Log in again after the legacy SSO upgrade](#log-in-again-after-the-legacy-sso-upgrade)
    - [`Invalid start url provided` means a wrong SSO region](#invalid-start-url-provided-means-a-wrong-sso-region)
- [Shell support](#shell-support)
    - [zsh completion needs `compinit` first](#zsh-completion-needs-compinit-first)
    - [CMD on Windows is not supported](#cmd-on-windows-is-not-supported)
    - [PowerShell execution policy](#powershell-execution-policy)
- [Upgrades and downgrades](#upgrades-and-downgrades)
    - [Running switch-profile 1.x again](#running-switch-profile-1x-again)
- [Tools that cannot read SSO profiles](#tools-that-cannot-read-sso-profiles)
- [Maintainer gotchas](#maintainer-gotchas)
    - [clack's spinner exits the process on Ctrl+C](#clacks-spinner-exits-the-process-on-ctrlc)
    - [clack autocomplete re-filters function options](#clack-autocomplete-re-filters-function-options)

## Profile switching is global by default

Switching writes the profile's settings into `[default]` of `~/.aws/config` (and, for access key profiles, its keys into `[default]` of `~/.aws/credentials`). These files are shared by every terminal and process:

- If terminal A switches to `dev`, terminal B is on `dev` too.
- Terraform, CDK or scripts already running against `[default]` follow the switch immediately.

`AWS_PROFILE` scopes a profile to one terminal: AWS tools use the named profile and ignore `[default]`.

```shell
export AWS_PROFILE=dev          # Linux / macOS
$env:AWS_PROFILE = "dev"        # PowerShell
set AWS_PROFILE=dev             # CMD
```

### Why the CLI cannot set `AWS_PROFILE`, and how `sp` does

A child process cannot change its parent shell's environment. `switch-profile` (or `npx switch-profile`) can only *print* the `export` command.

`sp` is a shell function, so it runs inside your shell:

1. It runs `switch-profile` with `SWITCH_PROFILE_SHELL` and `SWITCH_PROFILE_ENV_FILE` (a temp file) set.
2. After a switch, `switch-profile` writes only the profile name into that file.
3. `sp` sets `AWS_PROFILE`, clears the credential variables (below), and deletes the file.

Terminals opened before `sp` was set up do not have it until you open a new one or reload the startup file.

### `sp` does not make `[default]` per-terminal

`sp` still updates `[default]` like any switch; it adds `AWS_PROFILE` to the current terminal. Terminals without `AWS_PROFILE`, and processes started outside a terminal (IDE plugins, cron, GUI tools), follow the last switch made anywhere. The home screen shows `This terminal uses X` when the terminal's `AWS_PROFILE` differs from `[default]`.

### Environment variables that override profiles

- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_SESSION_TOKEN` win over `AWS_PROFILE` in the AWS CLI and boto3 (the JS SDK ignores them when a profile is set, so tools disagree). boto3 also reads `AWS_DEFAULT_PROFILE` before `AWS_PROFILE`. The home screen warns about all four, and **`sp` unsets them** after a switch. Without `sp`, unset them yourself.
- `AWS_REGION` and `AWS_DEFAULT_REGION` override the profile's region. They are **not cleared** (a region pinned on purpose is legitimate); the switch prints a warning when they differ from the profile's region.

### LLM agents and automation

Each shell tool call of an agent runs in a new subprocess, so `export AWS_PROFILE=…` or `sp` in one call is gone in the next.

```shell
# Does not work: two separate tool calls
export AWS_PROFILE=dev
aws s3 ls                       # uses [default], not dev

# Works: prefix every command
AWS_PROFILE=dev aws s3 ls
AWS_PROFILE=dev terraform plan
```

Prefixing also lets concurrent agents use different profiles. For agents: `switch-profile` never prompts without a TTY, `status --json` lists profiles, and exit code 2 means "a human must run `switch-profile login <profile>`". `switch-profile login <profile> --device` also works non-interactively: the URL and code go to stderr.

## Switching and search

### A fuzzy match switches only when it is unique

`sp acme prod` switches immediately only if the text is an exact profile name or exactly one profile matches. Matching covers names, account ids, account names, roles, SSO sessions and regions, so short words often match several profiles (`sp prod` may match every client's prod). In a terminal the home screen then opens pre-filtered; in scripts the command exits 3 and lists candidates. Use `use <exact-name>` in scripts to avoid surprises.

## Logins

### Account access manager needs `aws login`, not `aws sso login`

Accounts assigned to you through the IAM account access manager are not reachable with `aws sso login`. Add those accounts as **Console sign-in** profiles (`sp add` > Console sign-in), which use `aws login` (AWS CLI 2.32+). They have `login_session` in `~/.aws/config` and are logged in with `aws login` (`--remote` over SSH).

### The clipboard over SSH depends on your terminal

Over SSH, the device code is sent to your local clipboard with the OSC 52 escape sequence. Whether it arrives depends on the terminal: iTerm2, Ghostty, kitty, WezTerm and Windows Terminal accept it (iTerm2 may ask for permission first); others may not. Inside tmux, enable `set -g set-clipboard on` (or `set -g allow-passthrough on`; `switch-profile` also sends a passthrough-wrapped copy). `switch-profile` cannot detect whether it worked, so the screen says `sent to your clipboard`, not `copied`.

### Log in again after the legacy SSO upgrade

After legacy SSO profiles are upgraded to `[sso-session]`, the AWS CLI stores the token under the session name instead of the start URL. The old login is not reused, so you log in once per session. The same happens when a new SSO profile is created without a session name and `switch-profile` adds one.

### `Invalid start url provided` means a wrong SSO region

`aws configure sso` (and `aws sso-oidc`) answer a correct start URL sent to the wrong SSO region with `InvalidRequestException … error_description: Invalid start url provided` (sometimes just `Invalid request`). It points at the URL, but the region is wrong: use the region of the IAM Identity Center instance. A trailing `/` on the start URL is fine. `switch-profile add` explains this and lists the regions of the portals already set up.

## Shell support

### zsh completion needs `compinit` first

The block registers completion with `compdef`, which exists only after `compinit` ran. If the `switch-profile` block sits above `compinit` (or above the line that loads oh-my-zsh, prezto, etc.), `sp` works but Tab does not complete. Move the block below it. Loading the block without `compinit` does not cause errors.

Completion reads `[profile name]` lines with `sed`; profiles written as `[name]` in `~/.aws/config` are not completed.

### CMD on Windows is not supported

`sp` exists for zsh, bash, fish and PowerShell. In CMD, run the `set AWS_PROFILE=<name>` command shown after each switch.

`switch-profile` cannot tell CMD and PowerShell apart (neither sets `SHELL`). On Windows it always targets the PowerShell profile, so enabling `sp` from CMD installs it for PowerShell.

### PowerShell execution policy

`sp` lives in your PowerShell profile (`$PROFILE.CurrentUserAllHosts`). If the execution policy blocks scripts, the profile does not load and `sp` is not found. Fix:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## Upgrades and downgrades

### Running switch-profile 1.x again

1.x does not know the 2.x format. Run after an upgrade (e.g. `npx switch-profile@1`), it writes temporary keys plus its `profile` and `expiry_date` keys back into `[default]` of `~/.aws/credentials`. Those keys override the settings in `~/.aws/config` and expire after about an hour.

The next 2.x run repairs `[default]` (with backups), using the profile 1.x selected. Avoid mixing versions; if you must, run 2.x afterwards.

## Tools that cannot read SSO profiles

Almost every current AWS tool resolves credentials from an SSO profile in `[default]`. A few cannot, such as the AWS SDK for Java 1.x or old SDK versions that only understand the legacy SSO format. Give them a `credential_process` profile so the AWS CLI produces the credentials:

```ini
[profile legacy-tool]
credential_process = aws configure export-credentials --profile dev --format process
```

The credentials refresh as long as the SSO login of `dev` is valid.

## Maintainer gotchas

### clack's spinner exits the process on Ctrl+C

`p.spinner()` from `@clack/prompts` listens on stdin and calls `process.exit` on Ctrl+C. The login screen needs stdin for its own keys (`q`, `c`, `o`) and must kill the `aws sso login` child cleanly on Ctrl+C. So `login-flow.js` uses `ui.timerSpinner()`, a minimal spinner that never touches stdin, and handles raw-mode keypresses itself. Do not swap it for clack's spinner, and do not start a clack prompt while raw mode is on.

### clack autocomplete re-filters function options

When `options` is a function, clack's `autocomplete` still filters the returned rows by substring of the typed text. The home screen ranks and filters with `fuzzysort` already, so clack's filter would drop fuzzy matches (`acme prod` does not appear as a substring of `acme-prod`). The home screen uses `@clack/core`'s `AutocompletePrompt` directly, which does not filter function options, so this only matters if a future prompt goes back to `@clack/prompts`' `autocomplete`: pass `filter: () => true` whenever options are pre-filtered.
