# Gotchas

Critical pitfalls and edge cases that are not immediately obvious when using `switch-profile`.

## Table of Contents

- [Profile switching is global by default](#profile-switching-is-global-by-default)
    - [The problem](#the-problem)
    - [The solution: `export AWS_PROFILE`](#the-solution-export-aws_profile)
    - [Why the CLI cannot set it for you, and how `sp` does](#why-the-cli-cannot-set-it-for-you-and-how-sp-does)
    - [`sp` does not make `[default]` per-terminal](#sp-does-not-make-default-per-terminal)
    - [LLM agents and automation](#llm-agents-and-automation)
- [Shell support](#shell-support)
    - [CMD on Windows is not supported](#cmd-on-windows-is-not-supported)
    - [PowerShell execution policy](#powershell-execution-policy)
- [Upgrades and downgrades](#upgrades-and-downgrades)
    - [Running switch-profile 1.x again](#running-switch-profile-1x-again)
    - [Log in again after the legacy SSO upgrade](#log-in-again-after-the-legacy-sso-upgrade)
- [Tools that cannot read SSO profiles](#tools-that-cannot-read-sso-profiles)

## Profile switching is global by default

### The problem

When you run `npx switch-profile` and select a profile, the tool writes that profile's settings into the `[default]` section of `~/.aws/config` (and, for standard profiles, its keys into `[default]` of `~/.aws/credentials`). These are **global files** shared by every terminal, every tool, and every process on the machine.

This means:
- If Terminal A switches to `dev`, Terminal B is now also on `dev`.
- If Terminal B then switches to `prod`, Terminal A is silently moved to `prod` too.
- Any concurrent process relying on `[default]` (Terraform, CDK, scripts) is affected immediately.

### The solution: `export AWS_PROFILE`

The AWS CLI and all AWS SDKs honor the `AWS_PROFILE` environment variable and use the named profile directly, bypassing `[default]` entirely. Setting it in a terminal scopes the profile to that terminal session only.

On **Linux / macOS**: `export AWS_PROFILE=dev`
On **Windows (PowerShell)**: `$env:AWS_PROFILE = "dev"`
On **Windows (CMD)**: `set AWS_PROFILE=dev`

When `switch-profile` is not launched through `sp`, it displays this command after every successful switch:

```
┌─────────────────────────────────────────────────────────┐
│  To lock this profile to this terminal session, run:    │
│                                                         │
│    export AWS_PROFILE=dev                               │
│                                                         │
│  This prevents other terminals from affecting this one. │
└─────────────────────────────────────────────────────────┘
```

### Why the CLI cannot set it for you, and how `sp` does

A child process (the `npx switch-profile` command) cannot modify the environment of its parent process (your terminal shell). This is an operating system constraint, so the bare `npx switch-profile` (or global `switch-profile`) command can only *show* the `export` command.

The workaround is the `sp` shell function. Because a shell function runs *inside* your shell, it can set variables there:

1. `sp` runs `switch-profile` with `SWITCH_PROFILE_SHELL` and `SWITCH_PROFILE_ENV_FILE` (a temp file) set.
2. After the switch, `switch-profile` writes only the selected profile name into that temp file.
3. `sp` reads the file, sets `AWS_PROFILE` in the current shell, and deletes the file.

`switch-profile` offers to add `sp` to your shell startup file after your first switch, and you can enable or disable it in **More options** > **Settings**. Terminals that were already open do not have `sp` until you open a new one or reload the startup file (for example `source ~/.zshrc`).

### `sp` does not make `[default]` per-terminal

`sp` still updates the global `[default]` like any switch. It only adds `AWS_PROFILE` to the current terminal. So:
- Terminals where you ran `sp` keep their profile, whatever other terminals do.
- Terminals where `AWS_PROFILE` is not set, and processes started outside a terminal (IDE plugins, cron jobs, GUI tools), follow the last switch made anywhere.

`switch-profile` reminds you at startup when the terminal's `AWS_PROFILE` differs from `[default]` ("This terminal uses: ...").

### LLM agents and automation

When an LLM agent (e.g., a Claude Code skill) uses `switch-profile` via a shell tool, the same constraint applies — but with an additional twist. `sp` does not help here either.

**Environment variables do not persist between shell tool invocations.** Each time an LLM agent runs a Bash command, it spawns a **new shell subprocess**. So even if the agent runs `export AWS_PROFILE=dev` (or `sp`) in one command, that variable is gone in the next command.

**Workaround:** The agent must prefix every AWS command with the profile inline:

```shell
AWS_PROFILE=dev aws s3 ls
AWS_PROFILE=dev terraform plan
AWS_PROFILE=prod aws sts get-caller-identity
```

This works reliably and supports concurrent agents using different profiles, since each command carries its own profile context with no shared global state.

**What does NOT work for agents:**

```shell
# Command 1 — sets the variable, but only in this subprocess
export AWS_PROFILE=dev

# Command 2 — this is a NEW subprocess, AWS_PROFILE is not set here
aws s3 ls   # Uses [default], NOT dev
```

**Chaining commands in a single invocation** also works but is less practical for multi-step workflows:

```shell
export AWS_PROFILE=dev && aws s3 ls && aws sts get-caller-identity
```

**Summary for skill/agent authors:** After running `npx switch-profile` to make sure the SSO login is valid, extract the profile name and use `AWS_PROFILE=<name>` as an inline prefix on every subsequent AWS command. If the SSO login expires during a long task, `aws sso login --profile <name>` (with `--use-device-code` on a remote machine) renews it without changing the default profile.

## Shell support

### CMD on Windows is not supported

`sp` exists for zsh, bash, fish and PowerShell only. In CMD, run the `set AWS_PROFILE=<name>` command shown after each switch.

Note that `switch-profile` cannot tell CMD and PowerShell apart (neither sets `SHELL`). On Windows it always targets the PowerShell profile, so enabling per-terminal switching from CMD installs `sp` for PowerShell, not for CMD.

### PowerShell execution policy

`sp` is defined in your PowerShell profile script (`$PROFILE.CurrentUserAllHosts`). If the execution policy blocks scripts, PowerShell does not load the profile and `sp` is not found. `switch-profile` prints this fix when it installs `sp`:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## Upgrades and downgrades

### Running switch-profile 1.x again

Version 1.x does not know about the 2.x format. If you run it after upgrading (for example `npx switch-profile@1`), it writes temporary keys plus its custom `profile` and `expiry_date` keys back into `[default]` of `~/.aws/credentials`. Those keys take precedence over the SSO settings in `[default]` of `~/.aws/config`, and they expire after about an hour.

The next run of 2.x detects the 1.x keys and repairs `[default]` automatically (with backups), using the profile 1.x selected. Until then, tools using `[default]` run on the copied keys. Avoid mixing versions; if you must, run 2.x afterwards.

### Log in again after the legacy SSO upgrade

When legacy SSO profiles are upgraded to the `[sso-session]` format, the AWS CLI stores the SSO token under the session name instead of the start URL. The existing login is not reused, so you log in once per session the next time you use those profiles. The same happens when a new SSO profile is created without a session name and `switch-profile` adds one.

## Tools that cannot read SSO profiles

Almost every current AWS tool can resolve credentials from an SSO profile in `[default]`. A few cannot, such as the AWS SDK for Java 1.x, or older SDK versions (for example of the Rust SDK) that only understand the legacy SSO format and not `[sso-session]`. For those, add a `credential_process` to the profile they use, so the AWS CLI produces the credentials:

```ini
[profile legacy-tool]
credential_process = aws configure export-credentials --profile dev --format process
```

The AWS CLI refreshes the credentials as long as the SSO login of `dev` is valid.
