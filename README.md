# switch-profile

An interactive CLI tool for switching between AWS profiles directly from your terminal. No more manually editing `~/.aws/credentials` or juggling environment variables.

```shell
npx switch-profile
```

## Why?

AWS SSO credentials expire every hour. Without `switch-profile`, refreshing them means either:

1. **Manual copy-paste** - Browse to the SSO portal, log in, reveal credentials, paste them into your terminal or `~/.aws/credentials` file. Repeat every hour.
2. **Per-command `--profile` flag** - Use `aws sso login --profile <name>`, but then every command (and every tool like Terraform) needs `--profile`. Not always possible or practical.

`switch-profile` makes setting any AWS profile as `default` trivial - one command, pick from a list, done. It handles SSO session refresh automatically, including opening the browser for re-authentication when sessions expire.

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
1. Show your current default profile with its expiry status.
2. List all available profiles.
3. Let you pick one to set as the new `default`.

For SSO profiles, if the session has expired, it automatically opens your browser for re-authentication.

### Create a new profile

```shell
npx switch-profile
# Select "More options" > "Create profile"
```

You can create:
- **Standard profiles** - Access key + secret key pair.
- **SSO profiles** - Launches the interactive `aws configure sso` flow.

### Delete profiles

```shell
npx switch-profile
# Select "More options" > "Delete profiles"
```

Select one or more profiles to remove. The current default profile cannot be deleted (switch to another one first).

### Refresh an expired profile

```shell
npx switch-profile
# Select "More options" > "Refresh default profile"
```

This option only appears when the current default profile has expired. It forces a new SSO login and refreshes the credentials.

## How It Works

`switch-profile` manages two AWS configuration files:

| File | Purpose |
|------|---------|
| `~/.aws/config` | Stores profile settings (region, output format, SSO metadata) |
| `~/.aws/credentials` | Stores access keys, secret keys, and session tokens |

When you select a profile, `switch-profile`:
1. Retrieves the credentials for that profile (from cache or via SSO login).
2. Writes them into the `[default]` section of both files.
3. Records the profile name and expiry date for status display.

For SSO profiles specifically, it leverages two additional AWS CLI cache directories:
- `~/.aws/sso/cache/` - SSO session tokens (long-lived, ~24 hours)
- `~/.aws/cli/cache/` - Temporary AWS credentials (short-lived, ~1 hour)

## Detailed Documentation

For deeper technical details, see the docs below:

| Document | Description |
|----------|-------------|
| [Architecture](docs/architecture.md) | Project structure, source files, and how the components fit together |
| [AWS Profile Management](docs/aws-profile-management.md) | How AWS profiles, SSO sessions, and credentials are managed internally |
| [CLI Interface](docs/cli-interface.md) | Detailed walkthrough of every menu, prompt, and user flow |
| [Configuration Files](docs/configuration-files.md) | Exact formats of all AWS and internal configuration files |
| [Development Guide](docs/development-guide.md) | How to set up, develop, test, lint, and release |

## Troubleshooting

### `invalid_grant: Invalid grant provided`

This error occurs during SSO profile creation when the **wrong SSO region** is specified. AWS SSO is region-specific - you must use the region where your SSO instance is configured, not the region you want to deploy resources to.

**Fix:** Delete the profile and recreate it with the correct SSO region.

### `Error: Fail to get credentials for profile ... Error loading SSO Token...`

This typically happens after the `~/.aws/sso/cache` folder has been deleted or corrupted. This folder tracks SSO sessions and cannot be reconstructed automatically.

**Fix:** Delete the affected SSO profiles and recreate them:

1. Run `npx switch-profile`
2. Select **More options** > **Delete profiles**
3. Remove the broken SSO profiles
4. Recreate them via **More options** > **Create profile**

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
