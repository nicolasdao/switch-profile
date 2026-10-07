---
description: Build, lint, tests, manual testing and releases.
tags: [development, testing, release, build]
source:
  - package.json
  - eslint.config.js
  - test/**
  - .agents/skills/release-switch-profile/**
---

# Development Guide

How to set up, run, build, lint, test and release `switch-profile`.

## Setup

```shell
git clone https://github.com/nicolasdao/switch-profile.git
cd switch-profile
npm install
```

Node.js 20.12 or later and AWS CLI v2 are required.

## Running locally

```shell
node index.js            # or: npm run dev
node index.js status --json
```

In a checkout, `index.js` runs the sources (`src/cli.js`) directly, so there is no build step while developing. To run the bundle instead:

```shell
npm run build
SWITCH_PROFILE_DIST=1 node index.js
```

To try `sp` against your checkout, point it at your build: `export SWITCH_PROFILE_DEV_BIN="$PWD/index.js"` (unset it to go back to npx). Without it, `sp` always runs `npx --yes switch-profile@latest`, even when a global install exists.

## Build

```shell
npm run build
```

esbuild bundles `src/cli.js` and all its dependencies into `dist/cli.js` (CommonJS, `--target=node20.12`, `--minify-syntax`, no legal comments). `dist/` is git-ignored and generated at publish time by `prepublishOnly`.

All packages are `devDependencies`. The published package contains only `index.js`, `dist/`, `LICENSE` and `README.md` (`files` in `package.json`) and installs nothing else. When you add a library, add it as a devDependency and make sure esbuild can bundle it (CommonJS or ESM without native code); check with `npm run test:dist`.

## Linting

```shell
npm run lint        # eslint . --fix
```

`eslint.config.js` (flat config) extends `@eslint/js` recommended and enforces:

| Rule | Setting |
|------|---------|
| Indentation | Tabs (`SwitchCase: 1`) |
| Quotes | Single (escapes avoided) |
| Semicolons | Never |
| Line endings | Unix |
| Modules | CommonJS, ES2022, Node and Mocha globals |
| Console | Allowed |

`dist/`, `node_modules/`, `.claude/` and `.agents/` are ignored. The script uses `--fix`, so it rewrites files.

## Tests

```shell
npm test            # mocha --exit (every file in test/)
npm run test:dist   # build, then test/cli.js against dist/cli.js
```

`.mocharc.json` loads `test/fixtures/setup.js` first, which points `SWITCH_PROFILE_LOG_FILE` at a temp file so in-process tests never write to your real `~/.switch-profile`. End-to-end tests use a throwaway `HOME`.

| File | Covers |
|------|--------|
| `test/cli.js` | End to end, non-interactive: version/help, switching a keys profile with `--json`, exit 2 when a login is needed, non-interactive device login then fuzzy switch, the `sp` env file handoff, exit 3 on ambiguous/unknown input (and JSON errors), `status --json`, `add --from-sso`, `remove` with and without `--yes`, `logout`, the log file in the temp HOME |
| `test/rank.js` | `PROD` detection, order (current, frecency, config order), fuzzy search across fields, `resolveQuery`, `recordUsage` |
| `test/clipboard.js` | OSC 52 sequence and the tmux passthrough |
| `test/shell.js` | Block add/update/remove; real `bash`/`zsh` runs: `sp` sets `AWS_PROFILE` and clears `AWS_ACCESS_KEY_ID`/`AWS_DEFAULT_PROFILE`, bash completion of profiles and subcommands (including several names after `remove`), zsh `compdef` registration (and no failure without `compinit`). Skipped when the shell is missing. |
| `test/login.js` | Device code over SSH, Linux without a display, explicit modes, no flags before AWS CLI 2.22.0, `parseLoginOutput`, `configureSsoFailure` |
| `test/transforms.js` | `[default]` rules, 1.x detection/stripping, legacy SSO upgrade, session names, profile listing and kinds, `populateSsoProfiles` (skip existing, stale and prune, naming and clashes) |
| `test/ini.js` | `src/ini.js`, including CRLF preservation |
| `test/migrate.js` | `src/migrate.js` against a temporary `HOME` |
| `test/core.js` | `catchErrors`/`wrapErrors` (error chains flattened outermost first), `run` (fails on exit code, not on stderr; keeps command, exit code and output on failure) and `lastErrorLine` |
| `test/log.js` | `src/log.js`: redaction, full error chains, file format, tolerated failures, rotation, never throwing, `~` display path |
| `test/home.js` | Home screen: the pure `nextFocus()` key rules, and the real prompt driven with simulated keys (switch, search, open actions, back to the list, Esc, no profiles) |
| `test/navigation.js` | Home screen navigation decisions: `routeChoice()` (quit, switch, open a page) and `afterPage()` (exit after a switch, back on Esc, show expected errors, rethrow the rest) |
| `test/ui.js` | `fit`, `ago`, `isInteractive` (never with `--no-input` or in CI), `CliError` hint and exit code, `printError`'s log pointer, `cliErrorFrom` |

### The fake AWS CLI

`test/cli.js` runs the real `index.js` with `spawnSync`, a temporary `HOME` (with its own `~/.aws` and settings file) and `test/fixtures/bin` first in `PATH`. `test/fixtures/bin/aws` is a small Node script that:

- answers `--version` (`aws-cli/2.33.17`, or `FAKE_AWS_VERSION`; below 2.22 `sso login` prints the old default device-code output), `sts get-caller-identity` (fails for SSO profiles without a cached token), `sso login` (prints device code or browser output, then writes a token to `~/.aws/sso/cache`), `sso logout`, `sso list-accounts`, `sso list-account-roles` and `configure export-credentials`;
- logs every call to `$HOME/aws-calls.log`;
- reads `FAKE_LOGIN_DELAY` (ms before the login completes, default 2500) and `FAKE_LOGIN_FAIL` (fail with `invalid_grant`).

Anything else exits 2 with `fake aws: unsupported …`. Extend it when a command starts calling a new AWS CLI subcommand. The CLI tests are skipped on Windows.

Your real `~/.aws` is never touched by the tests.

## Manual testing of interactive screens

The home screen's keys are covered by `test/home.js` (it drives the real prompt with simulated keystrokes on a stream). The other prompts, the page navigation and the login screen need a real terminal (TTY), so they are not covered by `npm test`. Use the fake AWS CLI and a throwaway `HOME`:

```shell
export TEST_HOME=$(mktemp -d)
mkdir -p $TEST_HOME/.aws && cp my-test-config $TEST_HOME/.aws/config
HOME=$TEST_HOME PATH=$PWD/test/fixtures/bin:$PATH node index.js
```

Tips:

- **Login screen:** `HOME=$TEST_HOME PATH=… FAKE_LOGIN_DELAY=20000 node index.js login acme-dev --device` gives 20 seconds to try `q`, `c`, `o` and Ctrl+C. `FAKE_LOGIN_FAIL=1` shows the failure path.
- **SSH behavior locally:** set `SSH_CONNECTION=x` to get device code mode, OSC 52 instead of `pbcopy`, and no browser opening.
- **Narrow terminals:** resize below 100 and 80 columns to check the region and role columns disappear.
- **Scripted runs:** to drive the TUI from a script or an agent, use a pseudo-terminal, for example `script -q /dev/null node index.js` on macOS, `script -qc "node index.js" /dev/null` on Linux, or `node-pty`/`expect`. Send keys as bytes (`\r` enter, `\x1b[B` down arrow, `\x03` Ctrl+C) and give clack time to render between keys.
- **Non-interactive paths:** `--no-input`, `CI=1`, or piping (`node index.js | cat`).
- **No colors / no animation:** `NO_COLOR=1`, `ACCESSIBLE=1`.
- **Errors:** every run is logged to `~/.switch-profile/switch-profile.log` (`tail -f` it while testing); `--debug` also prints stack traces.

## Release

Releases are run by the project's **`release-switch-profile`** skill (in `.agents/skills/`, linked into `.claude/skills/`). It replaces standard-version: there is no `rls` or `push` npm script any more. Ask Claude Code to "release", or invoke `/release-switch-profile [patch|minor|major|unreleased] ["note"]`.

It runs these steps, stopping at the first failure:

1. **Quality gate:** `npm test` and `npx eslint .`.
2. **Test gaps:** source files changed since the last tag without tests. It writes the missing tests.
3. **Docs:** runs the `update-doc` skill, unless the docs are already newer than the code.
4. **Commit:** commits all pending work with the `git-commit` skill. It then requires a clean tree, on `master`, not behind `origin`.
5. **Bump:** picks the semver bump from the changes, with conventional commits as the main signal. It then runs `npm version <x.y.z> --no-git-tag-version`, which updates `package.json` and `package-lock.json`.
6. **Changelog:** writes the new `CHANGELOG.md` entry in [Keep a Changelog](https://keepachangelog.com) format. Older standard-version entries are kept as they are.
7. **Release commit and tag:** `chore(release): switch-profile v<x.y.z>` with an annotated tag `v<x.y.z>`.
8. **Push:** pushes `master` and the tag.
9. **Publish:** `npm publish --access=public`. `prepublishOnly` re-runs lint, tests and `test:dist`.

It asks for confirmation before three steps: the release commit, the push, and the publish. `unreleased` only records your changes under `## [Unreleased]` in `CHANGELOG.md`, for the next release to pick up.

To publish by hand, for example after declining the publish step, run `npm publish --access=public` (requires `npm login`). Check the result with `npx switch-profile@latest --version`. `npm run v` prints the current version, and `npm pack --dry-run` lists what would be published.

## Conventions

- CommonJS, tabs, single quotes, no semicolons (enforced by ESLint).
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`; `!` for breaking changes).
- **Pure rules, thin I/O.** What is written to the AWS files is decided in pure functions (`src/aws/transforms.js`, `src/ini.js`, the block builders in `src/shell.js`, `src/rank.js`, `src/aws/login.js`) and tested on strings. I/O stays in `src/aws/index.js`, `src/settings.js`, `src/shell.js` and the commands.
- **Write AWS files through `aws.writeAwsFile` / `writeAwsFiles`** (atomic, permission-preserving). Back up first (`aws.backupAwsFiles`) for bulk changes.
- **Expected failures are `CliError`s** with a hint and an exit code (2 login required, 3 bad input). Never prompt when `ui.isInteractive()` is false; fail with a hint instead.
- **Storage format changes:** if a change alters how `switch-profile` stores things in the user's AWS files in a way older 2.x versions would misread, bump `FORMAT_VERSION` in `src/settings.js`, extend the format history there, and add a migration (with backups) to `src/migrate.js`. Additive keys that older versions ignore do not need a bump.
- **Version stamps:** sections written by the tool carry `switch_profile_version`, and the settings file records `lastWrittenBy`.
- **`sp` block changes** are picked up automatically: any change to the generated body makes installed blocks "outdated", and the next run rewrites them.
