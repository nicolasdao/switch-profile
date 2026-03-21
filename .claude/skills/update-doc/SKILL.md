---
name: update-doc
description: Update project documentation after implementing new features, API endpoints, CLI commands, architectural changes, or workflow changes that affect how the project is understood, used, or maintained. Covers docs/*.md, README.md. Maintains Tables of Contents (up to h4). Handles new doc files by linking them from README.md. NEVER modifies CLAUDE.md, MEMORY.md, specs/, or docs/manual/. Do NOT use for internal refactors, small bug fixes, dependency bumps, test-only changes, or any change that does not affect usage, behavior, APIs, or conceptual understanding.
allowed-tools: Read, Edit, Write, Grep, Glob, Bash
---

# Update Documentation

Update the relevant documentation files based on the recent changes **only if those changes meaningfully impact how the project should be understood, used, or maintained**.

---

## Section 1 — When to use this skill

### DO update documentation for

- New features or capabilities
- Changes to existing behavior, flags, options, or configuration
- Architectural changes that affect how the system works or is deployed
- Workflow changes (new deployment steps, new environment variables, new scripts)
- New or removed integrations, dependencies, or services
- Changes to data models, schemas, or API contracts

### Do NOT update documentation for

- Internal refactors that do not change external behavior
- Small bug fixes with no user-facing impact
- Dependency bumps or lock-file updates
- Test-only changes (new tests, test refactors)
- Code style or formatting changes
- Changes confined entirely to `specs/`, `docs/manual/`, or `.claude/`

If in doubt, err on the side of **not** updating — unnecessary doc churn is worse than a brief delay.

---

## Section 2 — Discovery

### Step 0 — Determine the project root

**IMPORTANT**: You may be working inside a subfolder (e.g., `web/`, `api/`, `cli/`) when this skill runs. Documentation files live at the **repository root**, not inside subfolders. You must first determine the repository root and use it as the base for all file lookups.

Run this command to get the project root:

```bash
git rev-parse --show-toplevel
```

Store this path and use it as the base for **every** Glob, Read, and Edit operation below. Never use your current working directory — always use the project root.

### Step 1 — Find documentation files

Using the project root from Step 0, glob for these patterns:

1. `<project_root>/docs/*.md` — project documentation files (**excluding `docs/manual/`**).
2. `<project_root>/README.md` — root README.

### Step 2 — Filter to relevant files

1. **Read** each candidate file found in Step 1.
2. Check whether its content overlaps with the changes you just made.
3. Only modify files whose content is actually affected by the changes.

---

## Section 3 — Update rules

### Rule 1 — Update or remove outdated content

If a change modifies or overrides previous behavior, remove outdated descriptions and replace them with accurate, up-to-date explanations reflecting the new behavior. Do not leave stale information alongside new information.

### Rule 2 — Maintain the Table of Contents

For each modified document, update its Table of Contents (TOC) accordingly — up to heading level 4 (`h4`). If the document does not have a TOC, do not add one.

### Rule 3 — Handle newly created documentation files

If new documents are added under `docs/`, include their links in the root `README.md`. Add a short summary explaining what each new document covers, so readers can decide whether they want to explore those topics in depth.

### Rule 4 — Scope constraints

Certain files and directories are off-limits. See Section 4 below.

---

## Section 4 — Protected files (NEVER modify)

The following files and directories must **NEVER** be read, edited, or written by this skill:

- **`CLAUDE.md`** — Any `CLAUDE.md` at any level of the project. These contain project instructions managed exclusively by the user.
- **`MEMORY.md`** — The Claude auto-memory file (typically inside `.claude/` or the Claude projects directory). Do not read, edit, or write any `.md` files in auto-memory directories.
- **`specs/`** — The entire specifications directory at the project root.
- **`docs/manual/`** — The entire manual documentation directory.
- **`.claude/`** — The entire `.claude/` directory (skills, commands, memory, settings).
