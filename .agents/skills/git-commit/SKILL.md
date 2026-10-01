---
name: git-commit
description: Commit current session changes with a conventional commit message. Use when the user asks to commit, save changes, or commit session work. Accepts optional freeform guidance to steer the commit (e.g. force a scope, split into multiple commits).
allowed-tools: Bash, Grep, Glob, Read
argument-hint: "[optional freeform commit guidance]"
---

# Git Commit — Session-Aware Conventional Commit

Commit only the files changed during this session using a single-line conventional commit message suitable for changelogs.

## Step 0: Honor User Guidance (if provided)

If the invocation included an argument, it is available as `$ARGUMENTS`. Treat it as a directive that overrides or refines the default workflow below. Common cases:

- **Force a type or scope** (e.g. `"scope: auth"`, `"use chore"`) — apply it in Step 4 instead of inferring.
- **Split into multiple commits** (e.g. `"split frontend and backend"`, `"one commit per package"`) — partition the staged files accordingly and run Steps 2–5 once per group.
- **Restrict the file set** (e.g. `"only the API changes"`, `"skip the test files"`) — narrow the file list in Step 1.
- **Message constraints** (e.g. `"reference issue #421"`, `"mark as breaking change"`, `"use this exact subject: …"`) — apply in Step 4.
- **Skip pre-commit hooks** — only honor `--no-verify` if the user explicitly says so in `$ARGUMENTS`; otherwise never bypass hooks.

If `$ARGUMENTS` is empty or absent, ignore this step entirely and follow the default workflow below unchanged.

If the guidance conflicts with a hard rule (no `git add -A`, no secrets, no destructive flags), surface the conflict to the user and ask before proceeding.

## Step 1: Identify Changed Files

Run `git status --short` and `git diff --name-only` (both staged and unstaged) to see all modified, added, and deleted files in the working tree.

Cross-reference these files with the work done in this conversation session. Only include files that were created or modified as part of the current session's work. If uncertain whether a file was part of this session, check the conversation history for tool calls that wrote or edited that file.

**Do NOT include:**
- Files that were already dirty before this session started (unrelated uncommitted changes)
- Files like `.DS_Store`, `node_modules/`, or anything in `.gitignore`
- Files containing secrets (`.env`, credentials, PEM files)

If you cannot confidently determine which files belong to this session, ask the user to confirm the file list before proceeding.

## Step 2: Stage Only Session Files

Stage each identified file individually by name:

```bash
git add <file1> <file2> <file3> ...
```

**Never use `git add -A` or `git add .`** — only add the specific files from Step 1.

After staging, run `git diff --cached --stat` to show the user exactly what will be committed.

## Step 3: Review the Staged Changes

Run `git diff --cached` to read the actual diff of what is staged. Understand the substance of the changes — what was added, modified, removed, and why.

## Step 4: Write the Commit Message

Write a **single-line** conventional commit message following this format:

```
<type>(<scope>): <description>
```

**Types** (pick the most accurate one):
- `feat` — new feature or capability
- `fix` — bug fix
- `docs` — documentation changes
- `refactor` — code restructuring without behavior change
- `chore` — maintenance, config, tooling, dependencies
- `test` — adding or updating tests
- `style` — formatting, whitespace, naming (no logic change)
- `ci` — CI/CD pipeline changes
- `perf` — performance improvement

**Scope**: Short identifier for the area affected (e.g., `decoder`, `infra`, `docs`, `auth`, `api`). Use lowercase. Omit scope only if the change truly spans the entire project.

**Description rules:**
- Start with a lowercase verb in imperative mood ("add", "fix", "update", "remove", "refactor")
- Must be descriptive enough to be useful in a changelog — a reader who wasn't in this session should understand what changed and why
- Aim for 50-100 characters in the description portion (after type and scope)
- Do NOT pad with filler words, but DO include enough context to be meaningful
- If multiple things changed, summarize the overall theme rather than listing each change

**Good examples:**
- `feat(decoder): add AquaCheck and Sentek nibble-packed sensor decoders`
- `docs(readme): add project overview, architecture, and deployment guide`
- `fix(crypto): correct AES-128-CTR counter block byte order for LoRaWAN decryption`
- `chore(infra): switch from Ubuntu 22.04 to Amazon Linux 2023 for pre-installed SSM`
- `refactor(parser): extract v1 and v2 protocol parsing into separate functions`

**Bad examples:**
- `update files` (too vague, useless in changelog)
- `fix bug` (what bug? where?)
- `feat: add new feature for the sensor decoder to support the AquaCheck moisture and temperature sensor type as well as the Sentek moisture temperature and salinity sensor type with nibble-packed binary format extraction` (too long — summarize)

## Step 5: Commit

Create the commit using a heredoc to preserve formatting:

```bash
git commit -m "$(cat <<'EOF'
<the message>
EOF
)"
```

**Do NOT use `--no-verify` or `--no-gpg-sign`.**

If a pre-commit hook fails, investigate and fix the issue, then create a **new** commit (do NOT amend).

## Step 6: Confirm

Run `git log --oneline -1` to show the user the resulting commit, followed by `git status --short` to confirm the working tree state.
