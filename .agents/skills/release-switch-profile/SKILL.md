---
name: release-switch-profile
description: Release switch-profile — test, lint, document, commit, version, changelog, tag, push and publish the npm CLI. Use when releasing, shipping or cutting a new version, or recording unreleased changes. Not for plain commits or docs-only updates.
argument-hint: "[patch|minor|major|unreleased|auto] [\"description\"]"
arguments: [action, note]
allowed-tools: Bash, Read, Edit, Write, Grep, Glob, AskUserQuestion, Skill
---

# Release switch-profile

Releases the `switch-profile` npm CLI end to end:

1. Run the tests and the linter.
2. Fill test gaps.
3. Update the docs (`update-doc` skill).
4. Commit everything (`git-commit` skill).
5. Pick the semver bump.
6. Bump the version.
7. Write the changelog.
8. Make the release commit and tag.
9. Push `master`.
10. Publish to npm.

This replaces standard-version: there is no `npm run rls` or `npm run push` any more.

**Arguments.**

| Argument | Values | Meaning |
|---|---|---|
| `$action` | `patch`, `minor`, `major` | Force that bump. |
| | `unreleased` | Record changes in the changelog only (Mode C). |
| | `auto` or omitted | You decide the bump. |
| `$note` | free text | Extra context. It must be reflected in the changelog and factored into the bump. |

**Project facts.**
- **Repository:** standalone git repo, branch `master`, remote `origin`. Run every command from the repository root.
- **Version:** kept in `package.json` and `package-lock.json` only; the code reads it from `package.json`. Tags are annotated `v<x.y.z>`. If the tag and `package.json` disagree, trust `package.json`.
- **Commits:** conventional commits. `feat!` or a `BREAKING CHANGE:` footer marks a breaking change.
- **Quality commands:** `npm test` (mocha, including end-to-end CLI tests against a fake AWS CLI in `test/fixtures/bin/aws`) and `npx eslint .`. `npm publish` triggers `prepublishOnly`, which re-runs lint and tests and builds and tests the bundle (`dist/cli.js`).
- **Scripts:** live in `${CLAUDE_SKILL_DIR}/scripts/`. Run them with `sh`.

## Step 0 — Pick the mode

| Mode | When | Do |
|---|---|---|
| **C — unreleased** | `$action` is `unreleased` | Section "Mode C" only. Then stop. |
| **A — hot** | This session did meaningful work on this repo | Full release. Use session context + git. |
| **B — cold** | Thin session, no context on this repo | Full release. Use git. Before classifying, show what you found and ask once: "I don't have session context for this project. Is there anything the commits don't capture — intent, trade-offs, or context I should know?" |

Start every run with `sh ${CLAUDE_SKILL_DIR}/scripts/release-state.sh --fetch`. It shows the version, last tag, branch, distance to origin, uncommitted files and commits since the last tag.

## Full release (Modes A and B)

### 1. Quality gate — hard stop

Run `sh ${CLAUDE_SKILL_DIR}/scripts/quality-gate.sh`.

- If it fails, show the failing output and offer to fix it. Re-run the gate until it passes.
- Never continue with failing tests or lint errors. There is no "proceed anyway".
- The gate uses `npx eslint .` without `--fix` on purpose. If you fix lint, run `npx eslint . --fix` or edit by hand, then re-run the gate.

### 2. Test coverage check

Run `sh ${CLAUDE_SKILL_DIR}/scripts/untested-changes.sh`. It lists source files changed since the last tag with no matching test change and no test referencing them. These are **candidates**, not verdicts.

- **Covered:** command-layer modules (`src/cli.js`, `src/commands/*`, `src/ui.js`) are exercised end to end by `test/cli.js`. Count them as covered when the changed behavior is reachable non-interactively and asserted there.
- **Not covered:** a change adds or alters behavior that no test asserts. Write the missing tests in the existing style:
  - mocha + chai `assert`
  - pure functions tested directly (`test/rank.js`, `test/transforms.js`)
  - CLI flows through `test/cli.js` with the fake AWS CLI
  - shell code through real `bash`/`zsh` in `test/shell.js`

  Then re-run the quality gate.
- **Skipping:** tell the user which candidates you judged covered and which tests you added. Skip writing tests only if the user explicitly says so.

### 3. Documentation

Skip this step when the docs are fresh. They are fresh if either holds:
- the `update-doc` skill already ran in this session after the last code change, or
- `sh ${CLAUDE_SKILL_DIR}/scripts/docs-freshness.sh` prints `FRESH`.

Otherwise, invoke the **`update-doc`** skill with a short note listing the user-facing changes since the last tag.

If the user asked not to touch docs, skip and say so.

### 4. Commit pending work — hard gate

1. If `git status --porcelain` is not empty, invoke the **`git-commit`** skill with this guidance: `commit all pending changes in the repository (code, tests, docs), not only this session's`.
2. Re-run `sh ${CLAUDE_SKILL_DIR}/scripts/release-state.sh --fetch` and check three things:
   - **uncommitted is 0.** Otherwise stop: "Cannot release — uncommitted changes remain. The release commit only carries package.json, package-lock.json and CHANGELOG.md, so the tag would not contain what it ships." Show the files and ask the user to resolve them. There is no "proceed anyway".
   - **branch is `master`.** Otherwise stop and ask.
   - **0 behind origin.** Otherwise stop and suggest `git pull --rebase`, then re-run the release.

