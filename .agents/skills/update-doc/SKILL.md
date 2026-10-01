---
name: update-doc
description: ProjectMemory — Maintain documentation in sync with code changes. Use when shipping features, APIs, CLI commands, or architectural changes. Not for bootstrapping (init-doc), restructuring (refactor-doc), or refactors without user-facing impact.
allowed-tools: Read, Edit, Write, Grep, Glob, Bash, Agent
argument-hint: "[optional notes on what to document and how]"
---

# Update Documentation

Update the relevant documentation files based on the recent changes **only if those changes meaningfully impact how the project should be understood, used, or maintained**.

**User notes:** `$ARGUMENTS`

If the user provided notes above, treat them as the **primary guide** for this entire workflow. The notes take precedence over your own analysis — they define what to prioritize, what to emphasize, and how to frame the changes. When no notes are provided, rely on the diff analysis and your own judgment.

**Precedence exception:** User notes never override the Protected Files rule defined in [../init-doc/references/standards.md § Protected Files](../init-doc/references/standards.md#protected-files). If notes instruct modification of a protected path, refuse and surface the conflict.

---

## Standards

All documentation maintained by this skill conforms to the standards in [../init-doc/references/standards.md](../init-doc/references/standards.md) — file structure, size guardrails, frontmatter, TOC rules, cross-linking, gotchas structure, writing standards, protected files, and project root determination. That file is the canonical source of truth, shared with `init-doc` and `init-mission`. **Read it before proceeding** if you haven't already in this session.

---

## When to Use This Skill

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

## Phase 1 — Diagnostic

**Goal**: Audit the current state of all documentation files without consuming the master agent's context window. This phase produces a structured report that drives all subsequent decisions. The **mechanical** half of that report is produced deterministically by the manifest generator; only the **judgment** half needs a sub-agent.

### Step 0 — Determine the project root

Determine the project root following the procedure in [../init-doc/references/standards.md § Project Root Determination](../init-doc/references/standards.md#project-root-determination). All file operations in this skill use that path as the base. Never use the current working directory silently.

### Step 1a — Run the generator for the mechanical diagnostics

Run the deterministic manifest generator:

```bash
python3 "${CLAUDE_SKILL_DIR}/../init-doc/scripts/build-doc-manifest.py" --root <project_root>
```

(The generator is bundled in the sibling `init-doc` skill; `${CLAUDE_SKILL_DIR}` resolves to this skill's installed directory at runtime, and `../init-doc/` reaches its sibling — the same co-located layout this skill already relies on to reference `../init-doc/references/standards.md`. Never invoke the script by a project-relative path.) This (re)builds `doc-manifest.json` and, in one pass, produces **every mechanical check** the master agent needs — no sub-agent required for these (see [../init-doc/references/standards.md § Documentation Manifest](../init-doc/references/standards.md#documentation-manifest)):

- **SOURCE MAP** — each node's `source` globs partitioned into resolved vs `source_unresolved`, and `dangling` when none resolve. This is what makes the deterministic diff→doc mapping (Step 4) and the coverage check (Phase 5) possible without the master re-reading the corpus.
- **Per-node** `line_count` / `over_size`, `toc` state (`present` / `linked` / `stale`), and `links_to` (the cross-link map).
- **Top-level `diagnostics`** — gotchas hub↔domain sync (`orphaned_domain_files`, `dead_hub_links`, `oversized_domain_files`, `format`).

The master reads these directly from the manifest. If Python is unavailable, fall back to the legacy path: have the Step 1b sub-agent run the full mechanical checklist instead (noting the manifest was not refreshed).

### Step 1b — Launch the judgment sub-agent

Spawn an **Explore** sub-agent for **only the checks that require LLM judgment** — the ones the manifest cannot make:

> Read the **CONTENT REVIEW** portion of [references/diagnostic-checklist.md](references/diagnostic-checklist.md) (check 5, Content Staleness Indicators) and execute it against `<project_root>/README.md`, `<project_root>/docs/*.md` (excluding `docs/manual/`), and `<project_root>/docs/gotchas/*.md`. For each file return numeric claims, file references, feature descriptions, and code examples that may be stale after code changes. Do **not** recompute line counts, TOC state, cross-links, glob resolution, or gotchas-hub sync — those are produced by the manifest generator, not you.

The sub-agent returns only the judgment findings. The master combines them with the manifest's mechanical diagnostics into the full picture for Step 2.

### Step 2 — Parse the combined diagnostic

Classify every issue into two buckets — **deterministic fixes** come from the manifest (Step 1a), **judgment calls** from the sub-agent (Step 1b):

**Deterministic fixes** (no judgment needed — apply unconditionally):

| Issue | Action |
|---|---|
| README TOC drifted from its headings | None by hand — the generator (Step 7) regenerates the README's `<!-- BEGIN toc -->` block from its headings. Topic docs carry no TOC (see [../init-doc/references/standards.md § Table of Contents Rule](../init-doc/references/standards.md#table-of-contents-rule)). |
| File not linked from README doc index | Add link with one-line summary to README's Documentation section |
| `docs/gotchas.md` hub missing | Create it — if hub+domain format, generate from existing domain files; if no domain files exist, create with a placeholder note |
| `docs/gotchas/` directory missing (but hub references domain files) | Create the directory — the hub expects domain files to link to |
| Gotchas hub out of sync with domain files | Regenerate the hub index and link list deterministically — add entries for unlisted domain files, remove entries for deleted domain files |

**Judgment calls** (requires LLM intelligence — decide in Phase 3):

| Issue | Decision criteria |
|---|---|
| File over 750 lines | Split only if multiple concerns can be identified. A single-concern file at 780 lines is acceptable. |
| Numeric claims that may be stale | Verify against current code before changing |
| File references to renamed/deleted files | Confirm the reference is broken before fixing |
| Potential stale content sections | Only update if the diff from Phase 2 confirms the behavior changed |

---

## Phase 2 — Change Analysis

### Step 3 — Analyze the code diff

Run:

```bash
git diff HEAD~1 --name-only
```

If HEAD~1 doesn't capture all session changes (e.g., multiple commits), widen the range or use `git diff --cached --name-only` for staged changes. The goal is a complete list of modified source files.

Classify changes:
- **New files** — new modules, commands, API endpoints, utilities
- **Modified files** — changed behavior, new flags, renamed interfaces
- **Deleted files** — removed features or deprecated code

If the user provided notes, use them to focus: the notes define which changes matter most.

### Step 4 — Filter to relevant documentation files

Map the changed files from Step 3 to the docs they affect. Use the deterministic path first; fall back to judgment only for docs it cannot cover.

**Deterministic mapping (docs with `source` frontmatter) — let the generator compute it.** Pipe the changed-path list from Step 3 through the generator's `--affects` mode, which performs the [*match*](../init-doc/references/standards.md#source-semantics) test in code (pure path-vs-pattern, so a **deleted** path still maps and pulls its doc into scope). Use the same diff range you settled on in Step 3 (`HEAD~1`, a wider range, or `--cached`):

```bash
# substitute the range Step 3 settled on for HEAD~1 if you widened it
git diff HEAD~1 --name-only | python3 "${CLAUDE_SKILL_DIR}/../init-doc/scripts/build-doc-manifest.py" --root <project_root> --affects
```

It returns JSON (see [../init-doc/references/standards.md § `--affects` mode](../init-doc/references/standards.md#--affects-mode)): `affects` maps each changed path to the docs whose `source` globs match it, `docs` is the in-scope union, and `orphaned_paths` lists changed paths no doc covers (it seeds Phase 5 Step 7's orphaned-code check). This is set membership computed deterministically — not a judgment about whether a doc "could be" affected — so prefer it over eyeballing globs. If Python is unavailable **or the generator predates `--affects` (an older `init-doc`)**, fall back to matching the manifest's per-node `source` (the SOURCE MAP from Phase 1 Step 1a; schema in [../init-doc/references/standards.md § Frontmatter](../init-doc/references/standards.md#frontmatter)) against the diff by hand.

**Prose fallback (docs without `source`).** For docs that declare no `source` — abstract docs, or corpora bootstrapped before frontmatter existed — apply the impact test:

- Does the file describe a system, component, or workflow that the changes touch?
- Does the file contain counts, lists, or summaries that are now stale?
- Does the file reference files, functions, or concepts that were added, renamed, or removed?

Files with only deterministic compliance fixes (cross-links) are always included regardless of code impact.

---

## Phase 3 — Plan

### Step 5 — Build the action plan

Merge the diagnostic findings (Phase 1) with the content changes (Phase 2) into a single action plan. For each file, list:

1. **Deterministic fixes** to apply (from Phase 1 Step 2)
2. **Content updates** needed based on the code diff
3. **Structural changes** if the file is over or approaching 750 lines

**Decision rules for structural changes:**

- File is currently over 750 lines → **must split**. Identify sub-concerns that can be extracted into new focused docs/ files.
- File is under 750 lines but the planned content update would push it over → **split before writing**. Extract existing sub-concerns first, then add new content.
- File is under 750 lines and the update keeps it under → **no structural change needed**.

**Decision rules for new file creation:**

- The change introduces an entirely new subsystem, command family, or architectural component not covered by any existing doc → **create** a new `docs/<topic>.md`
- The change adds a section to an existing area (new flag on existing command) → **update** the existing doc
- When unsure → update the existing file

When creating new documentation files, follow these standards:
- Open with YAML frontmatter declaring `description`, `tags`, and `source` globs per [../init-doc/references/standards.md § Frontmatter](../init-doc/references/standards.md#frontmatter), so the new doc is mappable from day one
- Cross-link to related docs/ files
- Use concrete examples from the actual codebase, not generic placeholders
- Write for a developer who knows nothing about this project
- Ensure the file stays under 750 lines

**Gotchas routing rules:**

When code changes reveal new gotchas, determine the target file using this procedure:

1. **Detect gotchas format** — Check whether `docs/gotchas/` directory exists with at least one `.md` file.
   - If YES → hub+domain format. Route new gotchas to domain files.
   - If NO → monolithic format. Add gotchas directly to `docs/gotchas.md`. If the file exceeds 750 lines after adding, append a note in the summary: *"Your gotchas.md is [N] lines. Consider running `/refactor-doc` to split it into domain files."*

2. **Route to domain file** (hub+domain format only):
   - List existing domain files in `docs/gotchas/`
   - Match the new gotcha to an existing domain by topic (e.g., a NeonDB gotcha goes to `docs/gotchas/database.md`)
   - If no existing domain file matches, create a new `docs/gotchas/<domain>.md` with frontmatter (`source` globs for the subsystem, per [../init-doc/references/standards.md § Frontmatter](../init-doc/references/standards.md#frontmatter)), h1, and the new gotcha entry (no TOC — domain files carry none)

3. **Sync the hub** (hub+domain format only, deterministic):
   - After any domain file is created or modified, regenerate `docs/gotchas.md`:
     - Read all files in `docs/gotchas/`
     - For each domain file: extract the h1 heading and build a one-line summary
     - Rebuild the hub index: one link per domain file with its summary
     - Write the hub — this is a full regeneration, not a partial patch
   - Verify every hub link points to an existing file

---

## Phase 4 — Execute

### Step 6 — Apply all changes

Process files in this order:

1. **Structural splits first** — If any file needs splitting, do it before modifying content. Create the new focused files, move the extracted content, and update cross-links.
2. **Content updates** — Apply content changes to each affected file. Follow these writing standards:
   - Use the project's actual terminology, variable names, and conventions
   - Include concrete examples from the actual codebase when adding new content
   - Remove outdated descriptions when behavior has changed — do not leave stale information alongside new information
   - When the diff renamed, moved, or deleted code a doc documents, update that doc's `source` globs in the same pass so the mapping stays accurate
3. **README TOC** — regenerated by the Step 7 generator from the README's headings; no per-file TOC work is needed, and topic docs carry no TOC.
4. **Cross-link fixes** — Add any missing links (README doc index, inter-file cross-references).
5. **Gotchas files** — Apply the gotchas routing rules from Phase 3:
   - **Monolithic format**: Add new gotchas directly to `docs/gotchas.md`. If the file was flagged as missing, create it.
   - **Hub+domain format**: Write new gotchas to the appropriate `docs/gotchas/<domain>.md` file (create the domain file if needed). Then regenerate `docs/gotchas.md` hub deterministically: read all domain files, rebuild the link list from their headings. This is a full regeneration — not a selective patch.
   - If no new gotchas were discovered and the hub is already in sync, no gotchas changes are needed.

### Step 7 — Regenerate the manifest and README doc index

After all file operations are complete, run the generator to refresh the machine index and the README managed block in one deterministic pass:

```bash
python3 "${CLAUDE_SKILL_DIR}/../init-doc/scripts/build-doc-manifest.py" --root <project_root>
```

This rewrites `doc-manifest.json` and regenerates the README `<!-- BEGIN doc-index -->…<!-- END doc-index -->` block from frontmatter `description` — so every `docs/*.md` gets an up-to-date entry, deleted files drop out, and the index cannot drift from the manifest (see [../init-doc/references/standards.md § Documentation Manifest](../init-doc/references/standards.md#documentation-manifest)). Do not hand-edit entries between the markers. For monorepo projects, still verify the README's **Project Structure** narrative includes per-sub-project orientation if applicable (that prose is outside the managed block and is not generated).

---

## Phase 5 — Validate

### Step 8 — Final compliance pass

Run through each modified file and verify:

1. **Size guardrails** — README.md ≤ 750 lines, each docs/ file ≤ 750 lines, gotchas hub ≤ 50 lines. If any file exceeds the guardrail after updates, split it now.
2. **README TOC** — the README's `<!-- BEGIN toc -->` block is regenerated by the generator (Step 7) and verified by `--check` (Step 8); topic docs carry no TOC.
3. **Cross-links** — Every docs/ file is linked from README. New files are cross-referenced from at least one other doc.
4. **Counts and summaries** — Numeric claims in updated files match the current state.
5. **No stale content** — Updated files do not contain descriptions of old behavior alongside new behavior.
6. **Gotchas integrity**:
   - `docs/gotchas.md` exists (hub or monolithic)
   - If hub+domain format: every domain file in `docs/gotchas/` has a corresponding entry in the hub, and every hub entry links to an existing domain file
   - No domain file exceeds 750 lines
7. **Frontmatter coverage** (driven by the freshly regenerated manifest from Step 7):
   - **Live globs** — the manifest's `source_unresolved` per touched doc lists `source` globs that no longer **resolve**. Repair those broken by this session's renames or deletions.
   - **Dangling docs** — any doc the manifest marks `dangling: true` (declares `source` but none of its globs resolve) is a candidate to update or remove, because the code it documented was deleted. This is corpus-wide — the deleted code's doc is usually NOT touched this session, so rely on the manifest, not the touched-file set. Surface in the summary; never delete docs automatically.
   - **Orphaned code** — changed source paths that fall under **no** doc's coverage. The generator's `--affects` `orphaned_paths` (Phase 2 Step 4) computes exactly this set against every `source`-declaring doc; from it, subtract any path a prose-fallback doc covers. Surface as documentation candidates; never auto-create. **Caveat for partial migration:** when many docs still lack `source` (prose-fallback corpus), suppress any path a prose-fallback doc plausibly covers — orphan flagging is advisory and becomes reliable only as `source` coverage approaches the whole corpus. **Caveat for renames:** a rename appears in the diff as a deletion (old path) plus an addition (new path); suppress the add-side when the delete-side already pulled a doc into scope — that is the same documented code being re-pointed this session (Step 6 updates that doc's globs), not new undocumented code. When in doubt, omit rather than flood the summary.
8. **Manifest in sync** — confirm `doc-manifest.json` was regenerated (Step 7) and that `python3 "${CLAUDE_SKILL_DIR}/../init-doc/scripts/build-doc-manifest.py" --root <project_root> --check` exits clean (committed manifest + README managed block match a fresh scan). If `--check` reports drift, re-run the generator and re-validate.

### Step 9 — Summarize

List what was done:
- Files updated (with brief description of changes)
- Files created (with reason)
- Files split (with what was extracted where)
- Deterministic fixes applied (cross-links, README doc-index + TOC, hub sync)
- Coverage flags (from Phase 5 step 7): orphaned code with no documenting doc, and dangling docs whose source was deleted — listed as recommendations, not auto-applied

---

## Standards Reference

All standards rules — protected files, size guardrails, TOC requirements, cross-linking, gotchas structure, writing standards, and project root determination — are defined in [../init-doc/references/standards.md](../init-doc/references/standards.md). That file is canonical; the rules cited inline in the phases above are operational applications of those standards.
