# Architecture

Project layout, what each module does, and how a run flows through them.

## Project structure

```
switch-profile/
├── index.js                  # bin: Node version check, then runs src/cli.js (checkout) or dist/cli.js (published)
├── package.json              # scripts, devDependencies, files: index.js, dist/, LICENSE, README.md
├── eslint.config.js          # ESLint flat config
├── dist/cli.js               # esbuild bundle (generated, git-ignored)
├── src/
│   ├── cli.js                # commander definitions, error and exit code handling
│   ├── commands/
│   │   ├── common.js         # preflight, loadState, CancelError/ask, describe, loginState
│   │   ├── switch.js         # picker, connect (identity check + login), switchTo, sp offer
│   │   ├── login-flow.js     # the SSO login screen (device code, clipboard, QR, timer)
│   │   └── index.js          # use, status, login, logout, add (+ SSO import), remove, settings
│   ├── ui.js                 # colors (util.styleText), symbols, isInteractive, CliError, spinners
│   ├── rank.js               # fuzzy search (fuzzysort), frecency, PROD detection, query resolution
│   ├── clipboard.js          # local clipboard tools, OSC 52, opening URLs
│   ├── shell.js              # the sp shell block: function, completion, install/uninstall, env file handoff
│   ├── settings.js           # ~/.switch-profile/settings.json and the format history
│   ├── migrate.js            # automatic migrations (1.x [default], legacy SSO)
│   ├── ini.js                # line-preserving INI helpers (pure)
│   ├── core.js               # run/exec child processes, catchErrors/wrapErrors, isCommandExist
│   └── aws/
│       ├── index.js          # AWS file I/O (atomic writes), AWS CLI calls, SSO cache
│       ├── transforms.js     # pure rules for what is written to the AWS files
│       ├── login.js          # remote detection, login mode, aws sso login flags, output parser
│       └── regions.js        # region list for the region pickers
└── test/
    ├── cli.js                # end-to-end, non-interactive, fake AWS CLI + temp HOME
    ├── fixtures/bin/aws      # the fake AWS CLI
    ├── rank.js, clipboard.js, shell.js, login.js, transforms.js, ini.js, migrate.js
    └── index.js              # placeholder
```

## Entry point and bundle

`index.js` is the `bin`. It checks Node.js >= 20.12 before loading anything (older versions get a message, not a syntax error), then:

- in a source checkout (`src/cli.js` exists): `require('./src/cli.js').main(process.argv)`;
- in the published package (no `src/`), or with `SWITCH_PROFILE_DIST=1`: `require('./dist/cli.js')`.

`npm run build` bundles `src/cli.js` and every dependency into `dist/cli.js` with esbuild (CommonJS, `node20.12` target). All packages are `devDependencies`: the published package has no runtime dependencies and nothing to install, which keeps `npx switch-profile` fast.

| Library | Used for |
|---------|----------|
| `commander` 14 | Commands, options, help |
| `@clack/prompts` | Inline prompts: autocomplete picker, select, confirm, text, password, multiselect, spinner, log lines |
| `fuzzysort` | Picker search |
| `uqr` | QR code of the login URL |
| Node `util.styleText` | Colors (no color library) |

## Modules

### `src/cli.js`

Defines the commands (see [CLI Interface](cli-interface.md)) and wraps every action in `run()`:

- `--debug` sets `SWITCH_PROFILE_DEBUG=1`.
- `CancelError` prints `Cancelled` and sets exit code 130.
- With `--json`, a `CliError` is written to stderr as JSON; other errors go through `ui.printError`.
- `process.exitCode` is the error's `exitCode` (default 1).

It also sets `AWS_CLI_AGENT_TOOLKIT_HINT_DISABLED=true`, so `aws configure sso` (run by `add`) does not end with a promotional prompt.

### `src/commands/`

| File | Contents |
|------|----------|
| `common.js` | `preflight()` (AWS CLI v2 check, `runMigrations`, legacy SSO offer when interactive, rewrite of an outdated `sp` block), `loadState()` (profiles, default profile, settings), `ask()` (clack cancel to `CancelError`), `describe()` (role · account · region), `loginState()` (SSO status text and `needsLogin`), `loginKey()` (key of `settings.logins`). |
| `switch.js` | `switchCommand` (default command), the status header and env warnings, `pick()` (clack autocomplete fed by `rank.rankProfiles`), `connect()` (identity check, login, retry), `switchTo()` (write default, record usage, hand to `sp`, warnings, output), `offerShortcut()`, `enableShortcut()`. |
| `login-flow.js` | `ssoLogin()` (interactive login screen, or `plainLogin()` passthrough when non-interactive) and `rememberLogin()`. |
| `index.js` | `use`, `status`, `login`, `logout`, `add` and `importFromSso`, `remove`, `settings`. Exports the command map used by `src/cli.js` and by the picker's actions. |

