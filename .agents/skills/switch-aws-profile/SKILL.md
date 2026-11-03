---
name: switch-aws-profile
description: Switch AWS profile and log in or out of AWS SSO via switch-profile. Use when changing or checking the AWS account, listing, adding, renaming or removing profiles, an expired session, or an IAM Identity Center portal. Not for AWS service commands.
argument-hint: "[what you want, in plain words]"
allowed-tools: Bash, Read, AskUserQuestion
---

# switch-aws-profile

You operate the `switch-profile` CLI for the user, from plain language. They say what they want ("add the Acme accounts", "am I on prod?", "log me back in"), you pick the command, make the setup decisions with them, and report the result in their words.

**Nothing is installed.** `npx` fetches the CLI on each run.

## 1. Preflight (once per session)

```bash
node --version                               # must be 20.12.0 or later
aws --version                                # must be AWS CLI v2
npx --yes switch-profile@latest --version    # must be 2.6.0 or later
```

- **Node older than 20.12.0:** the CLI refuses to start. Ask the user to update Node (nvm, fnm, or their package manager).
- **AWS CLI missing or v1:** the CLI refuses to start. It wraps the official AWS CLI, which does every login. Install it from https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html. Version 2.22+ gives clean device code logins; console sign-in needs 2.32+.

## 2. How to call it

Every command, every time:

```bash
npx --yes switch-profile@latest <command> <args> --no-input --json
```

