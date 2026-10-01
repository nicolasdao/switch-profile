---
name: create-release-skill
description: Release skills — generate a tailored release skill for a project by reverse-engineering its type, versioning, and conventions. Use when setting up release automation or adding release workflows to a project. Not for running an existing release.
arguments: [project_path, instructions]
argument-hint: "[project-path] [\"custom instructions\"]"
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion
---

# Create Release Skill

Generate a tailored release skill for any project by reverse-engineering its type, determining the versioning strategy, and gathering project-specific requirements through conversation.

## Arguments

Both arguments are optional. If omitted, the skill resolves them interactively.

- **$project_path** (optional): Path to the project directory. Can be absolute or relative. If omitted, the skill discovers candidate projects and asks the user to choose.
- **$instructions** (optional): Quoted description of custom release requirements. If omitted, the skill asks whether there are custom requirements.

## Step 0 — Resolve Arguments

If `$project_path` is empty (no arguments passed), resolve it interactively:

1. **Discover candidate projects.** From the current working directory, list immediate subdirectories that look like projects (contain `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, `src/`, `Makefile`, or other project markers from [references/project-types.md](references/project-types.md)). Also include the current working directory itself as a candidate (labeled with its name, e.g., "this directory (ivan/)").
2. **Ask the user to choose.** Use AskUserQuestion to present the discovered candidates as options (max 4 — prioritize the most likely projects). The user can always select "Other" to type a custom path. If only the root directory is detected, still ask to confirm.
3. **Set `$project_path`** to the user's selection.

If `$instructions` is empty AND was not passed as an argument:

4. **Ask about custom requirements.** Use AskUserQuestion: "Are there any specific custom requirements for this release skill (e.g., deployment steps, pre-release checks, notifications)?"
   - **"No, standard release is fine"** — proceed with no custom instructions
   - **"Yes, I have specific requirements"** — ask the user to describe them, then use their response as the starting context for Phase 2

## Pre-flight Checks

Verify these hard requirements before anything else. If any fail, stop and show the user how to fix it.

1. **Node.js and npx**: Run `npx --version`. If it fails, tell the user to install Node.js 18+.
2. **HappySkills CLI**: Run `npx happyskills --version`. If it fails, tell the user to run `npx happyskills setup`.
3. **HappySkills Design skill**: Phase 3 delegates all scaffolding and structural best practices to the `happyskills-design` skill (declared in this skill's `dependencies`). Confirm it is installed by checking for its SKILL.md in these locations (check in order, stop at first match):
   - `.agents/skills/happyskills-design/SKILL.md` (project-level)
   - `~/.agents/skills/happyskills-design/SKILL.md` (global)
   - `.claude/skills/happyskills-design/SKILL.md` (project-level, Claude convention)
   - `~/.claude/skills/happyskills-design/SKILL.md` (global, Claude convention)
   If not found, tell the user to run `npx happyskills install happyskillsai/happyskills-design` (or `npx happyskills setup` for the full HappySkills family). Do NOT fall back to authoring the skill structure by hand — `happyskills-design` owns skill form and structure.
4. **Project path**: Verify `$project_path` exists and is a directory. (Already resolved in Step 0 if it was empty.)
5. **Git**: Run `git --version`. Git is a hard requirement for all release skills.

## Phase 1 — Project Discovery

Analyze the project at `$project_path` to determine its type, versioning, and repository context.

### 1.1 Project Type and Version Management

Scan the project root for markers that identify the project type and where versions are managed. Read [references/project-types.md](references/project-types.md) for the complete discovery table.

Key outcomes:
- **Project type** (Node.js, Python, Rust, Go, documentation, etc.)
- **Version file** and how to read/write it
- **Fallback**: If no convention exists, use a plain `VERSION` file in the project root

### 1.2 Repository Context

Determine from git:
- **Monorepo detection**: Is `$project_path` a subdirectory of the git root? (`git rev-parse --show-toplevel`)
- **Tag format**: Monorepo sub-project uses `<project-name>-v<version>` (e.g., `frontend-v1.2.0`). Standalone uses `v<version>`.
- **Project name**: Derive from directory name or package manifest `name` field.

### 1.3 Documentation and Existing Release Process Discovery

Scan the project for documentation and artifacts that describe existing release processes. This is critical — the generated skill must not break established workflows, and discovered information reduces the back-and-forth needed in Phase 2.

**Files to scan (read if they exist):**

| File/Location | What to look for |
|---|---|
| `README.md`, `README.rst` | Release/deployment sections, build instructions, contributing guidelines |
| `CONTRIBUTING.md` | Release workflow, versioning policy, commit conventions |
| `CHANGELOG.md` | Existing format and conventions (to preserve, not override) |
| `docs/` directory | Files with "release", "deploy", "development", "contributing" in the name |
| `CLAUDE.md`, `.claude/` | AI-specific project instructions that may reference release processes |
| Package manifest scripts | `package.json` "scripts" (look for "release", "deploy", "version", "publish"), `Makefile`/`justfile`/`Taskfile.yml` targets |
| `scripts/` directory | Files with "release", "deploy", "version", "publish", "bump" in the name |
| `.github/workflows/` | CI/CD pipelines that may run on tags or releases |
| `.gitlab-ci.yml`, `Jenkinsfile` | CI/CD definitions with release stages |

**How to scan efficiently:**
- Do NOT read every file end-to-end. Use Grep to search for keywords: "release", "deploy", "version", "publish", "tag", "changelog", "bump"
- Read only the relevant sections of files that match
- For `docs/`, list filenames first, then read only those that look release-related

**Key outcomes:**
- **Existing release scripts** — if the project already has release automation (e.g., `npm run release`, `make release`, a CI pipeline triggered by tags), document them. The generated skill should integrate with these, not replace them.
- **Deployment process** — how the project gets to production (if documented). Pre-populates the post-release actions topic in Phase 2.
- **Existing conventions** — commit message format, changelog style, versioning policy. The generated skill should respect these.
- **CI/CD integration** — if pushing a tag triggers a pipeline, the generated skill must know this to avoid redundant steps or to include the push as a release step.

### 1.4 Present Discovery Summary

Show the user:
- Project type detected
- Version file location and current version (or "will create VERSION file")
- Monorepo vs standalone
- Tag format that will be used
- Changelog location: `CHANGELOG.md` in project root (always)
- **Existing release process** (if discovered) — summarize what was found and highlight anything the generated skill should integrate with or preserve
- **Documentation gaps** — if no release documentation was found, note this

Use AskUserQuestion to confirm or correct the discovery results before proceeding.

## Phase 2 — Requirements Gathering

Engage in conversation to gather all project-specific release requirements.

### 2.1 Starting Context

If `$instructions` was provided, acknowledge what the user described and ask clarifying questions about anything ambiguous.

If `$instructions` was not provided, explain that you will ask a few questions to understand how releases should work for this project.

### 2.2 Topics to Cover

At minimum, discuss these (some may already be answered by `$instructions`):

1. **Invocation preference** — Ask with AskUserQuestion: "Should Claude be able to auto-invoke this release skill when you ask to release, ship, or cut a version? Or should it only respond to the /slash command?"
   - **"Auto-invoke (Recommended)"** — Claude triggers when the conversation matches (e.g., "release the frontend", "ship a new version", "cut a release"). Safe because the skill always confirms before any irreversible action.
   - **"User-only (/slash command)"** — Only manual `/release-<name>` invocation. Claude will not know the skill exists. Choose this only if accidental triggering is a concern.
   Record the choice — it determines `disable-model-invocation` in frontmatter and how the description must be crafted in Phase 3.
2. **Pre-flight checks** — Should tests pass before releasing? Must the build succeed? Any other gates?
3. **Related paths** — In a monorepo, are there related directories to check for uncommitted changes? (e.g., database migrations that accompany API changes)
4. **Post-release actions** — What happens after version bump + changelog + commit + tag?
   - Just commit and tag (user handles the rest)
   - Push to remote (`git push && git push --tags`)
   - Deploy (how — Pulumi, Vercel, npm publish, Docker, etc.)
   - Other custom steps
5. **Blast radius** — Are there cross-project dependencies or side effects to verify before releasing?
6. **Custom steps** — Anything else specific to this project (scripts, notifications, docs updates, etc.)

### 2.3 Conversation Guidelines

- Ask focused questions, one topic at a time
- Offer concrete options via AskUserQuestion when possible
- If the user says "that's it" or "nothing else", stop asking and move on
- Do NOT over-ask — respect the user's signal that requirements are complete

### 2.4 Final Confirmation

Present a complete summary of everything that will go into the generated skill:
- Project type and version management strategy
- Invocation preference (auto-invoke or user-only)
- All release steps in order
- Mode A/B/C support (always included)
- Arguments: `[action, note]` (always included)
- Pre-flight checks
- Post-release actions (if any)

Use AskUserQuestion for final confirmation before generating.

## Phase 3 — Skill Generation

### 3.1 Determine Skill Name

Derive from the project: `release-<project-name>` (e.g., `release-frontend`, `release-web-apis`). Confirm with the user via AskUserQuestion.

> **Phase 3 splits into content and form.** `create-release-skill` owns the **content** of the release skill (what it does — assembled in 3.2). `happyskills-design` owns the **form** (how it is scaffolded and structured — delegated in 3.3). Verify the result in 3.4.

### 3.2 Assemble the release-skill content spec

This is `create-release-skill`'s realm. Produce a written brief that `happyskills-design` will shape into a well-formed skill in 3.3. The brief MUST capture three things:

**A. Core behaviors the generated skill must implement** (from [references/release-skill-spec.md](references/release-skill-spec.md) — the content authority):

1. Pre-flight check (clean working directory — hard gate)
2. Mode detection (A/B/C based on session context and $action)
3. Change analysis (session context + git log + diffs + existing [Unreleased] notes)
4. Change classification (Keep a Changelog categories)
5. Bump determination (patch/minor/major or "nothing worth releasing")
6. Changelog update (CHANGELOG.md in project root, Keep a Changelog format)
7. Version bump (update the version file)
8. Git commit (conventional message: `chore(release): <project> v<version>`)
9. Git tag (annotated, format per monorepo/standalone detection)
10. User confirmation before irreversible actions

**B. Project-specific content** gathered in Phases 1–2: project type, version file and tag format, the post-release/deploy procedure to document, any existing release process to preserve, and the custom requirements the user described.

**C. Form decisions already made** — pass these THROUGH so `happyskills-design` does NOT re-ask the user:
- **Skill name** (from 3.1).
- **Invocation model** — auto-invoke vs user-only, decided in Phase 2. Determines `disable-model-invocation`.
- **Arguments** — always `[action, note]`, hint `[patch|minor|major|unreleased] ["description"]`.
- **Description inputs** — raw material for the five-slot description (design composes the final string per its grammar): the project's release *family* (Domain), what the skill does (verbs), the concrete project name (Object), trigger phrases, and whether sibling `release-*` skills exist (Negative). Detect siblings with `ls .agents/skills/ .claude/skills/ 2>/dev/null | grep '^release-'`.

### 3.3 Delegate scaffolding and structure to happyskills-design

Do **not** scaffold, structure, or write the skill files yourself. Invoke the **`happyskills-design`** skill (its Authoring Workflow) and hand it the brief from 3.2. `happyskills-design` owns the **form**: running `npx happyskills init`, composing the five-slot `description` per its grammar, organizing SKILL.md (under 500 lines), splitting content across `references/`/`scripts/`/`assets/`, setting frontmatter, writing `skill.json` metadata, validating, and post-init enrichment.

When invoking it:
- Provide the content (3.2.A + 3.2.B) as the skill's substance, and the form decisions (3.2.C) as **already settled** — instruct it to apply the pre-decided invocation model and arguments and NOT re-ask the user about purpose or invocation.
- Let `happyskills-design` run its own standard steps that Phase 2 did not cover (e.g., the mandatory authors/license/repository enrichment prompts).
- Any executable release commands the generated skill needs go in its `scripts/` per design's best practices — never embedded in the generated SKILL.md.

### 3.4 Verify the generated skill

After `happyskills-design` returns:

1. Confirm the generated skill exists and validated cleanly. `happyskills-design` runs `npx happyskills validate` internally — if it reported errors, resolve them with design before continuing.
2. Confirm the generated SKILL.md implements every core behavior from the content spec (3.2.A) and every project-specific requirement (3.2.B).
3. If anything from the content spec is missing or misshapen, hand the gap back to `happyskills-design` to fold in — do not patch the structure yourself.

## Phase 4 — Handoff

After successful generation:

1. Show the complete generated SKILL.md content
2. Show the file structure created (tree view)
3. Explain how to invoke: `/release-<project-name>`, `/release-<project-name> unreleased`, `/release-<project-name> minor "Added feature X"`
4. Remind about Mode C: "Use `unreleased` to record your changes into the `[Unreleased]` changelog ledger mid-session, without doing a full release — the next release sweeps it up. Multi-agent-safe: each agent records its own."

## Constraints

- NEVER generate a release skill without completing all three phases (discovery, requirements, generation)
- NEVER skip pre-flight checks
- NEVER assume project type without scanning — always verify by reading actual files
- NEVER create a release skill that modifies files outside the target project directory
- NEVER include secrets, credentials, or environment-specific values in generated skills
- NEVER embed absolute paths in generated skills — all paths must be relative (to the project root, git root, or use `${CLAUDE_SKILL_DIR}` for skill-bundled files). Absolute paths break portability across machines and users
- NEVER skip user confirmation before generating the final skill
- ALWAYS delegate scaffolding, file structure, frontmatter, the five-slot description, and validation to the `happyskills-design` skill (Phase 3.3) — never run `npx happyskills init`, hand-author the skill structure, or re-implement skill-authoring best practices in this skill
- NEVER write the generated skill's files yourself — `happyskills-design` owns skill form and structure, this skill owns only the release content (the brief in Phase 3.2)
- ALWAYS verify the delegated result implements the full content spec before handoff (Phase 3.4)
- ALWAYS ask the user about invocation preference during Phase 2 — never assume user-only or auto-invoke without asking
- ALWAYS include Mode A, B, and C support in every generated skill
- If the project has no previous releases (no tags, no CHANGELOG.md), the generated skill should start at version 0.1.0 for the first release
