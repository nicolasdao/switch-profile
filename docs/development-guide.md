# Development Guide

This document covers how to set up, develop, test, lint, and release `switch-profile`.

## Setup

```shell
git clone https://github.com/nicolasdao/switch-profile.git
cd switch-profile
npm install
```

## Running Locally

**Development mode:**
```shell
npm run dev
# Runs: TZ=UTC NODE_ENV=dev node index.js
```

**Production mode:**
```shell
npm start
# Runs: TZ=UTC NODE_ENV=production node index.js
```

**Direct execution:**
```shell
node index.js
```

Both modes set `TZ=UTC` to ensure consistent timestamp handling.

## Linting

```shell
npm run lint
# Runs: eslint index.js src/ test/ --fix
```

The ESLint configuration (`.eslintrc.json`) enforces:

| Rule | Setting |
|------|---------|
| Indentation | Tabs |
| Quotes | Single |
| Semicolons | None (never) |
| Line endings | Unix (`\n`) |
| Environment | ES6, Node.js (CommonJS) |
| Console | Allowed |

The `--fix` flag auto-fixes style issues when possible.

## Testing

```shell
npm test
# Runs: mocha --exit
```

Tests are located in `test/index.js` and use [Mocha](https://mochajs.org/) as the test runner and [Chai](https://www.chaijs.com/) for assertions.

**Current state:** The test suite contains a single placeholder test. There are no functional tests for the AWS operations, profile management, or file I/O.

**Test utilities (from comments in test file):**
- Skip a test: Use `xit` instead of `it`, or `describe.skip` instead of `describe`.
- Run only one test: Use `it.only` instead of `it`.

## Dependencies

### Production Dependencies

| Package | Purpose |
|---------|---------|
| `commander` | CLI argument parsing and command registration |
| `inquirer` | Interactive prompts (list, input, confirm, checkbox) |
| `inquirer-autocomplete-prompt` | Autocomplete support for region selection |
| `colors` | Colored terminal output |
| `puffy` | Error handling (`catchErrors`, `wrapErrors`, `delay`) |
| `core-async` | Generator-based async flow (co-routines) |
| `fast-glob` | File pattern matching for cache directory scanning |
| `rimraf` | Cross-platform recursive directory deletion |
| `mime-types` | MIME type detection (used by fileHelper, not core functionality) |
| `archiver` | ZIP creation (imported by fileHelper, unused in current flows) |
| `tar-stream` | TAR streaming (imported by fileHelper, unused in current flows) |
| `convert-stream` | Stream conversion (imported by fileHelper, unused in current flows) |

### Dev Dependencies

| Package | Purpose |
|---------|---------|
| `mocha` | Test runner |
| `chai` | Assertion library |
| `eslint` | Code linting |
| `standard-version` | Automated versioning and changelog generation |

### Unused Dependencies

The `fileHelper.js` module is a shared utility library that imports several packages not used by `switch-profile`'s core functionality: `archiver`, `tar-stream`, `convert-stream`, and partially `mime-types`. These are present because `fileHelper.js` provides general-purpose file operations that may be used in other projects sharing this codebase.

## Release Process

### Step 1: Version Bump and Changelog

```shell
npm run rls -- minor    # For new features (0.1.x → 0.2.0)
npm run rls -- patch    # For bug fixes (0.1.2 → 0.1.3)
npm run rls -- major    # For breaking changes (0.x.x → 1.0.0)
```

This runs `standard-version --release-as <type>`, which:
1. Bumps the version in `package.json`.
2. Updates `CHANGELOG.md` based on conventional commit messages.
3. Creates a git commit with the version bump.
4. Creates an annotated git tag (e.g., `v0.1.3`).

### Step 2: Publish

```shell
npm run push
# Runs: git push --follow-tags origin master && npm publish --access=public
```

This:
1. Pushes the commit and tag to the `master` branch on GitHub.
2. Publishes the package to the npm registry with public access.

### Version Check

```shell
npm run v
# Prints the current version from package.json
```

## npm Package Configuration

| Field | Value |
|-------|-------|
| Package name | `switch-profile` |
| Entry point | `index.js` |
| Binary | `index.js` (registered via `"bin"` field) |
| Access | Public |
| License | BSD-3-Clause |
| Files excluded from npm | `test/` (via `.npmignore`) |

## Conventional Commits

The project uses [standard-version](https://github.com/conventional-commits/standard-version) for automated changelog generation. Commit messages should follow the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
feat: Add support for profile refresh
fix: Multiple SSO profiles are not supported
chore(release): 0.1.2
```

Prefixes:
- `feat:` - New features (bumps minor version)
- `fix:` - Bug fixes (bumps patch version)
- `chore:` - Maintenance tasks (no version bump unless specified)

## Project Layout Conventions

- **No semicolons** in JavaScript files.
- **Tab indentation** throughout.
- **Single quotes** for strings.
- **CommonJS** module system (`require`/`module.exports`), not ES modules.
- **Error tuple pattern**: Async functions return `[errors, result]` via the `catchErrors` wrapper from `puffy`.
- **Shebang**: `index.js` starts with `#!/usr/bin/env node` for direct CLI execution.
