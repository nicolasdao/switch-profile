# CLI Interface

This document provides a detailed walkthrough of every menu, prompt, and user flow in `switch-profile`.

## Invocation

```shell
npx switch-profile          # Run via npx (no install)
switch-profile              # If installed globally
sp                          # Per-terminal shortcut (once enabled): same menus, also sets AWS_PROFILE here
npx switch-profile switch   # Explicit command (same as default)
npx switch-profile --version  # Print version number
```

The `switch` command is the only command and runs automatically when no arguments are provided. `sp` passes its arguments through to `switch-profile`.

## Main Flow

### Step 1: AWS CLI Check

Before anything else, the tool verifies AWS CLI v2+ is installed. If not found, it prints platform-specific installation instructions:

- **macOS:** `brew install awscli && brew link --overwrite awscli`
- **Linux:** curl + unzip instructions for the AWS CLI v2 installer
- **Windows:** "Not installed" message with a link to the AWS CLI MSI installer download page

### Step 2: Startup (migrations and upkeep)

On every run, before the menu:

1. **Newer format check.** If `~/.switch-profile/settings.json` was written by a newer `switch-profile` with a newer format, the tool stops:
   ```
   ERROR - Your AWS profiles were last managed by switch-profile 3.0.0, which is newer than this version (2.0.0). Please run the latest version: npx switch-profile@latest
   ```
2. **1.x migration.** If `[default]` of `~/.aws/credentials` was written by 1.x, it is migrated silently and a notice is printed:
   ```
   switch-profile 2.0.0 upgraded your AWS setup:
     - [default] now holds profile sso-dev's settings instead of copied temporary credentials, so AWS tools refresh credentials on their own.
     - Backups: /home/me/.aws/config.bak-2026-10-01T10-12-00Z, /home/me/.aws/credentials.bak-2026-10-01T10-12-00Z
   ```
3. **Legacy SSO upgrade prompt.** If some profiles use the legacy SSO format and the user has not declined before:
   ```
   2 profiles use the old SSO format, which has no auto-refresh: sso-dev, sso-prod
   ? Upgrade them to the [sso-session] format? You will log in once per SSO portal. (Y/n)
   ```
   Yes prints the backups and the sessions created (e.g., `[sso-session acme] (https://acme.awsapps.com/start): sso-dev, sso-prod`). No is remembered (`OK. You can upgrade later in More options > Settings.`).
4. **`sp` update.** If the installed `sp` block differs from the one this version writes, it is rewritten:
   ```
   Updated the sp shortcut in ~/.zshrc. Open a new terminal to use the new version.
   ```

### Step 3: Default Profile Status

If a default profile is set, it displays the current status. For SSO profiles, the login state is read from `~/.aws/sso/cache`:

```
Current default profile: sso-dev
 INFO: SSO login active, auto-refresh on           # Cyan - [sso-session] login with refresh token
```

```
Current default profile: sso-legacy
 INFO: SSO login expires in 42 minutes (no auto-refresh)   # Cyan - legacy SSO profile
```

```
Current default profile: sso-dev
 WARNING: SSO login expired                         # Yellow - enables "Log in again"
```

```
Current default profile: sso-dev
 WARNING: Not logged in                             # Yellow - enables "Log in again"
```

```
Current default profile: unknown (pick one up in the list below and we'll remember next time)
```

Standard profiles show only the first line. If `AWS_PROFILE` is set in the terminal to a different profile, a second line is added:

```
This terminal uses: sso-prod (AWS_PROFILE, overrides the default)
```

### Step 4: Profile List

If profiles exist, the main selection menu appears:

```
? Choose one of the following 3 profiles:
  More options
  Abort
  ──────────────
  1. sso-dev (SSO [role:Admin - account:123456789012])
  2. sso-prod (SSO [role:ReadOnly - account:987654321098])
  3. my-standard-profile
```

- **SSO profiles** include role and account info in their display name.
- **Standard profiles** show just the profile name.
- The list supports up to 20 items per page.

If no profiles exist, you get:

```
? There no profiles yet. Do you wish to create one now? (Y/n)
```

### Step 5a: Select a Profile

Selecting a profile from the list sets it as the `default`. For SSO profiles, the tool first checks the login with `aws configure export-credentials`. If the login is missing or expired, it runs `aws sso login` in the terminal:

- **Browser mode:** the AWS CLI opens the browser on this machine.
- **Device code mode** (default over SSH): the AWS CLI prints a URL and a code to approve from any device.

The tool waits until the AWS CLI exits, then checks the credentials again.

