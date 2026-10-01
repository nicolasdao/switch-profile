# Architecture

This document describes the project structure, source files, and how the components fit together.

## Project Structure

```
switch-profile/
├── index.js                  # CLI entry point (executable): menus and flows
├── package.json              # Project manifest
├── CHANGELOG.md              # Auto-generated release notes
├── LICENSE                   # BSD 3-Clause
├── src/
│   ├── core.js               # Process execution and error formatting
│   ├── fileHelper.js         # File system operations
│   ├── ini.js                # Line-preserving INI helpers (pure)
│   ├── settings.js           # ~/.switch-profile/settings.json and format history
│   ├── migrate.js            # Automatic migrations (1.x [default], legacy SSO)
│   ├── shell.js              # Per-terminal switching: the 'sp' shell function
│   └── aws/
│       ├── index.js          # AWS file I/O, AWS CLI calls, SSO cache status
│       ├── transforms.js     # Pure rules for what is written to the AWS files
│       ├── login.js          # SSO login mode (device code vs browser)
│       └── regions.js        # AWS region definitions
└── test/
    ├── index.js              # Placeholder
    ├── ini.js                # src/ini.js
    ├── transforms.js         # src/aws/transforms.js
    ├── login.js              # src/aws/login.js
    ├── shell.js              # src/shell.js, incl. real zsh/bash runs of 'sp'
    └── migrate.js            # src/migrate.js against a temporary HOME
```

## Component Overview

### `index.js` - CLI Entry Point

The main executable file (with `#!/usr/bin/env node` shebang). Registered as the `bin` target in `package.json`, so it runs when you invoke `switch-profile`, `npx switch-profile`, or the `sp` shell function.

