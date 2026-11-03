# Troubleshooting

Start with the error's `hint`. For more detail, look in `~/.switch-profile/switch-profile.log`: it has every run, AWS CLI call with its output, and error chain, with secrets redacted, so it is safe to read and share. For a stack trace, run the command again with `--debug` and without `--json`.

In the commands below, `sp-cli` stands for `npx --yes switch-profile@latest`. Add `--no-input --json` as usual.

| Symptom | Cause | Fix |
|---|---|---|
| `Invalid start url provided`, `Invalid request`, `invalid_request`, `InvalidRequestException`, `invalid_grant` during a login | **Wrong SSO region.** The URL is almost always fine, whatever the message says. It must be the region of IAM Identity Center, not where they deploy | `sp-cli portals <name> --check`. Propose `detectedRegion` and, once confirmed, `sp-cli portals <name> --region <r>`, then log in again. If it is `null`, ask the user (Identity Center console, Settings) |
| A login fails with a wrong region, on a profile with `"legacySso": true` | It has no portal to edit, so `portals` does not list it | `sp-cli settings --upgrade-legacy-sso` (confirm first), then fix the new portal as above |
| `<profile> needs a login` (exit 2) | Missing or expired session | [SKILL.md section 4](../SKILL.md#4-logging-in) |
| `Error loading SSO Token`, `session has expired` | Same | Same. No need to recreate the profile |
| `Not logged in to <portal>` on `add --from-sso` (exit 2) | No valid token for the portal | `sp-cli login --sso-session <portal> --device` |
| `Logged in, but <profile> still has no access` | The login worked, but this account or role is not assigned to the user | Check `sp-cli add --from-sso <portal> --dry-run`, which lists what they can access. If it is missing, their administrator must assign it |
| `Could not get credentials for <profile>` | Keys, process or role profile whose credentials fail | Read the AWS message in `hint`. Keys may be disabled or wrong: the user fixes them in their terminal |
| `There is no [sso-session X]`, `There is no SSO portal named X` (exit 3) | Unknown portal | `sp-cli portals`, or create it ([setup.md](setup.md)) |
| `<name> is the current default profile` on `remove` (exit 3) | The default cannot be removed | Confirm with the user, `sp-cli use <another>`, then remove |
| `"x" matches N profiles` (exit 3) | Ambiguous search | Offer the candidates and use `use <exact-name>`. Never pick for the user |
| `This command is interactive` (exit 3) | `add` with no kind flag | Choose a kind: [setup.md](setup.md) |
| `error: unknown option '--...'` | Older CLI: these flags need 2.6.0+ | Use `switch-profile@latest`. If `--version` is still older, this release is not published yet: tell the user |
| `error: option '--...' argument missing`, `error: missing required argument` (exit 1, plain text) | A flag or argument has no value | Add it, using [commands.md](commands.md) |
| `<name> is not an AWS region` | The value is not shaped like a region | Check for a typo. Regions look like `ap-southeast-2` |
| The CLI says its files use a newer format and to run the latest version | An older version is running | Use `switch-profile@latest` |
| `The AWS CLI is not installed` | No AWS CLI, or it is not on `PATH` | Install AWS CLI v2 |
| `AWS CLI version 1 is not supported` | AWS CLI v1 | Upgrade to v2 |
| `'aws login' needs AWS CLI 2.32 or later` | Old AWS CLI | Update it, or use SSO |
| `switch-profile needs Node.js 20.12 or later` | Old Node | Update Node |
| `The config profile (old) could not be found` | Something still uses a renamed or removed name | Update `AWS_PROFILE`, the script, CI, kubeconfig or Terraform setting. A `credential_process` with `--profile <old>` is not rewritten |
| A command uses the wrong account | Environment variables override profiles, or the prefix was missing | Check that `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` and `AWS_DEFAULT_PROFILE` are unset, without printing them. Prefix with `AWS_PROFILE=<name>` and confirm with `aws sts get-caller-identity` |
| The wrong region is used | `AWS_REGION` or `AWS_DEFAULT_REGION` is set | They win over the profile's region. Tell the user, and do not unset them silently |
| The default changed by itself | Another terminal or person switched. `[default]` is shared | Do not depend on the default: prefix `AWS_PROFILE` |
| `[default]` holds temporary keys, or credentials expire after an hour | switch-profile 1.x ran again | The next run of a current version repairs it, with backups. Avoid `switch-profile@1` |
| Output stopped mid-JSON with a stack trace | An unexpected error (exit 1) | Read the log. It is a bug: report it at https://github.com/nicolasdao/switch-profile/issues |

## Problems the user sees in their own terminal

Pass these on.

| Symptom | Fix |
|---|---|
| `sp: command not found` | The terminal was opened before `sp` was set up. Open a new one, or run the `reload` command from `settings`. |
| `sp` is missing after `settings --shortcut on`, in PowerShell | Their execution policy blocks the profile: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| Tab-completion does not work in zsh | The block must come after `compinit`, or after the line that loads oh-my-zsh, in `~/.zshrc` |
| Windows CMD has no `sp` | Run the `set AWS_PROFILE=<name>` command shown after each switch |
| An SSO login hangs on a remote machine | The AWS CLI is waiting for a browser there: use `--device`, or `settings --login-mode device` |
| The code is not in their clipboard over SSH | Their terminal or tmux blocks OSC 52. In tmux: `set -g set-clipboard on`. Otherwise they copy it from the screen |
| A tool cannot read SSO profiles (AWS SDK for Java 1.x, very old SDKs) | Add a profile by hand with `credential_process = aws configure export-credentials --profile <name> --format process` |