On success:

```
AWS profile sso-dev successfully set up as default.   # Green
```

What follows depends on how the tool was launched (see [After the switch](#after-the-switch)).

### Step 5b: More Options

Selecting "More options" opens a submenu:

```
? Options:
  Log in again (default profile sso-dev)   # Only shown when the SSO login is expired or missing
  Create profile
  Delete profiles
  Settings
  Abort
```

## After the switch

This runs after every successful switch, log in again, or new profile set as default.

**Launched through `sp`:** the profile name is handed to the `sp` function, which sets `AWS_PROFILE` in the current terminal:

```
This terminal now uses sso-dev (AWS_PROFILE).   # Green
```

**Otherwise**, the export hint is shown first.

Linux / macOS:
```
┌─────────────────────────────────────────────────────────┐
│  To lock this profile to this terminal session, run:    │  # Cyan
│                                                         │
│    export AWS_PROFILE=sso-dev                           │  # Cyan + Bold
│                                                         │
│  This prevents other terminals from affecting this one. │
└─────────────────────────────────────────────────────────┘
```

Windows:
```
┌──────────────────────────────────────────────────────────────┐
│  To lock this profile to this terminal session, run:         │  # Cyan
│                                                              │
│    PowerShell:  $env:AWS_PROFILE = "sso-dev"                 │  # Cyan + Bold
│    CMD:         set AWS_PROFILE=sso-dev                      │  # Cyan + Bold
│                                                              │
│  This prevents other terminals from affecting this one.      │
└──────────────────────────────────────────────────────────────┘
```

Then, depending on the per-terminal switching state:

| State | Output |
|-------|--------|
| `sp` installed but not used in this terminal | `Tip: per-terminal switching is set up. Run sp instead of switch-profile ...` and `If sp is not found, this terminal hasn't loaded it yet: open a new terminal or run source ~/.zshrc`. In PowerShell, also the execution policy hint. |
| Not installed, never asked | `? Enable per-terminal switching? This adds a sp shortcut to ~/.zshrc, so you never have to copy the command above. (Y/n)`. The answer is remembered. |
| Not installed, already asked | `Tip: enable automatic per-terminal switching in More options > Settings.` |
| Shell not supported | Nothing more |

Answering yes to the prompt prints:

```
Done. Added the sp shortcut to ~/.zshrc.
Open a new terminal or run source ~/.zshrc, then use sp to switch profiles.
```

In PowerShell, it also prints: `If PowerShell refuses to load your profile, allow local scripts with: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Create Profile Flow

### Step 1: Profile Name

```
? Enter a profile name (alphanumerical lowercase and '-' characters only):
```

**Validation rules:**
- Cannot be empty.
- Only lowercase letters, numbers, dashes (`-`), and underscores (`_`).
- Minimum 2 characters.
- Cannot duplicate an existing profile name.

Invalid input produces a red error and re-prompts.

### Step 2: Profile Type

```
? Choose an AWS profile type:
  standard
  sso
```

### Step 3a: Standard Profile

```
? Enter the profile's access key: AKIA...
? Enter the profile's access secret key: wJal...
? Select a region: (type to search)
  us-east-2 - US East (Ohio)
  us-east-1 - US East (N. Virginia)
  us-west-1 - US West (N. California)
  ...
```

The region picker supports autocomplete - type to filter the list of 24 regions.

### Step 3b: SSO Profile

Selecting "sso" first displays an SSO Setup Guide with guidance on the prompts you're about to see:

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SSO Profile Setup Guide                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  You're about to run 'aws configure sso'. Here's what to expect:    │
│                                                                     │
│  1. SSO session name                                                │
│     Provide a name (e.g., "my-company-sso"). Reuse the same name    │
│     for every profile of the same SSO portal: one login covers all.  │
│     It enables automatic refresh (if skipped, switch-profile adds    │
│     one for you).                                                    │
│                                                                     │
│  2. SSO start URL                                                   │
│     Your AWS SSO portal URL (e.g., https://my-co.awsapps.com/start) │
│     Ask your AWS administrator if you don't have it.                 │
│                                                                     │
│  3. SSO region                                                      │
│     The region where your SSO instance is configured.                │
│     WARNING: This is NOT your deployment region.                     │
│     Using the wrong region causes "invalid_grant" errors.            │
│                                                                     │
│  Docs: https://docs.aws.amazon.com/cli/latest/userguide/            │
│        cli-configure-sso.html                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

Then it spawns the interactive `aws configure sso` command, which takes over the terminal:

```
SSO session name (Recommended): my-session
SSO start URL [None]: https://my-company.awsapps.com/start
SSO region [None]: us-east-1
SSO registration scopes [sso:account:access]:
...
```

This is the standard AWS CLI SSO setup flow. The user completes it directly. If the `aws configure sso` command fails (non-zero exit code), the error is reported and the profile is not marked as created.

If the session name was skipped, the profile is converted to the `[sso-session]` format:

```
No SSO session name was provided, so my-profile was converted to the [sso-session] format to enable auto-refresh. You will be asked to log in once more.
```

### Step 4: Set as Default

After creation, you're asked:

```
? Do you wish to set this new profile as the default? (Y/n)
```

If yes, the profile is immediately set as the `default` (triggering SSO login if needed), followed by [After the switch](#after-the-switch). If the profile is not found in `~/.aws/config` (e.g., because the creation partially failed), a clear error message is shown instead of crashing.

## Delete Profiles Flow

### Step 1: Select Profiles

```
? Select the profiles you wish to delete (SPACE to select, ENTER to confirm):
  ◯ 1. sso-dev (SSO [role:Admin - account:123456789012])
  ◯ 2. sso-prod (SSO [role:ReadOnly - account:987654321098])
  ◯ 3. my-standard-profile
```

This is a checkbox selection - you can select multiple profiles.

### Step 2: Confirmation

```
? Are you sure you want to delete those 2 profiles? (Y/n)
```

### Step 3: Validation

If you try to delete the current default profile:

```
ERROR - Fail to delete profiles. Profile sso-dev is the current default.
Set another profile as the default, then try deleting again.
```

You must switch to a different profile first.

### Step 4: Success

```
AWS profiles successfully deleted.    # Green
```

## Log In Again

This option only appears in the "More options" submenu when the default profile is an SSO profile whose login is expired or missing (status `WARNING`).

Selecting it runs `aws sso login` for the default profile (even if `export-credentials` would succeed), rewrites `[default]`, and continues with [After the switch](#after-the-switch):

```
AWS profile sso-dev successfully refreshed.    # Green
```

## Settings

**More options** > **Settings** shows the current state, then a menu. It loops until you choose **Back**.

```
Settings
  Per-terminal switching:  Enabled (~/.zshrc), active in this terminal
  SSO login mode:          Auto (device code over SSH, browser otherwise) - here: browser
  Legacy SSO profiles:     1 without auto-refresh (sso-legacy)
  Settings file:           ~/.switch-profile/settings.json (format v2, last written by switch-profile 2.0.0)

? Settings:
  Disable per-terminal switching
  Change SSO login mode
  Upgrade 1 legacy SSO profile
  Back
```

**Per-terminal switching** shows one of:
- `Disabled`
- `Enabled (<files>), active in this terminal`
- `Enabled (<files>), not loaded in this terminal. Run source ~/.zshrc or open a new terminal, then use sp`
- `Not available for this shell (supported: zsh, bash, fish)`, or on Windows `Not available in this shell (use PowerShell)`

**Actions:**

| Action | Shown when | Effect |
|--------|-----------|--------|
| Enable per-terminal switching | Shell supported, not installed | Adds the `sp` block (same output as the prompt) |
| Disable per-terminal switching | Installed | Removes the block: `Removed the sp shortcut from ~/.zshrc. Terminals already open keep it until they are closed.` |
| Change SSO login mode | Always | Choose `Auto (device code over SSH, browser otherwise)`, `Always device code (approve from any device)` or `Always browser on this machine` |
| Upgrade N legacy SSO profiles | Legacy SSO profiles exist | Runs the upgrade (with backups) and clears the "declined" flag |
| Back | Always | Leaves the screen |

## Visual Indicators

| Color | Meaning |
|-------|---------|
| **Green** | Success messages |
| **Red** | Error messages |
| **Cyan** | Informational (current profile, login status, tips, migration notices) |
| **Yellow** | Warnings (login expired, not logged in, legacy SSO profiles) |
| **Bold** | Profile names in messages |
| **Cyan + Bold** | Profile isolation command hint (`export AWS_PROFILE=...` on Unix, PowerShell/CMD equivalents on Windows) |

## Error Display

Errors are displayed in red with contextual messages:

```
ERROR - Fail to get credentials for profile sso-dev
Fail to log in to the SSO session of profile sso-dev
...
```

When the AWS CLI is missing, a helpful suggestion is appended:

```
ERROR - Command aws not found

To fix this issue, try installing the aws CLI
```
