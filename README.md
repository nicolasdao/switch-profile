# switch-profile

An interactive CLI tool for switching between AWS profiles directly from your terminal. No more manually editing `~/.aws/config` or juggling environment variables.

```shell
npx switch-profile
```

## Why?

Working with several AWS accounts usually means one of these:

1. **Per-command `--profile` flag** - Every command (and every tool like Terraform or CDK) needs `--profile`. Not always possible or practical.
2. **Editing `~/.aws/config` by hand** - Copying settings into `[default]` each time you change account.
3. **Fighting SSO logins** - Remembering which portal to log in to, and finding that `aws sso login` hangs when you are on a remote machine over SSH.

`switch-profile` makes this one command: pick a profile from a list, done.

- **Switch** - The selected profile becomes the `default`, so every AWS tool uses it without a `--profile` flag.
- **Auto-refresh** - `switch-profile` copies the profile's *settings* into `[default]`, not temporary credentials. The AWS CLI, SDKs and Terraform then get and refresh credentials on their own. With an `[sso-session]` profile, you only log in again when your SSO session ends (8 hours by default).
- **Per-terminal** - Run `sp` instead of `npx switch-profile` and the profile is applied to the current terminal only (`AWS_PROFILE`), so different terminals can use different accounts at the same time.
- **Remote machines** - Over SSH, the SSO login automatically uses a device code: you get a URL and a code that you approve from your laptop or phone.

## Prerequisites

- **[AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)** - Version 2 or later is required.
- **Node.js** - Any recent version that supports `npx`.

> **Important:** Remove these environment variables from your shell if they are set, as they override the default profile and will conflict with `switch-profile`:
> - `AWS_ACCESS_KEY_ID`
> - `AWS_SECRET_ACCESS_KEY`
> - `AWS_SESSION_TOKEN`

## Installation

No installation needed. Run directly with npx:

```shell
npx switch-profile
```

Or install globally:

```shell
npm install -g switch-profile
switch-profile
```

## Quick Start

### Switch between existing profiles

```shell
npx switch-profile
```

This will:
1. Show your current default profile and its SSO login status.
2. List all available profiles.
3. Let you pick one to set as the new `default` (logging in to SSO first if needed).
4. Apply the profile to the current terminal if you launched it with `sp`, or show the `export AWS_PROFILE=<name>` command otherwise.

The first time you switch, `switch-profile` asks **"Enable per-terminal switching?"**. Answer yes to add the `sp` shortcut to your shell startup file. Then open a new terminal and use:

```shell
sp
```

`sp` works exactly like `npx switch-profile`, but also sets `AWS_PROFILE` in the terminal you ran it from. Your answer is remembered; you can change it later in **More options** > **Settings**.

### Create a new profile

```shell
npx switch-profile
# Select "More options" > "Create profile"
```

You can create:
- **Standard profiles** - Access key + secret key pair.
- **SSO profiles** - Launches the interactive `aws configure sso` flow. Give the SSO session a name (and reuse it for every profile of the same portal) so one login covers them all. If you skip it, `switch-profile` adds one for you.

### Delete profiles

```shell
npx switch-profile
# Select "More options" > "Delete profiles"
```

Select one or more profiles to remove. The current default profile cannot be deleted (switch to another one first).

### Log in again

```shell
npx switch-profile
# Select "More options" > "Log in again (default profile <name>)"
```

This option only appears when the SSO login of the current default profile has expired or is missing. It runs `aws sso login` for that profile. Switching to an SSO profile also logs in automatically when needed.

## How It Works

`switch-profile` manages two AWS configuration files:

| File | Purpose |
|------|---------|
| `~/.aws/config` | Stores profile settings (region, output format, SSO and role settings) |
| `~/.aws/credentials` | Stores access keys for standard profiles |

When you select a profile, `switch-profile`:
1. For SSO profiles, checks that the profile can produce credentials (`aws configure export-credentials`). If not, it runs `aws sso login --profile <name>` in your terminal, so you can see the login URL and code.
2. Copies the profile's settings (for example `sso_session`, `sso_account_id`, `sso_role_name`, `region`, `role_arn`) into `[default]` of `~/.aws/config`, and records which profile it is.
3. For standard profiles, copies the access keys into `[default]` of `~/.aws/credentials`. For other profiles, removes `[default]` from that file, because static keys there would win over the SSO settings.
4. Applies the profile to the current terminal (`sp`), or shows the `export AWS_PROFILE=<name>` command.

No temporary credentials are written to disk by `switch-profile`. AWS tools resolve them from `[default]` and refresh them automatically, using the AWS CLI's SSO cache in `~/.aws/sso/cache/`.

See [Configuration Files](docs/configuration-files.md) for the exact formats.

### Per-terminal profile isolation

Switching updates the global `[default]`, which affects every terminal and every tool that does not set a profile. To use different profiles in different terminals at the same time, use `sp`:

- `sp` is a small shell function that `switch-profile` adds to your shell startup file, inside a block marked `# >>> switch-profile ... >>>` / `# <<< switch-profile <<<`. Do not edit that block: `switch-profile` rewrites it when a new version changes it.
- When you pick a profile through `sp`, the function sets `AWS_PROFILE` in the current terminal. Other terminals are unaffected.
- `sp` uses the global `switch-profile` command if it is installed, and `npx --yes switch-profile` otherwise.

Supported shells:

