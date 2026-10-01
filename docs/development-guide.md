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

**Known issue:** `npm run lint` currently fails. The project depends on ESLint 10, which no longer reads `.eslintrc.json` (the "eslintrc" format was removed in favor of flat config). The configuration needs to be migrated to an `eslint.config.js` file (see the [ESLint migration guide](https://eslint.org/docs/latest/use/configure/migration-guide)). Until then, follow the rules above by hand.

## Testing

```shell
npm test
# Runs: mocha --exit
```

Tests use [Mocha](https://mochajs.org/) as the test runner and [Chai](https://www.chaijs.com/) for assertions. Mocha runs every file in `test/`:

| File | Covers |
|------|--------|
| `test/ini.js` | `src/ini.js`: reading sections, replacing/creating/removing sections, in-place key edits, CRLF preservation |
| `test/transforms.js` | `src/aws/transforms.js`: the `[default]` format for SSO and standard profiles, no stamp duplication, 1.x detection and stripping, legacy SSO detection and upgrade (shared sessions, reuse of existing sessions, name clashes), session names from start URLs |
| `test/login.js` | `src/aws/login.js`: device code over SSH, Linux without a display, explicit modes, no flag for AWS CLI < 2.22.0 |
| `test/shell.js` | `src/shell.js`: adding, updating and removing the managed block; real `zsh` and `bash` runs of the `sp` function with a fake `switch-profile` (skipped if the shell is not installed) |
| `test/migrate.js` | `src/migrate.js` run against a temporary `HOME`: 1.x migration with backups, idempotence, legacy SSO upgrade rewriting `[default]`, refusal of a newer format |
| `test/index.js` | Placeholder |

The tests never touch your real `~/.aws` files: pure modules are tested on strings, and `test/migrate.js` points `HOME` to a temporary folder (clearing the `src/` module cache so paths are recomputed). The `index.js` menus and the calls to the real AWS CLI are not covered.

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
| `puffy` | Error handling (`catchErrors`, `wrapErrors`) |
| `core-async` | Generator-based async flow (used internally by fileHelper) |
| `fast-glob` | File pattern matching (imported by fileHelper, unused in current flows) |
| `rimraf` | Recursive directory deletion (imported by fileHelper, unused in current flows) |
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

The `fileHelper.js` module is a shared utility library that imports several packages not used by `switch-profile`'s core functionality: `archiver`, `tar-stream`, `convert-stream`, `fast-glob`, `rimraf` and `mime-types`. Only its `exists` and `json.get` functions are used. These are present because `fileHelper.js` provides general-purpose file operations that may be used in other projects sharing this codebase.

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
- **Pure write rules**: What is written to the AWS files is decided in pure functions (`src/aws/transforms.js`, `src/ini.js`, the block helpers in `src/shell.js`) and tested on strings. I/O stays in `src/aws/index.js`, `src/settings.js` and `src/shell.js`.
- **Storage format changes**: If a change alters how `switch-profile` stores things in the user's AWS files, bump `FORMAT_VERSION` in `src/settings.js`, add the new version to the format history in that file, and add a migration (with backups) to `src/migrate.js`. Older versions then stop with a "run the latest version" message instead of misreading the files.
- **Version stamps**: Sections written by the tool carry `switch_profile_version` (the CLI version), and the settings file records `lastWrittenBy`, to help diagnose user setups.
- **Shebang**: `index.js` starts with `#!/usr/bin/env node` for direct CLI execution.
