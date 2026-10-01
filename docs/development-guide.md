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

To try `sp` against your checkout, link it globally (`npm link`): `sp` prefers the global `switch-profile` command over `npx`.

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

| File | Covers |
|------|--------|
| `test/cli.js` | End to end, non-interactive: version/help, switching a keys profile with `--json`, exit 2 when a login is needed, non-interactive device login then fuzzy switch, the `sp` env file handoff, exit 3 on ambiguous/unknown input (and JSON errors), `status --json`, `add --from-sso`, `remove` with and without `--yes`, `logout` |
| `test/rank.js` | `PROD` detection, order (current, frecency, config order), fuzzy search across fields, `resolveQuery`, `recordUsage` |
| `test/clipboard.js` | OSC 52 sequence and the tmux passthrough |
| `test/shell.js` | Block add/update/remove; real `bash`/`zsh` runs: `sp` sets `AWS_PROFILE` and clears `AWS_ACCESS_KEY_ID`/`AWS_DEFAULT_PROFILE`, bash completion of profiles and subcommands, zsh `compdef` registration (and no failure without `compinit`). Skipped when the shell is missing. |
| `test/login.js` | Device code over SSH, Linux without a display, explicit modes, no flags before AWS CLI 2.22.0, `parseLoginOutput` |
| `test/transforms.js` | `[default]` rules, 1.x detection/stripping, legacy SSO upgrade, session names, profile listing and kinds, `populateSsoProfiles` (skip existing, stale and prune, naming and clashes) |
| `test/ini.js` | `src/ini.js`, including CRLF preservation |
| `test/migrate.js` | `src/migrate.js` against a temporary `HOME` |
| `test/index.js` | Placeholder |

### The fake AWS CLI

`test/cli.js` runs the real `index.js` with `spawnSync`, a temporary `HOME` (with its own `~/.aws` and settings file) and `test/fixtures/bin` first in `PATH`. `test/fixtures/bin/aws` is a small Node script that:

- answers `--version` (`aws-cli/2.33.17`), `sts get-caller-identity` (fails for SSO profiles without a cached token), `sso login` (prints device code or browser output, then writes a token to `~/.aws/sso/cache`), `sso logout`, `sso list-accounts`, `sso list-account-roles` and `configure export-credentials`;
- logs every call to `$HOME/aws-calls.log`;
- reads `FAKE_LOGIN_DELAY` (ms before the login completes, default 2500) and `FAKE_LOGIN_FAIL` (fail with `invalid_grant`).

Anything else exits 2 with `fake aws: unsupported …`. Extend it when a command starts calling a new AWS CLI subcommand. The CLI tests are skipped on Windows.

Your real `~/.aws` is never touched by the tests.

## Manual testing of interactive screens

The picker, prompts and login screen need a real terminal (TTY), so they are not covered by `npm test`. Use the fake AWS CLI and a throwaway `HOME`:

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
- **Errors:** `--debug` prints stack traces.

## Release

1. Make sure the working tree is clean and on `master`.
2. Bump the version and changelog:
   ```shell
   npm run rls -- major    # 1.1.0 → 2.0.0 (breaking changes)
   npm run rls -- minor    # new features
   npm run rls -- patch    # fixes
   ```
   `standard-version --release-as <type>` bumps `package.json`, updates `CHANGELOG.md` from conventional commits, commits, and tags (`v2.0.0`).
3. Publish:
   ```shell
   npm run push            # git push --follow-tags origin master && npm publish --access=public
   ```
   `prepublishOnly` runs `npm run lint`, `npm test` and `npm run test:dist` (which builds `dist/cli.js`). Any failure stops the publish.
4. Check the package: `npx switch-profile@latest --version`.

`npm run v` prints the current version. `npm pack --dry-run` lists what would be published.

## Conventions

- CommonJS, tabs, single quotes, no semicolons (enforced by ESLint).
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`; `!` for breaking changes).
- **Pure rules, thin I/O.** What is written to the AWS files is decided in pure functions (`src/aws/transforms.js`, `src/ini.js`, the block builders in `src/shell.js`, `src/rank.js`, `src/aws/login.js`) and tested on strings. I/O stays in `src/aws/index.js`, `src/settings.js`, `src/shell.js` and the commands.
- **Write AWS files through `aws.writeAwsFile` / `writeAwsFiles`** (atomic, permission-preserving). Back up first (`aws.backupAwsFiles`) for bulk changes.
- **Expected failures are `CliError`s** with a hint and an exit code (2 login required, 3 bad input). Never prompt when `ui.isInteractive()` is false; fail with a hint instead.
- **Storage format changes:** if a change alters how `switch-profile` stores things in the user's AWS files in a way older 2.x versions would misread, bump `FORMAT_VERSION` in `src/settings.js`, extend the format history there, and add a migration (with backups) to `src/migrate.js`. Additive keys that older versions ignore do not need a bump.
- **Version stamps:** sections written by the tool carry `switch_profile_version`, and the settings file records `lastWrittenBy`.
- **`sp` block changes** are picked up automatically: any change to the generated body makes installed blocks "outdated", and the next run rewrites them.
