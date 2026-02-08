# CLI Interface

This document provides a detailed walkthrough of every menu, prompt, and user flow in `switch-profile`.

## Invocation

```shell
npx switch-profile          # Run via npx (no install)
switch-profile              # If installed globally
npx switch-profile switch   # Explicit command (same as default)
npx switch-profile --version  # Print version number
```

The `switch` command is the only command and runs automatically when no arguments are provided.

## Main Flow

### Step 1: AWS CLI Check

Before anything else, the tool verifies AWS CLI v2+ is installed. If not found, it prints platform-specific installation instructions:

- **macOS:** `brew install awscli && brew link --overwrite awscli`
- **Linux:** curl + unzip instructions for the AWS CLI v2 installer
- **Windows:** Generic "not installed" message

### Step 2: Default Profile Status

If a default profile is set, it displays the current status with color-coded information:

```
Current default profile: sso-dev
 INFO: This profile expires in 45.23 minutes     # Cyan - healthy
```

```
Current default profile: sso-dev
 WARNING: Expires in less than 2 minutes          # Yellow - expiring soon
```

```
Current default profile: sso-dev
 WARNING: Expired                                 # Yellow - expired
```

```
Current default profile: unknown (pick one up in the list below...)  # No profile set
```

The expiry time is calculated in minutes to two decimal places.

### Step 3: Profile List

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

### Step 4a: Select a Profile

Selecting a profile from the list sets it as the `default`. For SSO profiles, this may:

1. Open your browser for SSO authentication (if the session expired).
2. Wait for you to complete the login (up to 5 minutes).
3. Retrieve temporary credentials from the AWS CLI cache.

On success:

```
AWS profile sso-dev successfully set up as default.   # Green
```

### Step 4b: More Options

Selecting "More options" opens a submenu:

```
? Options:
  Refresh default profile sso-dev    # Only shown when expired
  Create profile
  Delete profiles
  Abort
```

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

Selecting "sso" spawns the interactive `aws configure sso` command, which takes over the terminal:

```
SSO session name (Recommended): my-session
SSO start URL [None]: https://my-company.awsapps.com/start
SSO region [None]: us-east-1
SSO registration scopes [sso:account:access]:
...
```

This is the standard AWS CLI SSO setup flow. The user completes it directly.

### Step 4: Set as Default

After creation, you're asked:

```
? Do you wish to set this new profile as the default? (Y/n)
```

If yes, the profile is immediately set as the `default` (triggering SSO login if needed).

## Delete Profiles Flow

### Step 1: Select Profiles

```
? Select the profiles you which to delete:
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

## Refresh Default Profile

This option only appears in the "More options" submenu when the current default profile is expired.

Selecting it:
1. Looks up the current default profile in the profile list.
2. Retrieves fresh credentials (SSO login if needed).
3. Updates the `[default]` section.

```
AWS profile sso-dev successfully refreshed.    # Green
```

## Visual Indicators

| Color | Meaning |
|-------|---------|
| **Green** | Success messages |
| **Red** | Error messages |
| **Cyan** | Informational (current profile, time remaining) |
| **Yellow** | Warnings (expired, expiring soon) |
| **Bold** | Profile names in messages |

## Error Display

Errors are displayed in red with contextual messages:

```
ERROR - Fail to get credentials for profile sso-dev
Fail to refresh the SSO session for AWS profile sso-dev
Timeout - Time to wait for refreshing the SSO session exceeded 300000ms.
```

When the AWS CLI is missing, a helpful suggestion is appended:

```
ERROR - Command aws not found

To fix this issue, try installing the aws CLI
```
