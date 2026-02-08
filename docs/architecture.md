# Architecture

This document describes the project structure, source files, and how the components fit together.

## Project Structure

```
switch-profile/
├── index.js                  # CLI entry point (executable)
├── package.json              # Project manifest
├── CHANGELOG.md              # Auto-generated release notes
├── LICENSE                   # BSD 3-Clause
├── src/
│   ├── core.js               # Shell execution and error formatting
│   ├── fileHelper.js         # File system operations
│   └── aws/
│       ├── index.js          # AWS profile and credential management
│       └── regions.js        # AWS region definitions
└── test/
    └── index.js              # Test suite
```

## Component Overview

### `index.js` - CLI Entry Point

The main executable file (with `#!/usr/bin/env node` shebang). Registered as the `bin` target in `package.json`, so it runs when you invoke `switch-profile` or `npx switch-profile`.

**Responsibilities:**
- Defines the CLI command structure using [Commander.js](https://www.npmjs.com/package/commander).
- Renders interactive prompts using [Inquirer.js](https://www.npmjs.com/package/inquirer).
- Orchestrates the user flow: profile listing, selection, creation, deletion, and refresh.
- Displays colored status output (expiry warnings, success messages).

**Key functions:**

| Function | Purpose |
|----------|---------|
| `switchCmd()` | Main command handler. Checks AWS CLI, shows current profile status, lists profiles, renders the selection menu. |
| `setProfileToDefault(name, list, msg)` | Gets credentials for a profile, writes them as the `[default]` profile. |
| `createNewProfile(profiles, makeItDefault)` | Walks the user through creating a standard or SSO profile. |
| `chooseProfileName(denyList)` | Validates profile name input (lowercase alphanumeric, dashes, underscores, min 2 chars, no duplicates). |
| `chooseRegions()` | Autocomplete region picker from the 24 supported AWS regions. |
| `chooseNonEmpty(prop, message)` | Generic required-field input validator. |

**Default command behavior:** If no command is passed (`process.argv.length == 2`), it automatically injects the `switch` command.

### `src/aws/index.js` - AWS Profile Management

The core module. Handles all interactions with AWS configuration files and the AWS CLI.

**Responsibilities:**
- Reading and writing `~/.aws/config` and `~/.aws/credentials`.
- Parsing INI-style profile sections.
- Managing SSO sessions and credential caching.
- Creating, deleting, and listing profiles.
- Refreshing expired SSO sessions (including browser redirect).

See [AWS Profile Management](aws-profile-management.md) for a detailed breakdown of every function.

### `src/aws/regions.js` - Region Definitions

A static array of 24 AWS region objects, each with `name` and `code` properties:

```javascript
{ name: 'US East (N. Virginia)', code: 'us-east-1' }
```

Regions covered: 4 US, 8 Asia Pacific, 6 EU, 2 China, 2 GovCloud, 1 Africa, 1 Canada, 1 Middle East, 1 South America.

### `src/core.js` - Shell Execution and Error Formatting

Low-level utilities shared across the project.

| Function | Purpose |
|----------|---------|
| `exec(cmd)` | Wraps `child_process.exec()` in a Promise. Rejects on error or stderr. |
| `isCommandExist(cmd, errorMsg)` | Returns a function that checks if `cmd` exists in PATH (uses `which` on Unix, `where` on Windows). Results are cached. |
| `printErrors(errors, options)` | Prints an array of `Error` objects in red. |
| `printAWSerrors(errors, options)` | Like `printErrors` but detects missing AWS CLI and appends installation hints. |
| `formatErrorMsg(errors, options)` | Formats error arrays into a single message string. Supports `noStack` option. |

### `src/fileHelper.js` - File System Operations

A general-purpose file I/O library. Only a subset of its functions are used by `switch-profile`:

**Used by the project:**

| Function | Exported As | Purpose |
|----------|-------------|---------|
| `fileExists(path)` | `exists` | Check if a file or folder exists |
| `readFile(path)` | `read` | Read file contents into a Buffer |
| `writeToFile(path, content, opts)` | `write` | Create or overwrite a file |
| `listFiles(folder, opts)` | `list` | Glob-based file listing |
| `getJSON(path, default)` | `json.get` | Read and parse a JSON file |

**Available but unused:**

Functions for folder creation/deletion, MIME type detection, ZIP/TAR archiving, and more. These exist because `fileHelper.js` is a shared utility library.

## Dependency Graph

```
index.js
├── commander          (CLI framework)
├── inquirer           (interactive prompts)
├── inquirer-autocomplete-prompt
├── colors             (terminal colors)
├── src/core.js
│   ├── colors
│   ├── puffy          (error handling: catchErrors, wrapErrors)
│   └── child_process  (Node built-in)
├── src/aws/index.js
│   ├── puffy          (error handling + delay)
│   ├── src/core.js
│   ├── src/fileHelper.js
│   │   ├── core-async (co-routine support)
│   │   ├── fast-glob  (file pattern matching)
│   │   ├── rimraf     (recursive delete)
│   │   ├── mime-types (MIME detection)
│   │   ├── archiver   (ZIP creation - unused)
│   │   ├── tar-stream (TAR creation - unused)
│   │   └── convert-stream (stream utils - unused)
│   ├── src/aws/regions.js
│   └── child_process  (for spawn)
└── package.json       (version number)
```

## Error Handling Pattern

All async functions in the AWS module use the `catchErrors` wrapper from the `puffy` library. This converts thrown errors into a `[errors, result]` tuple:

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
  → Error: Fail to refresh the SSO session
    → Error: Timeout - Time to wait exceeded 300000ms
```

This pattern allows errors to propagate up with context while keeping individual functions simple.

## Data Flow

```
User runs: npx switch-profile
                │
                ▼
        ┌──────────────┐
        │   index.js   │  Checks AWS CLI v2 exists
        │  switchCmd()  │  Gets default profile + status
        │              │  Lists all profiles
        └──────┬───────┘
               │
               ▼
        User selects a profile
               │
               ▼
    ┌──────────────────────┐
    │  setProfileToDefault │
    │                      │
    │  1. Find profile     │
    │  2. Get credentials  │──────► For SSO: refresh session,
    │  3. Update default   │        open browser if needed
    └──────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │  updateDefaultProfile│
    │                      │
    │  Writes [default]    │
    │  section to:         │
    │  - ~/.aws/credentials│
    │  - ~/.aws/config     │
    └──────────────────────┘
```
