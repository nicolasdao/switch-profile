---
name: init-doc
description: ProjectMemory — Bootstrap codebase docs from source or the session that built it. Use when a project has no docs, legacy docs to replace, or was created in this session. Not for incremental updates (update-doc) or restructuring (refactor-doc).
allowed-tools: Read, Edit, Write, Grep, Glob, Bash, Agent, AskUserQuestion
argument-hint: "[optional focus or context]"
---

# init-doc

Bootstrap comprehensive project documentation by deeply analyzing source code — or, when this session created the project, from the session itself (see [§ Session-Native Bootstrap](#session-native-bootstrap)). Works with any language, framework, or stack. For restructuring existing documentation without source analysis, use `/refactor-doc` instead.

## Standards

All documentation produced by this skill conforms to the standards in [references/standards.md](references/standards.md) — file structure, size guardrails, frontmatter, TOC rules, cross-linking, gotchas structure (hub+domain preferred), writing standards, protected files, and project root determination. **Read that file before proceeding** — it is the canonical source of truth referenced by `update-doc` and `init-mission` as well.

This skill produces:
1. **`README.md`** at project root — the documentation hub linking to all `docs/` files
2. **`docs/`** folder — detailed topic files, one per concern
3. **Gotchas documentation** — always created; hub+domain format by default (`docs/gotchas.md` hub + `docs/gotchas/<domain>.md` per subsystem)
4. **`doc-manifest.json`** at project root — the derived machine-first retrieval index, emitted by the generator at the end of Phase 4 (see [references/standards.md § Documentation Manifest](references/standards.md#documentation-manifest))

## Safety: Backup & Review (only when replacing an existing corpus)

When init-doc runs against a project that **already has documentation it will replace or delete**, it follows the shared **backup-and-review protocol** in [references/doc-review.md](references/doc-review.md). **Read that file before proceeding.** In short: once a rewrite is committed to, the existing docs are backed up to `.project-memory-backup/` *before* any legacy file is overwritten or removed; after writing, a scrutinize-derived review loop proves the new tree against the backup, then either cleans up the backup on clean convergence or keeps it and surfaces unresolved findings. The review **criterion for init-doc is "no irreplaceable knowledge lost"** — not set-equality. init-doc is *meant* to reword and reorganize from source, so anything the code itself reveals is fine to rewrite; what must survive is the hand-authored knowledge the code cannot tell you (gotchas, war stories, the reasons behind decisions, non-obvious caveats). **When there are no existing docs to protect (true greenfield bootstrap), skip backup and review entirely** — the protocol guards mutation of existing content, not fresh creation.

## Session-Native Bootstrap

The standard path assumes a session that arrives at a project it did not build, so it reconstructs understanding by scanning. When **this same session created the project** — it wrote the files, chose the stack, and hit the problems — that reconstruction re-derives decisions already in context. In that case Phases 1 and 2 are **replaced by the session**, not supplemented by it. Everything else is unchanged: same plan gate, same files, same frontmatter, same manifest. A corpus produced this way must be indistinguishable from one produced the standard way.

**Off unless affirmed.** This cannot be inferred from the repo — fresh files and a single commit look identical whether you authored them or cloned them. You know whether you created the files; the user confirms it at Phase 1. Absent an explicit yes, every phase runs exactly as written below.

| Question | Authority |
|---|---|
| What exists — files, routes, schema, config, `source` globs | **Disk.** Phase 5 resolves globs and spot-checks a few files — a backstop, not a full audit. |
| Why it is this way — decisions, rejected alternatives, constraints the user stated once | **The session.** Not recoverable from the code. |
| What went wrong building it — errors hit, workarounds, dead ends | **The session.** The reason this mode exists. |

A conflict between the two is a **finding, not a tie to break silently** — it means something was planned and not shipped, or shipped differently than discussed. Surface it at the Phase 3 gate.

**The session's failure mode is internal staleness, not missing knowledge.** The version of a file you remember writing may be several edits old, and compaction may have dropped an early decision. Both are cheap to correct: re-read the files you are least sure about, skip the ones you are sure of. That per-file judgment is what this mode licenses — it is not a blanket instruction to stop reading code.

Tag every harvested decision **shipped**, **rejected**, or **deferred**. Rejected-with-a-reason is valuable and belongs in the docs. Deferred work belongs in `specs/` — which is protected, so surface it rather than writing it.

## Process

### Step 0: Project Root

Before any other work, determine the project root following the procedure in [references/standards.md § Project Root Determination](references/standards.md#project-root-determination). All file paths in this skill are relative to that root.

### Phase 1: Reconnaissance

**Session-native check first.** If this session created the project, confirm it with the user, then **skip the reconnaissance run** and produce the same structured summary from the session instead — same sections, same detail, sourced from what you built rather than from a scan (see [§ Session-Native Bootstrap](#session-native-bootstrap)).

**One section is never sourced from the session: `Existing Documentation` is always determined from disk.** Creating a project does not mean you wrote every file in it — a scaffolder (`npm create`, `cargo new`, a template repo) emits `README.md` files nobody in the session authored, so this is exactly the field the session does not know. It is also the field that gates the Phase 3 decision and the Phase 4 backup, and a wrong "none" there overwrites real documentation with no primary source to prove the loss against. Glob for `README.md` and `docs/**/*.md` and list what is actually there before concluding the project is greenfield.

Otherwise — the default — execute the full process below.

Execute the full reconnaissance process documented in [../init-mission/reconnaissance.md](../init-mission/reconnaissance.md). This produces a structured project summary covering project identity, shape, infrastructure, and existing documentation.

#### Optional: Mission Document

After completing reconnaissance (or, in session-native mode, its session-derived equivalent), offer the user the option to create a mission document:

> "Before I dive into the codebase, would you like to create a **mission document** (`docs/mission.md`)? It captures your project's vision, values, non-goals, users, and UX compass through a short interview. This gives the documentation a strategic foundation — I can reference it to write docs that reflect what the project is actually trying to achieve, not just what the code does. It's optional and takes about 5 minutes. We can also do this later."

- **If the user accepts**: Invoke `/init-mission` and pass the reconnaissance results as the argument. Wait for init-mission to complete before continuing to Phase 2.
- **If the user declines**: Continue to Phase 2 as normal.

#### Monorepo: documentation groups

If the project is a **monorepo** (a workspace manifest — `package.json` `workspaces`, `pnpm-workspace.yaml`, `lerna.json`, or a `Cargo.toml` workspace — declaring sub-projects), note that the Phase 4 generator will **auto-derive documentation groups** from that manifest: each sub-project becomes a group, and every doc is clustered to a group via its `source` globs (see [references/standards.md § Documentation Manifest](references/standards.md#documentation-manifest)). **No separate config file is created** — the workspace declaration the repo already maintains is the source of truth. There is nothing to scaffold; just surface to the user which sub-projects were detected so they know how the docs will cluster. If a doc will document no specific code yet must belong to a group, it can carry an optional `group:` frontmatter field (the only place groups are ever hand-set).

### Phase 2: Deep Analysis

**In session-native mode this phase is replaced by the session.** You wrote the code, so steps 1–6 and 8 re-derive your own decisions. Assemble the same material from context, then read only the files you are genuinely unsure about. Steps 7 and 9 (noting gotchas, classifying them by domain) get *richer* rather than skipped — the gotchas that actually occurred during the build are what this mode is for. Everything below is the standard path.

Read source code systematically. Focus on understanding behavior, not exhaustive line-by-line reading.

1. **Start at entry points** — Read main modules to understand the core purpose and execution flow
2. **Trace data flow** — Follow how data enters the system, transforms, and exits
3. **Map APIs and interfaces** — Endpoints, routes, CLI commands, exported functions, event handlers
4. **Understand configuration** — Environment variables (check `.env.example` or equivalent), config files, feature flags
5. **Read tests** — Tests reveal expected behavior, edge cases, and integration points
6. **Identify patterns** — Architecture style, error handling, auth model, logging, naming conventions
7. **Note gotchas** — Non-obvious behavior, surprising design choices, workarounds, known limitations
8. **Check scripts** — Build, test, deploy, and utility scripts in package manifests or Makefiles
9. **Classify gotchas by domain** — Group the gotchas noted in step 7 by the project subsystem they belong to. Each group becomes a `docs/gotchas/<domain>.md` file. Use concrete domain names derived from the project's actual structure (e.g., `database`, `deployment`, `frontend`, `api`), not generic categories.

**Existing gotchas awareness:** If `docs/gotchas/` already exists with domain files, treat the existing structure as authoritative — add new gotchas to existing domain files or propose new domain files. If only a monolithic `docs/gotchas.md` exists (no `docs/gotchas/` directory), the plan in Phase 3 must include splitting it into hub + domain files.

### Phase 3: Documentation Plan

**Decision gate first (see [references/doc-review.md § Part A](references/doc-review.md#part-a--decision-gate)).** If the project already has documentation, reflect before planning a wholesale replacement: are the existing docs actually inaccurate or absent, or are they already conformant and correct? **A clean exit is a valid result** — if the existing corpus is already in good shape, say so and stop rather than replacing sound docs for the sake of it. (Greenfield projects with no docs always proceed.)

**STOP. Do NOT write any files until the user approves this plan.**

**In session-native mode, present the session-derived understanding alongside the plan** — the Phase 1 summary, plus the decisions and gotchas harvested from the build, each tagged shipped / rejected / deferred. The user never saw a reconnaissance output to check, and no cold reader can audit a conversation it was not part of, so this gate is the only place a false memory gets caught. Flag every conflict you found between what the session remembers and what is on disk.

1. **Propose the docs/ file list** — Only files relevant to this project. Use the topic catalog below.
2. **Outline each file** — Draft the section headings for README.md and each docs/ file. For each `docs/<topic>.md`, also list the `source` globs it will declare in frontmatter — the code paths it documents, drawn from the Phase 2 analysis, following the shared derivation procedure in [references/source-mapping.md](references/source-mapping.md) (schema and granularity rule in [references/standards.md § Frontmatter](references/standards.md#frontmatter)). This makes the doc→code coverage visible before writing, and surfaces any code area no proposed doc covers.
3. **Propose the gotchas structure** — List the domain files to create under `docs/gotchas/`, with the gotchas mapped to each domain
4. **Estimate sizes** — Include a rough line estimate for each proposed file. If any file is projected to exceed 750 lines, proactively split it in the plan rather than discovering the issue after writing.
5. **Note what will be replaced** — If legacy docs exist, explicitly list what will be removed
6. **Present the plan and wait for user approval**

#### Topic Catalog

Only create docs/ files that are warranted. Common topics:

| File | When to create |
|---|---|
| `docs/architecture.md` | Multi-component systems, non-trivial data flow, service interactions |
| `docs/database.md` | Schemas, migrations, data models, seed scripts |
| `docs/api.md` | REST, GraphQL, gRPC, or WebSocket endpoints |
| `docs/cli.md` | CLI tools with commands, flags, and usage patterns |
| `docs/deployment.md` | Non-trivial deploy process, CI/CD pipelines, environments |
| `docs/configuration.md` | Many env vars, config files, secrets management |
| `docs/testing.md` | Complex test setup, multiple test types, test data |
| `docs/infrastructure.md` | IaC resources, cloud services, networking, scaling |
| `docs/gotchas.md` + `docs/gotchas/*.md` | **Always created** — hub index + per-domain gotcha files |
| `docs/mission.md` | Created by init-mission — business vision, values, non-goals, users, UX compass |
| `docs/decisions.md` | Non-obvious choices with their rationale and the alternatives rejected. Warranted mainly in session-native mode, where that reasoning is in context rather than lost. Declare `source` for the code a decision governs — a packaging decision points at the IaC file. Omit it only for a decision with no code behind it |

Create additional topic files if the project demands it (e.g., `docs/auth.md`, `docs/etl.md`). Never create empty shells — every file must have substantive content.

### Phase 4: Writing

After user approves the plan. In session-native mode every step below is identical — only the content differs, because gotchas and decisions come from what actually happened during the build rather than from inference over freshly-written code:

0. **Back up any existing corpus first.** If the project already has documentation this run will replace or delete, copy `README.md` and the entire `docs/` tree (excluding `docs/manual/`) to `.project-memory-backup/` at the project root *before writing or deleting anything*, per [references/doc-review.md § Part B](references/doc-review.md#part-b--backup). This is the primary source the Phase 6 review proves against. **Skip this step entirely for a greenfield project with no existing docs** — there is nothing to protect. If a stale `.project-memory-backup/` exists from an aborted run, surface it and ask before proceeding.
1. **Create `docs/` directory** if it doesn't exist
2. **Create `docs/gotchas/` directory** and write gotchas domain files:
   - One file per domain identified in Phase 2 step 9
   - Each file: YAML frontmatter (before the h1) declaring `source` globs for that subsystem — the domain maps to a project subsystem, so its code paths are mappable just like a topic doc (see [references/standards.md § Frontmatter](references/standards.md#frontmatter)); then h1 heading, full gotcha entries with code examples (no TOC — see [§ Table of Contents Rule](references/standards.md#table-of-contents-rule))
   - Cross-link between domain files when a gotcha references another domain
3. **Write `docs/gotchas.md` hub** — thin index (30-50 lines) with:
   - h1 heading and one-line description ("Lessons learned the hard way so we don't repeat them.")
   - An index listing each domain file as a link with a one-line summary (a cross-file index, not an in-file TOC)
   - No gotcha content in this file — it is purely navigational
4. **Write other docs/ files** — each topic file with:
   - YAML frontmatter (before the h1) declaring `description`, `tags`, and `source` globs per [references/standards.md § Frontmatter](references/standards.md#frontmatter), derived via [references/source-mapping.md](references/source-mapping.md). The `source` globs come directly from the Phase 2 analysis that mapped this doc to its code — capture that mapping here rather than discarding it. Apply the granularity rule in [§ `source` semantics](references/standards.md#source-semantics): the narrowest globs that cover the doc's subject, never a catch-all like `src/**`. Glob quality is load-bearing — every consumer (recall, query, maintenance, freshness) is only as precise as the globs you write here; a sloppy `source` silently degrades all of them. Make `description` a genuine one-line summary of the doc's subject, since recall and query rank on it.
   - Clear heading hierarchy (h1 through h4 max) — **no Table of Contents** (topic docs carry none; their structure is indexed by the manifest's `headings`, per [§ Table of Contents Rule](references/standards.md#table-of-contents-rule))
   - Cross-links to related docs/ files where relevant
   - Concrete examples from the actual codebase — not generic placeholders
5. **Write README.md last** — the hub document structured as:
   - Project name (h1) and one-line description
   - A `## Table of Contents` section with empty `<!-- BEGIN toc -->` / `<!-- END toc -->` markers — the Phase 4 generator fills it from the README's headings (README is the only doc with a TOC; see [§ Table of Contents Rule](references/standards.md#table-of-contents-rule))
   - **Overview** — what the project does, why it exists, who it's for
   - **Getting Started** — prerequisites, installation, configuration, running
   - **Project Structure** — brief annotated directory layout. For monorepos, include a per-sub-project orientation (one paragraph per sub-project explaining its purpose, stack, and entry point) so readers know which docs/ file to load next.
   - **Documentation** — this section's link-list is generated, not hand-written: place the `<!-- BEGIN doc-index -->` and `<!-- END doc-index -->` markers here (empty) and the Phase 4 generator fills them from each doc's frontmatter `description` (see [references/standards.md § Documentation Manifest](references/standards.md#documentation-manifest)). Write any human narrative for the section *around* the markers — it is preserved. If `docs/mission.md` exists, place a brief explanation (outside the markers) of how it supports decision-making at two levels:
     - **Proactive (before implementation)** — when a bug fix or feature request comes in, the mission provides the lens through which to interpret and approach it. This context can steer the implementation in a direction that aligns with the project's ultimate goals — a direction that would not emerge without the mission.
     - **Reactive (when facing multiple solutions)** — when multiple valid approaches exist, the mission provides enough context to choose the best path without asking the user. The AI should only escalate to the user when there is a genuine conflict or ambiguity that the mission cannot resolve — this should be the exception, not the rule.
6. **Remove legacy docs** — delete any old README or outdated documentation files that were replaced. Only remove files you are replacing with new equivalents.
7. **Generate the documentation manifest** — after every doc is written and any legacy file removed (and before the Phase 6 review), run the deterministic generator to emit `doc-manifest.json` and fill the README managed block:

   ```bash
   python3 "${CLAUDE_SKILL_DIR}/scripts/build-doc-manifest.py" --root <project_root>
   ```

   (`${CLAUDE_SKILL_DIR}` resolves to this skill's installed directory at runtime — the script lives there, not in the user's project; never invoke it by a project-relative path.) This produces the project's machine-first retrieval index (see [references/standards.md § Documentation Manifest](references/standards.md#documentation-manifest)) — derived, committed, never hand-edited — and regenerates the README `<!-- BEGIN doc-index -->…<!-- END doc-index -->` block from frontmatter `description` and the `<!-- BEGIN toc -->…<!-- END toc -->` Table of Contents from the README's headings. In a monorepo it auto-derives doc **groups** from the workspace manifest; a single-project repo gets an ungrouped manifest and pays nothing. If the script reports no Documentation section to host the managed block, add one to the README (step 5) and re-run — do not let it guess placement.

### Phase 5: Validation

After writing all documentation:

1. **Verify cross-links** — every docs/ file must be linked from README.md; cross-links between docs/ files must point to real files
2. **Verify source globs** — every `source` glob declared in a docs/ file frontmatter must **resolve** (hit at least one real file on disk, via the Glob tool — see [references/standards.md § `source` semantics](references/standards.md#source-semantics)). Fix or remove any glob that resolves to nothing — a dead glob at creation breaks `update-doc`'s diff mapping later.
3. **Check file sizes** — verify every file respects the size guardrails defined in [references/standards.md § Size Guardrails](references/standards.md#size-guardrails). If any file exceeds its guardrail, split it.
4. **Verify gotchas integrity** — the hub exists, every domain file in `docs/gotchas/` has a corresponding entry in the hub, and every hub entry links to an existing domain file
5. **Verify the manifest** — `doc-manifest.json` exists at the project root, is valid JSON, and `python3 "${CLAUDE_SKILL_DIR}/scripts/build-doc-manifest.py" --root <project_root> --check` exits clean (the committed manifest and the README managed blocks — doc-index **and** TOC — match a fresh scan). If `--check` reports drift, re-run the generator (Phase 4 step 7) and re-validate.
6. **Spot-check accuracy** — re-read 2-3 key source files and verify documentation matches. In session-native mode this is the main defense against a stale memory, so weight it toward the files you were least certain about and any claim that came from the session rather than from disk
7. **Summarize** — list what was created and what was removed

These structural checks are the **broad battery** the Phase 6 review loop re-runs after each round of fixes.

### Phase 6: Review & Cleanup (only if a backup was taken in Phase 4)

**Skip this phase entirely for a greenfield bootstrap** (no backup exists — nothing to compare against). When a backup *was* taken, run the scrutinize-derived review loop from [references/doc-review.md § Part C](references/doc-review.md#part-c--review-loop), proving the new tree against `.project-memory-backup/` with the **"no irreplaceable knowledge lost" criterion** — *not* set-equality:

1. **Cold reader** — spawn a fresh read-only sub-agent with the backup tree, the new tree, and this criterion, *but not* your reasoning about why the new docs are better. Ask it specifically: *what did the old docs know that the source code does not — gotchas, war stories, decision rationales, non-obvious caveats — and is each still present in the new tree?* Anything re-derivable from source is not a finding; only irreplaceable hand-authored knowledge counts. Each finding grounded in `file:line` in the backup.
2. **Your two passes** — a simple pass (does every hand-authored, non-source-derivable fact from the backup survive somewhere in the new tree?) and a harvest pass (distrust your assumption that a legacy section was "just restating the code" when it actually carried a caveat: *ASSUMED redundant → TRUE per backup `file:line` → DROPPED IT on rewrite*). Run independently of the cold reader.
3. **Reconcile** — weight disagreements heaviest.
4. **Prove (hard gate)** — every "lost knowledge" claim proven by the exact text in the backup that has no equivalent in the new tree; unprovable findings dropped.
5. **Fix** — fold proven-missing knowledge into the appropriate new doc (often a gotchas domain file); surface judgment-heavy cases to the user.
6. **Confirm** — re-run the Phase 5 structural battery.
7. **Converge** — repeat until a pass surfaces no new provable finding, hard cap 3 passes. Stop on exhausted lenses, not felt certainty.
8. **Altitude check** — surface (never act on) any discovery that the chosen doc structure or domains are themselves wrong.

**Cleanup** ([§ Part D](references/doc-review.md#part-d--cleanup)): on clean convergence, delete `.project-memory-backup/` and note it in the summary. If the loop did not converge by the cap, keep the backup, list the unresolved findings, and tell the user the backup path and how to restore.

---

## Constraints

All standards rules (protected files, size guardrails, TOC, cross-linking, writing standards) are defined in [references/standards.md](references/standards.md). Workflow-specific rules for this skill:

- NEVER write documentation for code you haven't read — init-doc generates from source code analysis, or from the session that authored that code (see [§ Session-Native Bootstrap](#session-native-bootstrap)). Having read nothing satisfies neither. For restructuring existing docs, use `/refactor-doc`.
- NEVER enter session-native mode without explicit confirmation that this session created the project — it cannot be inferred from the repo, and a wrong guess means documenting a codebase nobody has read
- NEVER conclude a project is greenfield from the session — check disk. Authoring a project does not mean authoring every file in it, and a wrong "no existing docs" skips the backup that makes loss provable
- NEVER write a rejected or deferred decision as though it shipped — tag each harvested decision. Before asserting a specific fact about code you are not certain of, open the file rather than trusting recall
- NEVER skip Phase 3 — always get user approval before writing any files
- NEVER fabricate information — if something cannot be determined from source code, say so explicitly. In session-native mode the session is a legitimate second source for what code cannot show (rationale, rejected alternatives, errors hit while building); fabrication is asserting what neither the code nor the session supports
- NEVER create empty documentation files — every file must have substantive content
- NEVER overwrite or delete an existing corpus without first taking the `.project-memory-backup/` (Phase 4 step 0); when replacing legacy docs, NEVER skip the Phase 6 review that proves no irreplaceable hand-authored knowledge was lost
- NEVER delete the backup unless the Phase 6 review converged clean (greenfield bootstraps take no backup and run no review)