- `--no-input` guarantees it never waits on a prompt, even if your shell has a terminal attached.
- `--json` puts the result on stdout. Expected errors go to stderr as `{"error", "hint", "code"}`, on the last line: a login writes the AWS CLI's output there first. It also hides the CLI's warnings, so check `prod` and compare accounts yourself ([commands.md](references/commands.md#switching)).
- Read `hint`: it usually names the exact next command.

| Exit | Meaning | What you do |
|---|---|---|
| 0 | OK | Report the result |
| 1 | Error, including a usage error, printed as plain text (`error: option ... argument missing`) | Read the message, then [references/troubleshooting.md](references/troubleshooting.md). Details are in `~/.switch-profile/switch-profile.log` (secrets redacted) |
| 2 | Login required, or a login failed | [Section 4](#4-logging-in). If stderr mentions `invalid_request` or `Invalid start url`, the SSO region is wrong: see troubleshooting |
| 3 | Bad input: unknown or ambiguous name, missing flag | Fix it from `hint`, or ask the user. Never guess a profile name |
| 130 | Cancelled | Stop and say so |

**`sp` and `export AWS_PROFILE` do nothing for you.** `sp` is the shell function for humans, and your shell does not keep environment variables between calls. To run something in a profile, prefix that one command:

```bash
AWS_PROFILE=acme-dev aws s3 ls
```

## 3. What the user asks for

| The user wants | Do this |
|---|---|
| See profiles, "which account am I on?" | `status` |
| Run an AWS command in an account | Do **not** switch. Prefix it with `AWS_PROFILE=<name>` |
| Change the machine's default profile | `use <exact-name>` ([read the warning below](#switching-changes-every-terminal)) |
| Switch by a partial name | `<words...>`: switches only on a unique match, else exits 3 with candidates to offer |
| Log in, "my session expired" | [Section 4](#4-logging-in) |
| Add a client, company or SSO portal | [references/setup.md](references/setup.md), import path |
| Add one SSO profile | [references/setup.md](references/setup.md), single SSO path |
| Add a console sign-in profile | [references/setup.md](references/setup.md), console sign-in path |
| Add access keys | Hand off to the user: [Section 5](#5-what-only-the-human-can-do) |
| Pick up new accounts of a portal | `add --from-sso <session> --region <r> --dry-run`, then the same without `--dry-run` |
| List portals, check their region | `portals --check` |
| Fix a portal's start URL or SSO region | `portals <name> --region <r>` and/or `--start-url <url>` |
| Give a profile a better name | `rename <profile> <new-name>` |
| Remove profiles | `remove <names...> --yes`, after confirming |
| End every SSO session | `logout --yes`, after confirming |
| See or change settings | `settings`, `settings --login-mode <auto\|device\|browser>`, `settings --shortcut <on\|off>`, `settings --upgrade-legacy-sso` |

Every flag, JSON shape and side effect is in [references/commands.md](references/commands.md). Read it before using a command you have not used this session. Never invent a flag.

### Switching changes every terminal

`use` rewrites `[default]` in `~/.aws/config`. Every terminal and process without its own `AWS_PROFILE`, including a deploy already running, follows it at once. Most requests do not need a switch: prefer the prefix. Switch only when the user asks to change the default, and warn them first if the target has `"prod": true`.

## 4. Logging in

Check first with `status`: each SSO profile has `needsLogin`. That reads the local token cache only, so for the real answer run `AWS_PROFILE=<name> aws sts get-caller-identity`.

A login blocks until a human approves it. **Run it in the background** (or with a timeout of several minutes):

```bash
npx --yes switch-profile@latest login <profile> --device --no-input --json        # a profile
npx --yes switch-profile@latest login --sso-session <portal> --device --no-input --json   # a portal with no profile yet
```

1. The AWS CLI prints a URL and a code on stderr. Read them as soon as they appear.
2. Relay both to the user, word for word, and add: **"Only approve if the page shows exactly this code."**
3. Wait for the command to exit. Exit 0 prints the result as JSON. Then confirm with the identity check above.

Never approve, guess or reuse a code yourself. Only relay a code from a login you started for this user: a device code from anywhere else is a known phishing route.

Prefer `--device`: it works over SSH and from any device. Use `--browser` only when the user says they are sitting at this machine and it has a browser.

Console sign-in profiles (`"kind": "login"`) log in with the same `login <profile>` when this machine has a browser. Without one, exit 2 means [hand off to the user](#5-what-only-the-human-can-do). Keys and process profiles have nothing to log in to (exit 3).

## 5. What only the human can do

Tell the user to run these **in their own terminal**. Do not try to drive them through a fake terminal.

| Task | Command | Why it cannot go through you |
|---|---|---|
| Add access keys | `npx switch-profile add`, then Access keys | The secret must never enter this conversation or a command line. First recommend SSO or console sign-in |
| Console sign-in on a machine with no browser | `npx switch-profile add`, or `npx switch-profile login <profile>` | `aws login --remote` needs a code pasted into a terminal |

Everything else, including everything on the interactive home screen, has a flag.

## 6. Constraints

- **ALWAYS** pass `--no-input --json`, and use `npx --yes switch-profile@latest`.
- **ALWAYS** confirm with AskUserQuestion first, naming exactly what changes:
  - `logout`: it ends every SSO session on this machine, for every project
  - `remove`, and `add --prune`. The CLI refuses or keeps the default and any role's `source_profile`, and says so
  - `use` when the target has `"prod": true`, or when the user did not ask to change the default
  - `rename`: anything else using the old name breaks until updated
  - `portals <name> --region` or `--start-url`: it changes every profile of that portal
  - `settings --shortcut`: it edits the shell startup file
  - `settings --upgrade-legacy-sso`: it rewrites the profiles, and everyone logs in again
- **ALWAYS** run `add --from-sso` with `--dry-run` first and show the result: without a terminal it adds every new profile with no further question.
- **ALWAYS** treat a region read from a portal page as a suggestion the user confirms. It comes from an undocumented header.
- **NEVER** read, print or copy `~/.aws/credentials` or `~/.aws/sso/cache`, ask for an access key or secret, or export `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY`.
- **NEVER** edit `~/.aws/config` by hand for something a command can do. The CLI writes atomically and keeps its references consistent.
- **NEVER** run `npx switch-profile` without `--no-input` and arguments: that opens a full-screen interface you cannot see.
- If the machine has its own rules for AWS access or shell files (a CLAUDE.md, a dotfiles repo), those rules win.

## References

- [references/setup.md](references/setup.md): read before creating anything. The decisions and their right answers: profile kind, SSO region, default region, names, login mode.
- [references/commands.md](references/commands.md): the complete catalog of commands, flags, JSON output, files and environment variables.
- [references/troubleshooting.md](references/troubleshooting.md): read when something fails. Each symptom and its fix.
