# Gotchas

Critical pitfalls and edge cases that are not immediately obvious when using `switch-profile`.

## Table of Contents

- [Profile switching is global by default](#profile-switching-is-global-by-default)
    - [The problem](#the-problem)
    - [The solution: `export AWS_PROFILE`](#the-solution-export-aws_profile)
    - [The limitation: you must copy-paste it yourself](#the-limitation-you-must-copy-paste-it-yourself)
    - [LLM agents and automation](#llm-agents-and-automation)

## Profile switching is global by default

### The problem

When you run `npx switch-profile` and select a profile, the tool writes credentials into the `[default]` section of `~/.aws/credentials` and `~/.aws/config`. These are **global files** shared by every terminal, every tool, and every process on the machine.

This means:
- If Terminal A switches to `dev`, Terminal B is now also on `dev`.
- If Terminal B then switches to `prod`, Terminal A is silently moved to `prod` too.
- Any concurrent process relying on `[default]` (Terraform, CDK, scripts) is affected immediately.

### The solution: `export AWS_PROFILE`

After every successful switch, `switch-profile` displays a box like:

```
┌─────────────────────────────────────────────────────────┐
│  To lock this profile to this terminal session, run:    │
│                                                         │
│    export AWS_PROFILE=dev                               │
│                                                         │
│  This prevents other terminals from affecting this one. │
└─────────────────────────────────────────────────────────┘
```

Running the displayed command sets an environment variable **scoped to that terminal session only**. The AWS CLI and all AWS SDKs honor `AWS_PROFILE` and will use the named profile directly — bypassing `[default]` entirely. Other terminals remain unaffected.

On **Linux / macOS**: `export AWS_PROFILE=dev`
On **Windows (PowerShell)**: `$env:AWS_PROFILE = "dev"`
On **Windows (CMD)**: `set AWS_PROFILE=dev`

### The limitation: you must copy-paste it yourself

`switch-profile` **cannot** set the environment variable for you. This is a fundamental operating system constraint: a child process (the `npx` command) cannot modify the environment of its parent process (your terminal shell). The displayed command (`export` on Unix, `$env:` on PowerShell, `set` on CMD) must be run directly in the terminal by the user.

There is no workaround for this within the tool itself. The user must manually copy-paste and run the `export AWS_PROFILE=<name>` command shown after each switch.

### LLM agents and automation

When an LLM agent (e.g., a Claude Code skill) uses `switch-profile` via a shell tool, the same constraint applies — but with an additional twist.

**Environment variables do not persist between shell tool invocations.** Each time an LLM agent runs a Bash command, it spawns a **new shell subprocess**. So even if the agent runs `export AWS_PROFILE=dev` in one command, that variable is gone in the next command.

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

**Summary for skill/agent authors:** After running `npx switch-profile` to authenticate and ensure the SSO session is valid, extract the profile name and use `AWS_PROFILE=<name>` as an inline prefix on every subsequent AWS command.