### 5. Analyse, classify, decide the bump

**Sources, in priority order:**
1. Session context (Mode A)
2. `$note`
3. Existing `## [Unreleased]` bullets in `CHANGELOG.md`
4. `git log v<last>..HEAD`
5. `git diff v<last>..HEAD` for unclear commits

**Filtering:** ignore `chore(release)` and merge commits. Squash related commits into one logical change. Classify with Keep a Changelog categories, following [references/changelog-format.md](references/changelog-format.md).

**Bump rules:**

| Changes | Bump |
|---|---|
| Breaking: removed or incompatible behavior, changed file formats, `feat!`, `BREAKING CHANGE` | major |
| New capability | minor |
| Fixes, performance, refactors, dependencies, docs | patch |

**Nothing meaningful changed:** say what did change, then ask: proceed with a patch, or skip the release.

**Explicit `$action`:**
- **Lower than the changes warrant:** warn, and ask before using it. Never silently downgrade.
- **Higher than warranted:** accept it.

### 6. Confirm — before anything irreversible

Use AskUserQuestion and show:
- current version → new version
- bump type and why
- the exact changelog entry
- the files that will change (`package.json`, `package-lock.json`, `CHANGELOG.md`)
- the commit message `chore(release): switch-profile v<new>` and the tag `v<new>`

Options: **Proceed**, **Change bump**, **Edit the changelog first**, **Abort**.

### 7. Bump the version

Run `sh ${CLAUDE_SKILL_DIR}/scripts/bump-version.sh <new>`. It updates both files and verifies them.

### 8. Write the changelog

Edit `CHANGELOG.md` following [references/changelog-format.md](references/changelog-format.md):
- On the first run, swap the standard-version header for the Keep a Changelog header. Keep old entries untouched.
- Move `[Unreleased]` content into `## [<new>] - <today>` and add the new bullets.
- Leave an empty `## [Unreleased]` at the top.

### 9. Release commit and tag

Run `sh ${CLAUDE_SKILL_DIR}/scripts/commit-and-tag.sh <new>`. It stages only the three release files, commits `chore(release): switch-profile v<new>`, and creates the annotated tag `v<new>`. It refuses to run if any other file has changes.

### 10. Push — confirm first

1. Ask: "Push master and tag v<new> to origin?"
2. On yes, run `sh ${CLAUDE_SKILL_DIR}/scripts/push.sh <new>`.

**If the push is rejected,** someone pushed first. Stop. Never force-push. Explain the recovery:
1. `git pull --rebase`
2. `git tag -d v<new>`
3. `git tag -a v<new> -m "Release v<new>"`
4. `sh ${CLAUDE_SKILL_DIR}/scripts/push.sh <new>`

### 11. Publish to npm — separate confirmation

Ask: "Publish switch-profile@<new> to npm? This is public and cannot be undone." On yes, run `sh ${CLAUDE_SKILL_DIR}/scripts/publish.sh`. `prepublishOnly` re-runs lint and tests and builds and tests the bundle, so expect about 2 minutes.

| Result | Do |
|---|---|
| Exit `2` with `NOT_LOGGED_IN` | Tell the user to run `! npm login`, then retry. |
| Any other failure | Show the output. The tag is already pushed, so the user can retry later with `npm publish --access=public`. |
| The user declines | Say the same: they can publish later with `npm publish --access=public`. |

### 12. Handoff

Summarize:
- version and tag
- commits made (pending work, release)
- push status
- publish status, with the npm URL https://www.npmjs.com/package/switch-profile

Suggest checking the published package with `npx switch-profile@<new> --version`.

## Mode C — record unreleased changes

Records **this agent's own** changes in `## [Unreleased]` so the next release picks them up. Several agents can do this in parallel without stepping on each other.

1. Only `CHANGELOG.md` must be free of conflicting unstaged edits. Other uncommitted work is fine, but recommend committing code first.
2. Classify your own changes (session + `$note` + your commits since the last tag). Do not inventory other agents' work.
3. Create-or-amend `## [Unreleased]` per [references/changelog-format.md](references/changelog-format.md). Never remove other bullets, skip duplicates, and add no version or date.
4. Stage only `CHANGELOG.md` and commit `docs(changelog): record unreleased switch-profile change(s) — <summary>`.
5. Ask whether to push. There is no auto-deploy on push for this repo, so pushing only shares the ledger. If the push is rejected, `git pull --rebase`. On a `CHANGELOG.md` conflict, keep both agents' bullets.
6. Show which bullets went under which category.

No tests, no docs, no version bump, no tag.

## Constraints

- **NEVER** skip the quality gate or the clean-tree gate in a full release, and never offer "proceed anyway".
- **NEVER** put feature code in the release commit. It carries only `package.json`, `package-lock.json` and `CHANGELOG.md`.
- **NEVER** force-push, delete remote tags, or publish to npm without an explicit yes.
- **NEVER** reintroduce standard-version or another release tool. This skill is the release process.
- **NEVER** modify files outside the repository, print secrets, or hard-code absolute paths.
- **ALWAYS** confirm separately before:
  - the release commit and tag
  - the push
  - the npm publish