**Responsibilities:**
- Defines the CLI command structure using [Commander.js](https://www.npmjs.com/package/commander).
- Renders interactive prompts using [Inquirer.js](https://www.npmjs.com/package/inquirer).
- Runs the startup upkeep: migrations, the legacy SSO upgrade prompt, and updating an outdated `sp` block.
- Orchestrates the user flow: status, profile listing, selection, creation, deletion, log in again, settings.
- Displays colored status output (SSO login status, success messages, tips).

**Key functions:**

| Function | Purpose |
|----------|---------|
| `switchCmd()` | Main command handler. Checks AWS CLI, runs `startup()`, shows the default profile status, lists profiles, renders the selection and "More options" menus. |
| `startup()` | Runs `migrate.runMigrations()` (prints a notice with backups if anything changed; stops on a newer format), offers the one-time legacy SSO upgrade, and rewrites the `sp` block if it is outdated. Returns `false` if the program must stop. |
| `upgradeLegacySso(names)` | Runs `migrate.upgradeLegacySsoProfiles()` and prints the backups and sessions. |
| `printStatus(defaultProfile)` | Prints the default profile and, for SSO, its login state from `getSsoLoginStatus()`. Notes when `AWS_PROFILE` points to another profile. Returns `true` if the login is expired or missing (enables "Log in again"). |
| `setProfileToDefault(name, list, options)` | Calls `ensureCredentials()` (SSO login if needed, `force` for "Log in again"), then `setDefaultProfile()`, stamps the settings file, and calls `afterSwitch()`. Shows a clear error if the profile is not found. |
| `afterSwitch(profileName)` | Hands the profile to `sp` when launched through it. Otherwise prints the export hint plus `sp` tips, or the one-time "Enable per-terminal switching?" prompt. |
| `enablePerTerminal()` | Installs the `sp` block and prints how to load it (plus the PowerShell execution policy hint). |
| `settingsMenu()` | The Settings screen: state summary and actions (enable/disable per-terminal switching, change SSO login mode, upgrade legacy SSO profiles). |
| `printExportHint(profileName)` | Displays a cyan box with the profile isolation command. On Linux/macOS shows `export AWS_PROFILE=<name>`. On Windows shows both PowerShell (`$env:AWS_PROFILE`) and CMD (`set AWS_PROFILE`) variants. Box width adjusts dynamically. |
| `createNewProfile(profiles, makeItDefault)` | Walks the user through creating a standard or SSO profile. Displays an SSO Setup Guide before SSO creation and reports when an SSO profile was converted to the `[sso-session]` format. |
| `chooseProfileName(denyList)` | Validates profile name input (lowercase alphanumeric, dashes, underscores, min 2 chars, no duplicates). |
| `chooseRegions()` | Autocomplete region picker from the 24 supported AWS regions. |
| `chooseNonEmpty(prop, message)` | Generic required-field input validator. |

**Default command behavior:** If no command is passed (`process.argv.length == 2`), it automatically injects the `switch` command.

### `src/aws/index.js` - AWS Profile Management

Handles all I/O with the AWS configuration files and the AWS CLI. The decisions about *what* to write are delegated to `src/aws/transforms.js`.

**Responsibilities:**
- Reading and writing `~/.aws/config` and `~/.aws/credentials` (new files get mode `0600`), and backing them up.
- Checking that a profile can produce credentials (`aws configure export-credentials`) and logging in (`aws sso login`, terminal inherited).
- Reading `~/.aws/sso/cache` to describe the SSO login state.
- Creating, deleting, and listing profiles.

**Windows compatibility:** Uses `IS_WINDOWS` (`process.platform === 'win32'`) to pick the newline used when appending new profiles (`NL`: `'\n'` on Windows, `os.EOL` otherwise). Parsing goes through `src/ini.js`, which accepts both LF and CRLF and preserves the file's existing line endings. `core.run()` uses `shell: true` on Windows (required because `aws` and `npx` are `.cmd`/`.exe` shims).

See [AWS Profile Management](aws-profile-management.md) for a detailed breakdown of every function.

### `src/aws/transforms.js` - Pure Transforms

Pure functions over the content of the AWS files: setting `[default]`, detecting and stripping the 1.x keys, finding and upgrading legacy SSO profiles, stamping profiles, listing profiles. No I/O, so every write rule is unit tested.

### `src/aws/login.js` - SSO Login Mode

Resolves the `auto` / `device` / `browser` setting into the `aws sso login` flags. `auto` uses `--use-device-code` over SSH or on Linux without a display. The flag is never passed to AWS CLI versions older than 2.22.0.

### `src/ini.js` - INI Helpers

Line-based, pure helpers (`listSections`, `getEntries`, `getSection`, `setSection`, `removeSection`, `setKeys`). Lines that are not touched are kept exactly as they were, including comments and CRLF line endings.

### `src/settings.js` - Tool State

Reads and writes `~/.switch-profile/settings.json`. Every write stamps `createdBy` (first time), `lastWrittenBy`, `updatedAt` and `formatVersion`. Exposes `FORMAT_VERSION` (currently `2`), `LOGIN_MODES`, `CLI_VERSION`, and documents the format history in its header comment.

### `src/migrate.js` - Migrations

`runMigrations()` runs on every start: stops on a newer format, and heals a 1.x `[default]` (with backups) whenever it finds one. `findLegacySsoProfiles()` and `upgradeLegacySsoProfiles()` back the legacy SSO upgrade.

### `src/shell.js` - Per-terminal Switching

Detects the user's shell and startup file(s), and installs, updates or removes the managed block that defines the `sp` function. `exportProfile()` writes the selected profile name to `SWITCH_PROFILE_ENV_FILE` when the CLI was launched through `sp`.

### `src/aws/regions.js` - Region Definitions

A static array of 24 AWS region objects, each with `name` and `code` properties:

```javascript
{ name: 'US East (N. Virginia)', code: 'us-east-1' }
```

Regions covered: 4 US, 8 Asia Pacific, 6 EU, 2 China, 2 GovCloud, 1 Africa, 1 Canada, 1 Middle East, 1 South America.

### `src/core.js` - Process Execution and Error Formatting

Low-level utilities shared across the project.

| Function | Purpose |
|----------|---------|
| `run(cmd, args, { inherit })` | Runs a command with `child_process.spawn` (no shell, except on Windows) and resolves with its stdout. Fails on a non-zero exit code only; output on stderr is not a failure. With `inherit`, the child uses the terminal (needed for `aws sso login` and `aws configure sso` prompts, URLs and codes) and nothing is captured. |
| `exec(cmd)` | Wraps `child_process.exec()` in a Promise. Rejects on error or stderr. Used for `which`/`where` and `aws --version`. |
| `isCommandExist(cmd, errorMsg)` | Returns a function that checks if `cmd` exists in PATH (uses `which` on Unix, `where` on Windows). Results are cached. |
| `printErrors(errors, options)` | Prints an array of `Error` objects in red. |
| `printAWSerrors(errors, options)` | Like `printErrors` but detects missing AWS CLI and appends installation hints. |
| `formatErrorMsg(errors, options)` | Formats error arrays into a single message string. Supports `noStack` option. |

### `src/fileHelper.js` - File System Operations

A general-purpose file I/O library. Only a small subset of its functions are used by `switch-profile`:

**Used by the project:**

| Function | Exported As | Purpose |
|----------|-------------|---------|
| `fileExists(path)` | `exists` | Check if a file or folder exists |
| `getJSON(path, default)` | `json.get` | Read and parse a JSON file (SSO cache tokens) |

**Available but unused:**

Functions for reading, writing, listing, folder creation/deletion, MIME type detection, ZIP/TAR archiving, and more. These exist because `fileHelper.js` is a shared utility library. The newer modules use `fs.promises` directly.

## Dependency Graph

```
index.js
├── commander          (CLI framework)
├── inquirer           (interactive prompts)
├── inquirer-autocomplete-prompt
├── colors             (terminal colors)
├── src/core.js
│   ├── colors
│   ├── puffy          (error handling: catchErrors)
│   └── child_process  (Node built-in: exec, spawn)
├── src/aws/index.js
│   ├── puffy          (error handling: catchErrors, wrapErrors)
│   ├── src/core.js
│   ├── src/settings.js
│   ├── src/fileHelper.js
│   │   ├── core-async (co-routine support)
│   │   ├── fast-glob  (file pattern matching)
│   │   ├── rimraf     (recursive delete)
│   │   ├── mime-types (MIME detection)
│   │   ├── archiver   (ZIP creation - unused)
│   │   ├── tar-stream (TAR creation - unused)
│   │   └── convert-stream (stream utils - unused)
│   ├── src/aws/transforms.js
│   │   └── src/ini.js
│   ├── src/aws/login.js
│   └── src/aws/regions.js
├── src/aws/login.js
├── src/settings.js
│   └── package.json   (version number)
├── src/shell.js
│   └── src/core.js
├── src/migrate.js
│   ├── src/settings.js
│   ├── src/aws/index.js
│   └── src/aws/transforms.js
└── package.json       (version number)
```

## Error Handling Pattern

Async functions in the AWS module use the `catchErrors` wrapper from the `puffy` library. This converts thrown errors into a `[errors, result]` tuple:

```javascript
const [errors, profiles] = await listProfiles()
if (errors) {
    printAWSerrors([new Error('Fail to list profiles'), ...errors])
    return
}
// Use profiles safely
```

Errors are composed using `wrapErrors(message, errorArray)` to build layered error contexts:

```
Error: Fail to get credentials for profile sso-dev
  → Error: Fail to log in to the SSO session of profile sso-dev
    → Error: 'aws sso login --profile sso-dev' exited with code 255
```

This pattern allows errors to propagate up with context while keeping individual functions simple.

The newer modules (`settings.js`, `migrate.js`, `shell.js`, `transforms.js`, `ini.js`, `login.js`) throw plain errors or are pure; `index.js` catches them where needed. `migrate.NewerFormatError` is printed without a stack trace and stops the CLI.

## Data Flow

```
User runs: npx switch-profile  (or sp)
                │
                ▼
        ┌──────────────────┐
        │     index.js     │  Checks AWS CLI v2 exists
        │    switchCmd()   │
        └────────┬─────────┘
                 │
                 ▼
        ┌──────────────────┐
        │    startup()     │  runMigrations (backups, 1.x heal,
        │                  │  newer-format stop), legacy SSO
        │                  │  prompt, outdated sp block update
        └────────┬─────────┘
                 │
                 ▼
        printStatus + profile list
                 │
                 ▼
        User selects a profile
                 │
                 ▼
    ┌──────────────────────────┐
    │   setProfileToDefault    │
    │                          │
    │  1. Find profile         │
    │  2. ensureCredentials    │──────► SSO: export-credentials,
    │  3. setDefaultProfile    │        else aws sso login (device
    │  4. settings.update      │        code or browser), retry
    └────────────┬─────────────┘
                 │
                 ▼
    ┌──────────────────────────┐
    │   transforms.            │
    │   setDefaultProfile      │
    │                          │
    │  ~/.aws/config [default] │  ← profile settings + stamps
    │  ~/.aws/credentials      │  ← mirrored keys or removed
    │  [default]               │
    └────────────┬─────────────┘
                 │
                 ▼
    ┌──────────────────────────┐
    │   afterSwitch            │
    │                          │
    │  via sp: write profile   │
    │  name to env file → sp   │
    │  sets AWS_PROFILE        │
    │                          │
    │  otherwise: export hint, │
    │  sp tips or one-time     │
    │  enable prompt           │
    └──────────────────────────┘
```