### `src/ui.js`

Color helpers (off when stdout is not a TTY, `NO_COLOR`, `TERM=dumb`; on with `FORCE_COLOR`), Unicode or ASCII symbols, `fit()` for columns, `isInteractive(opts)`, `CliError` (message, hint, exit code), `printError`, `ago()`, and two spinners:

- `spinner()`: clack's spinner on a TTY; a static stand-in in pipes, CI or with `ACCESSIBLE`.
- `timerSpinner()`: an elapsed-time spinner that does not touch stdin, used by the login screen so it can read keypresses (clack's spinner exits the process on Ctrl+C).

### `src/rank.js`

Pure. `rankProfiles(profiles, { query, usage, current })`, `resolveQuery()` (exact name or unique fuzzy match), `frecency()`, `recordUsage()`, `isProd()`.

### `src/clipboard.js`

`copy(text)` returns `'local'` (OS tool succeeded), `'terminal'` (OSC 52 sent, over SSH) or `null`. `osc52()` is pure and adds a tmux passthrough copy when `TMUX` is set. `openUrl()` opens the local browser and refuses over SSH.

### `src/shell.js`

Builds the managed block for zsh, bash, fish or PowerShell (function, credential clearing, tab-completion), finds/adds/removes it in startup files, detects the shell, reports status (`installed`, `active`, `outdated`), and `exportProfile()` writes the chosen name to `SWITCH_PROFILE_ENV_FILE`. See [AWS Profile Management](aws-profile-management.md#per-terminal-switching-srcshelljs).

### `src/settings.js`, `src/migrate.js`

Tool state and the storage format history; migrations keyed off `formatVersion`. See [Configuration Files](configuration-files.md).

### `src/aws/`

- `index.js`: reads the AWS files, writes them atomically, backs them up, runs the AWS CLI (`sts get-caller-identity`, `sso login` args, `login`, `sso logout`, `sso list-accounts`, `sso list-account-roles`, `configure sso`), reads the SSO token cache, caches `aws --version` in the settings file.
- `transforms.js`: pure. `[default]` rules, 1.x detection, legacy SSO upgrade, profile listing with kinds, SSO import (`populateSsoProfiles`).
- `login.js`: pure. `isRemoteSession`, `resolveLoginMode`, `loginFlags`, `parseLoginOutput`, `atLeast`.

### `src/ini.js`, `src/core.js`

`ini.js`: line-based INI edits that keep untouched lines byte for byte. `core.js`: `run()` (spawn, no shell except on Windows, fails on exit code only, `inherit` option for interactive AWS CLI commands), `exec()`, `isCommandExist()`, and the `catchErrors`/`wrapErrors` tuple helpers used by `src/aws/index.js`.

## Error handling

- `src/aws/index.js` functions mostly return `[errors, result]` tuples (`catchErrors`); commands turn errors into `CliError` with `ui.errorsMessage()`.
- Commands throw `CliError` for expected failures (message, hint, exit code 2 or 3) and `CancelError` for cancelled prompts.
- `migrate.NewerFormatError` becomes a `CliError` in `preflight()`.

## Data flow: `sp acme prod`

```
sp (shell function)                 creates temp file, sets SWITCH_PROFILE_SHELL / SWITCH_PROFILE_ENV_FILE
  └─ index.js                       Node check, picks src/ or dist/
      └─ cli.js main()              commander → run(commands.switch)
          └─ switchCommand
              ├─ preflight          AWS CLI check, migrations, legacy SSO offer, sp block upkeep
              ├─ loadState          ~/.aws/config → transforms.listProfiles, [default] name, settings
              ├─ rank.resolveQuery  exact or unique match? else header + pick() (clack autocomplete)
              └─ switchTo
                  ├─ connect        aws sts get-caller-identity
                  │                 fails + SSO → login-flow.ssoLogin → retry
                  │                 fails + console sign-in → aws login → retry
                  ├─ aws.setDefaultProfile   transforms.setDefaultProfile → atomic writes
                  ├─ settings.update(usage)
                  ├─ shell.exportProfile     writes the name to the temp file
                  └─ warnings + outro
  sp reads the temp file → export AWS_PROFILE, unset credential variables, rm temp file
```

## Data flow: `sp add` (import)

```
add → importFromSso
  ├─ choose or create [sso-session]       transforms.listSsoSessions / addSsoSession → write config
  ├─ aws.readSsoToken                      ~/.aws/sso/cache/sha1(session).json; none → ssoLogin
  ├─ aws.listSsoAccounts + listSsoRoles    6 role lookups in parallel
  ├─ region + prefix
  ├─ transforms.populateSsoProfiles        preview (prune: false)
  ├─ confirm, optional prune (backup first)
  └─ transforms.populateSsoProfiles        final → atomic write of ~/.aws/config
```