| Shell | Startup file |
|-------|--------------|
| zsh | `${ZDOTDIR:-~}/.zshrc` |
| bash | `~/.bashrc` (Linux), `~/.bash_profile` (macOS) |
| fish | `~/.config/fish/config.fish` |
| PowerShell | `$PROFILE.CurrentUserAllHosts` (for `pwsh` and/or Windows PowerShell) |

CMD on Windows is not supported: run the `set AWS_PROFILE=<name>` command shown after each switch. In PowerShell, if your profile script is blocked, allow local scripts with `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

If `sp` is not found right after enabling it, the terminal has not loaded it yet: open a new terminal or run `source ~/.zshrc` (or your shell's equivalent).

## Remote machines (SSH)

Since AWS CLI 2.22.0, `aws sso login` opens a browser on the same machine by default. On a remote machine reached over SSH, there is no browser, so the login hangs. `switch-profile` avoids this by passing `--use-device-code` when it detects a remote session (`SSH_CONNECTION`, `SSH_CLIENT` or `SSH_TTY` is set, or Linux without `DISPLAY`/`WAYLAND_DISPLAY`). The AWS CLI then prints a URL and a code that you approve from any device. Older AWS CLI versions always use the device code, so the flag is never passed to them.

You can force the behavior in **More options** > **Settings** > **Change SSO login mode** (`auto`, `device` or `browser`).

For long-running remote work:

- **Use `[sso-session]` profiles.** They refresh credentials on their own. Legacy SSO profiles (without `sso_session`) need a new login every time the token expires. `switch-profile` offers to upgrade them.
- **Raise the SSO session duration.** How often you must log in is set by the IAM Identity Center "user interactive session" duration (8 hours by default, up to 90 days), configured by your AWS administrator. The permission set session duration (1 to 12 hours) does not matter much: role credentials are refreshed automatically while the SSO session is valid.

## Settings

```shell
npx switch-profile
# Select "More options" > "Settings"
```

The Settings screen shows:
- Per-terminal switching: disabled, enabled and active in this terminal, or enabled but not loaded in this terminal.
- SSO login mode: `auto` (default), `device` or `browser`.
- Legacy SSO profiles that have no auto-refresh.
- The settings file (`~/.switch-profile/settings.json`) with its format version and the `switch-profile` version that last wrote it.

From there you can enable or disable per-terminal switching, change the SSO login mode, and upgrade legacy SSO profiles.

## Upgrading from 1.x

Version 1.x copied temporary credentials into `[default]` of `~/.aws/credentials`, which expired after about an hour. Version 2 upgrades your setup automatically the first time it runs:

- `~/.aws/config` and `~/.aws/credentials` are backed up next to themselves (for example `~/.aws/config.bak-2026-10-01T10-12-00Z`).
- `[default]` is rewritten in the new format for the profile you last selected, and the 1.x `profile` and `expiry_date` keys are removed.
- A short notice lists what changed and where the backups are.

If some SSO profiles use the legacy format (no `sso_session`), you are asked once whether to upgrade them to the `[sso-session]` format. Profiles from the same portal share one session, so one login covers them all. After the upgrade, you log in once per session. If you decline, you can upgrade later in **More options** > **Settings**.

If you run 1.x again later (for example `npx switch-profile@1`), it writes temporary keys back into `[default]`. The next run of version 2 detects this and repairs `[default]` (with backups). See [Gotchas](docs/gotchas.md).

## Detailed Documentation

For deeper technical details, see the docs below:

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | Project structure, source files, and how the components fit together |
| [AWS Profile Management](docs/aws-profile-management.md) | How AWS profiles, SSO sessions, migrations and per-terminal switching work internally |
| [CLI Interface](docs/cli-interface.md) | Detailed walkthrough of every menu, prompt, and user flow |
| [Configuration Files](docs/configuration-files.md) | Exact formats of all AWS and internal configuration files |
| [Development Guide](docs/development-guide.md) | How to set up, develop, test, lint, and release |
| [Gotchas](docs/gotchas.md) | Critical pitfalls: global `[default]`, per-terminal limits, 1.x downgrades, LLM agent constraints |

## Troubleshooting

### `invalid_grant: Invalid grant provided`

This error occurs during SSO profile creation when the **wrong SSO region** is specified. AWS SSO is region-specific - you must use the region where your SSO instance is configured, not the region you want to deploy resources to.

**Fix:** Delete the profile and recreate it with the correct SSO region.

### `Error loading SSO Token` or `The SSO session associated with this profile has expired`

The SSO login is missing or expired, for example because `~/.aws/sso/cache` was deleted or the SSO session duration has passed.

**Fix:** Log in again. Either switch to the profile again (`switch-profile` logs in when needed), or select **More options** > **Log in again**. You can also run `aws sso login --profile <name>` yourself. There is no need to delete and recreate the profile.

### SSO login hangs on a remote machine

The AWS CLI is waiting for a browser on the remote machine. Set **More options** > **Settings** > **Change SSO login mode** to **Always device code**. See [Remote machines (SSH)](#remote-machines-ssh).

### `sp: command not found`

The current terminal was opened before per-terminal switching was enabled. Open a new terminal or run `source ~/.zshrc` (or your shell's equivalent). Check **More options** > **Settings** to see whether it is enabled.

### AWS CLI not found

`switch-profile` requires AWS CLI v2. Install it for your platform:

**macOS:**
```shell
brew install awscli
brew link --overwrite awscli
```

**Linux:**
```shell
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install
```

**Windows:** Download and run the [AWS CLI MSI installer](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html).

## License

[BSD 3-Clause](LICENSE)
