# Changelog

## [1.10.0] - 2026-07-30

### Added
- **Session-native bootstrap — documenting the session that gave birth to the project.** init-doc's standard path assumes a session arriving at a project it did not build, so it reconstructs understanding by scanning. When the *same* session created the project, that reconstruction re-derives decisions already in context — and the knowledge worth capturing (why a choice was made, what was rejected, which errors were hit) exists nowhere on disk and evaporates when the session closes. A new **§ Session-Native Bootstrap** section defines the mode: Phases 1 and 2 are **replaced by** the session rather than supplemented by it, with an explicit authority split — **disk is authoritative for what exists** (files, routes, schema, `source` globs), **the session for why it is that way and what went wrong building it** — and a conflict between them treated as a finding to surface, not a tie to break silently.
- **`docs/decisions.md` in the Topic Catalog** — non-obvious choices with rationale and rejected alternatives. Warranted mainly in session-native mode; legitimately carries no `source` under the existing abstract-doc carve-out (`references/source-mapping.md` step 5), so no schema change was needed.
- **Four constraints** — session-native mode requires explicit confirmation (it cannot be inferred from a repo, since fresh files and a single commit look identical whether authored or cloned); greenfield is never concluded from the session; a rejected or deferred decision is never written as though it shipped; and an uncertain claim about code is checked by opening the file rather than trusting recall.
- **`Existing Documentation` is exempt from the session substitution and always determined from disk.** Creating a project does not mean authoring every file in it — a scaffolder emits `README.md` files nobody in the session wrote — and this is the field that gates the Phase 3 decision and the Phase 4 backup. Sourcing it from the session lets a birth session skip the backup and overwrite real documentation with no primary source to prove the loss against, which is the exact failure `references/doc-review.md` exists to prevent.

### Changed
- **Constraint "NEVER write documentation for code you haven't read"** now states that authoring the code in this session satisfies it, while reading nothing never does. As written, the rule forbade the new mode outright — an agent would have hit it and silently fallen back to full reconnaissance.
- **Phase 1** gains a session-native check before the reconnaissance run; **Phase 2** notes that steps 1–6 and 8 are replaced by the session while steps 7 and 9 (gotchas and their domain classification) get richer; **Phase 3** requires the session-derived understanding to be presented alongside the plan, since the user never saw a reconnaissance output and no cold reader can audit a conversation it was not part of; **Phase 5** step 6 weights spot-checks toward low-confidence files and session-sourced claims — the main defense against a stale memory of a file edited several times since.
- **SKILL.md and skill.json descriptions** name the birth-session trigger, so the mode is reachable by description rather than only by an explicit `/init-doc`. The SKILL.md description sits at 243 chars against the 250-char soft cap, leaving little room for a future trigger.

### Compatibility
Backward compatible. The mode is off unless affirmed, so absent an explicit yes every phase runs exactly as in 1.9.0. `scripts/build-doc-manifest.py` and all three shared `references/` files (`standards.md`, `doc-review.md`, `source-mapping.md`) are **unchanged** — the latter are shared with `update-doc`, `refactor-doc`, `init-mission`, `init-context`, and `project-memory`, and everything the new mode needs was already permitted by them. The generator being untouched means the manifest format and the `--check` / `--drift` / `--affects` contracts cannot regress. Phase 6 needed no edit because it gates on whether Phase 4 took a backup, not on which mode ran — a birth session that scaffolded a `README.md` along the way is *not* greenfield, so it backs up and runs the review exactly as before.

## [1.9.0] - 2026-06-18

### Changed
- **Table of Contents is now README-only and generated, not authored — an agent-first change.** The generator regenerates the README's TOC from its own headings into a new `<!-- BEGIN toc -->…<!-- END toc -->` managed block (single-sourced like the doc-index block, so it can never go stale). `docs/*.md`, `docs/mission.md`, and gotchas domain files no longer carry a TOC: their structure is already indexed by the manifest's `headings`, and the single-concern ≤ 750-line cap keeps a topic doc graspable in one read — so a per-doc TOC was redundant for an agent while adding maintenance churn and a stale-TOC failure mode (a stale TOC actively misleads). `references/standards.md § Table of Contents Rule` is rewritten; Phase 4 writes topic docs without a TOC and places the README TOC markers; Phase 5 `--check` covers both README managed blocks.
- **`build-doc-manifest.py`** gains README TOC generation — `build_toc` / `update_readme_toc`, sharing one `toc_entries` source with the staleness diagnostic so generation and `--check` can never disagree — plus `extract_headings_with_levels`.

## [1.8.0] - 2026-06-15

### Added
- **Concision writing standards (`references/standards.md § Writing Standards`).** Three new rows formalize the "remove waste, not grammar" discipline shared by every writer skill: **Concision** (cut filler/hedging, lead with the fact, prefer the shorter word), **Concision limits** (keep prose grammatical — never drop articles, collapse clauses into bare arrows, abbreviate domain terms, or use headline fragments, because a doc read cold by an absent agent turns ambiguity into a silent wrong action), and **Retrieval signal** (frontmatter `description` stays a full sentence so `init-context`/`project-memory` ranking is not degraded). `update-doc` and `refactor-doc` inherit these via their existing Writing Standards reference — no change needed in those skills.
- **Gotcha entry style (`references/standards.md § Gotchas Structure`).** A terse lead-with-the-hazard shape for gotcha entries (trigger → consequence → fix) that keeps the relationship words rather than bare arrows. Applied by `init-doc` (writes gotchas) and `update-doc` (appends them).

### Fixed
- **Stale `/init-doc refactor` references in `references/standards.md`** (Size Guardrails and Gotchas Structure sections) corrected to `/refactor-doc`. Refactor mode was removed from init-doc in 1.0.0 (BREAKING) and moved to `nicolasdao/refactor-doc`, but these two instructions still pointed users at the removed command.

## [1.7.0] - 2026-06-15

### Added
- **`build-doc-manifest.py --affects` — the deterministic `match` operation.** New write-free mode (sibling to `--check`/`--drift`): reads a newline-separated path list on stdin (e.g. `git diff --name-only`) and prints JSON — `affects` (each changed path → the docs whose `source` globs match it), `docs` (the in-scope union), and `orphaned_paths` (changed paths no doc covers). A pure path-vs-pattern test implemented in code, so a **deleted** path still maps to its doc. This makes good on the "set membership, not inference" claim `update-doc`'s diff→doc mapping has always made — previously the match was left to LLM judgment. New `references/standards.md § --affects mode` documents it, and `§ source semantics` notes match is now code.

### Changed
- **`references/standards.md § Frontmatter`** now names the manifest generator as the *primary* frontmatter reader and the manifest as the index downstream skills actually consume — the earlier "three consumers read it" framing predated the manifest and described direct header reads.
- **`references/standards.md § --check mode`** now documents the three-way exit-code contract explicitly: **0** in sync, **1** stale (regenerate via a producer), **2** structural (no `README.md` / no `## Documentation` section — a structural fix, not a regeneration).

### Fixed
- **TOC-staleness false positive on duplicate headings.** `toc_diagnostics` now mirrors GitHub's `-1`/`-2` slug disambiguation when building the expected-anchor set, so a correct TOC over repeated headings is no longer perpetually flagged stale (which drove needless TOC churn).
- **README managed-block misplacement.** Block placement now prefers a heading whose text is exactly "Documentation" (falling back to any heading containing it), so a real `## Documentation` wins over a preceding `## API Documentation` — while a legacy `## Project Documentation` section still hosts the `<!-- BEGIN doc-index -->` block.
- **Script docstring** now documents `--drift` and `--affects` (it previously listed only `--root`/`--check`).
- **`skill.json` declares `systemDependencies`** (`git`, `python3`) — both are invoked by the skill and its bundled generator but were previously undeclared, per HappySkills' "declare everything, assume nothing" rule.
- **`skill.json` now declares `authors` and `license` (`BSD-3-Clause`)** — aligning every constellation member on one license and author identity (the constellation previously mixed BSD-3-Clause, MIT, and none).

## [1.6.0] - 2026-06-15

### Added
- **`build-doc-manifest.py --drift` — structural-drift detection (write-free).** A new analysis mode, sibling to `--check`, that answers a different question: not "is the manifest stale?" but "has the documentation's domain *structure* aged against the code?" — the slow drift a long-lived project accumulates. It prints deterministic, mechanical signals as JSON — `dangling_docs` (docs whose code is gone), and in a monorepo `groups_without_docs` (undocumented sub-projects) and `cross_group_docs` (docs straddling sibling sub-projects). Writes nothing and never appears in the committed manifest. Consumed by `project-memory` Inspect, which adds a judgment pass for single-project uncovered-source and recommends `/refactor-doc` re-architect mode when drift accumulates. `references/standards.md § Documentation Manifest` documents the new mode.

## [1.5.0] - 2026-06-14

### Added
- **Documentation Manifest — a derived, machine-first retrieval index.** New canonical section `references/standards.md § Documentation Manifest` defines `doc-manifest.json`: one committed JSON file at the project root listing every doc as a self-contained record (frontmatter, headings, cross-links, resolved `source`, per-node diagnostics, and — in a monorepo — its group), so a reader pinpoints docs in a single read instead of traversing the cross-link graph. Derived, never hand-edited (same contract as the gotchas hub).
- **`scripts/build-doc-manifest.py` — the deterministic generator (Python 3, no third-party deps).** Scans `README.md` + `docs/**/*.md` (excl `docs/manual/`), hand-parses the strict frontmatter subset, resolves `source` globs (resolved vs `source_unresolved`, `dangling`), regenerates the README `<!-- BEGIN doc-index -->…<!-- END doc-index -->` managed block from frontmatter `description`, folds in the mechanical half of `update-doc`'s diagnostic (TOC state, over-size, gotchas hub↔domain sync, README orphans), and emits byte-identical output across runs. `--check` mode reports drift (non-zero exit) without writing.
- **Documentation groups (derived structural clustering).** In a monorepo, the generator auto-derives one group per sub-project from the repo's existing **workspace manifest** (`package.json` workspaces, `pnpm-workspace.yaml`, `lerna.json`, `Cargo.toml` workspaces) — **no separate config file**. Membership is derived from each doc's `source` globs; nesting is path containment; a source-less doc may carry an optional `group:` frontmatter override. Single-project repos produce an ungrouped manifest and pay nothing. Groups are the structural/containment retrieval axis; `tags` remain the cross-cutting/affinity axis.
- **README single-sourcing.** The Documentation link-list is single-sourced from frontmatter `description` into the managed block, so it cannot drift from the manifest.

### Changed
- **Phase 4** gains step 7 (run the generator to emit the manifest + fill the README managed block, after all docs written, before the Phase 6 review); step 5 now places the managed-block markers instead of a hand-written link-list. **Phase 5** gains a manifest-validity + `--check`-clean assertion. **Phase 1** surfaces detected monorepo sub-projects so the user knows how docs will cluster (nothing to scaffold — groups are derived).
- `references/standards.md` updated: new Manifest section + TOC entry, `doc-manifest.json` registered in File Structure, optional `group:` field added to the Frontmatter table, Cross-Linking notes the managed block is single-sourced.

## [1.4.0] - 2026-06-14

### Added
- **Shared `source`-derivation procedure** extracted to `references/source-mapping.md` — the step-by-step methodology for mapping a doc to its narrowest resolving `source` globs via source analysis (establish subject → targeted reconnaissance → narrowest globs → resolve → abstract-doc carve-out). It is now the canonical procedure, referenced by `init-doc` (Phase 3 planning and Phase 4 emission) and reused by `refactor-doc` under its frontmatter-backfill exception, so both skills derive globs identically.

### Changed
- Phase 3 step 2 and Phase 4 step 4 now point at `references/source-mapping.md` for *how* to derive `source` globs; `references/standards.md § Frontmatter` remains the schema/granularity authority. No behavior change for init-doc — this formalizes the methodology it already applied inline so a second skill can share it.

## [1.3.0] - 2026-06-14

### Added
- **Backup-and-review safety protocol for corpus replacement.** When init-doc replaces or deletes an existing corpus (it is the only constellation skill that *deletes* legacy docs), it no longer does so irreversibly in one pass. A new shared reference, `references/doc-review.md`, defines the protocol — also used by `refactor-doc` — and it is now wired into Phases 3, 4, and a new Phase 6: (1) a **decision gate** (Phase 3) where, if existing docs are already conformant and accurate, a clean exit is valid rather than replacing sound docs; (2) a **backup** of `README.md` + `docs/` to `.project-memory-backup/` taken in Phase 4 step 0 *before* any legacy file is overwritten or removed; (3) a **scrutinize-derived review loop** (Phase 6) proving the new tree against the backup. **Greenfield bootstraps (no existing docs) skip backup and review entirely** — the protocol guards mutation of existing content, not fresh creation.
- **Phase 6: Review & Cleanup.** A read-only cold-reader sub-agent plus the author's simple+harvest passes verify that no **irreplaceable hand-authored knowledge** was lost in the rewrite; findings reconciled, proven against the backup before fixing, folded into the new docs (often a gotchas domain file), and confirmed by re-running the Phase 5 structural battery. Loop repeats until lenses are exhausted (cap 3), then cleans up the backup on clean convergence or retains it with unresolved findings surfaced.
- **Review criterion: "no irreplaceable knowledge lost," not set-equality.** init-doc is meant to reword and reorganize from source, so anything the code reveals is fine to rewrite; the review targets only what the code cannot tell you — gotchas, war stories, decision rationales, non-obvious caveats — which legacy docs often hold and a from-source rewrite can silently drop.
- `Agent` and `AskUserQuestion` added to `allowed-tools` (cold-reader sub-agent; surfacing risky fixes).

### Changed
- Backup directory `.project-memory-backup/` registered as a transient excluded path in `references/standards.md § Protected Files`.

## [1.2.0] - 2026-06-14

### Added
- **OKF-inspired frontmatter — schema definition + emission.** `references/standards.md` gains a canonical **Frontmatter** section: an optional-but-validated YAML block (`description`, `tags`, and a `source` list of globs mapping a doc to the code it documents) that the whole constellation references. This is the single source of truth shared by `update-doc`, `refactor-doc`, `init-context`, and `project-memory`.
- **`source` semantics subsection** in `references/standards.md` pinning the determinism contract: *resolve* (glob hits a file on disk, via the Glob tool) vs *match* (a path string satisfies a glob pattern — works on deleted paths); the git-root base-path alignment; a granularity rule (narrowest globs, never catch-alls like `src/**`); and the glob syntax.
- **Emission at write time.** Phase 3 (Plan) now lists each `docs/<topic>.md`'s proposed `source` globs for user approval. Phase 4 (Writing) emits the frontmatter block on topic docs *and* gotchas domain files, applying the granularity rule. Phase 5 (Validation) verifies every declared `source` glob resolves (no dead globs at creation).

### Changed
- Standards enumeration in SKILL.md now includes `frontmatter`.

## [1.1.1] - 2026-05-25

### Changed
- DRY fix: removed duplicated size-guardrail numbers from SKILL.md. The Standards section and Phase 5 size check now reference `references/standards.md` exclusively instead of repeating the cap values inline. Eliminates drift risk when the canonical numbers change.
- skill.json description: "Project Memory" → "ProjectMemory" for namespace consistency with the rest of the constellation.

## [1.1.0] - 2026-05-19

### Changed
- Removed `disable-model-invocation: true` from SKILL.md frontmatter. The skill is now auto-invocable by Claude — the description and triggers are visible in context, and prompts like *"set up project memory"* or *"bootstrap docs for this project"* will fire the skill automatically.
- Safety story: Phase 3 (Documentation Plan) remains a hard stop for user approval before any file operations. Auto-invocation does not bypass the approval gate — Claude can load init-doc and run reconnaissance, but cannot write files until the user approves the plan.

### Positioning
- Auto-invocation alignment with the rest of the Project Memory constellation. The core skill `nicolasdao/project-memory` routes intent to init-doc via natural-language triggers; this change makes that routing actually work without the user needing to manually type `/init-doc`.

## [1.0.0] - 2026-05-19

### Removed (BREAKING)
- Refactor Mode — previously invoked via `/init-doc refactor`. Functionality has moved to the new `nicolasdao/refactor-doc` skill for clearer verb orthogonality and improved auto-invocation. Users who previously ran `/init-doc refactor` should now run `/refactor-doc`.
- Mode Detection section — init-doc now has a single mode (Normal: bootstrap from source code analysis).

### Changed (BREAKING)
- `$ARGUMENTS` no longer recognizes the `refactor` keyword as a mode selector. Any argument is now treated as optional focus/context for the bootstrap.
- `argument-hint` simplified — no longer mentions the removed refactor mode.

### Changed
- SKILL.md frontmatter description refactored to the five-slot grammar (`<Domain> — <Verb(s)> <Object>. Use when <Triggers>. Not for <Negative>`) with `ProjectMemory —` Domain anchor, explicit `Use when` triggers, and `Not for` negative redirecting to sibling skills (`update-doc`, `refactor-doc`). Length reduced from 413 chars (over the 250-char soft cap) to ~245 chars.
- skill.json description aligned with the Project Memory constellation positioning.

### Positioning
- This skill is now formally positioned as the **bootstrap** satellite of the forthcoming `nicolasdao/project-memory` constellation.

## [0.5.0] - 2026-05-19

### Added
- New `references/standards.md` — canonical source of truth for documentation standards (file structure, size guardrails, TOC rules, cross-linking, gotchas structure, writing standards, protected files, project root determination) shared with `update-doc` and `init-mission`. Eliminates rule duplication that risked drift between skills.
- Step 0: Project Root determination procedure (`git rev-parse --show-toplevel` with CWD fallback), aligning init-doc with the rest of the family.
- Monolithic gotchas size limit explicitly documented (≤ 750 lines, refactor to hub+domain when exceeded) — closes a previously under-specified gap.

### Changed
- Standards section replaces the inlined Output Standard, Size Guardrails, Table of Contents, and Cross-Linking subsections — these now live canonically in `references/standards.md`.
- Constraints trimmed to workflow-specific rules; shared standards rules are referenced via the canonical file rather than duplicated.

## [0.4.0] - 2026-04-08

### Added
- Gotchas hub + domain architecture: `docs/gotchas.md` is now a thin navigational hub linking to `docs/gotchas/<domain>.md` domain-specific files
- Gotchas hub size guardrail (50 lines) in Size Guardrails table
- Phase 2 step 9: classify gotchas by domain based on project subsystems
- Phase 3 step 3: propose gotchas structure with domain file mapping
- Phase 4 steps 2-3: create `docs/gotchas/` directory, write domain files, then write hub
- Phase 5 step 3: verify gotchas integrity (hub in sync with domain files)
- Backward compatibility: detects existing `docs/gotchas/` structure or monolithic format
- Refactor mode (`/init-doc refactor`): restructure existing documentation without source code analysis — splits monolithic gotchas, enforces size guardrails, fixes TOCs and cross-links
- Mode detection section to route between normal and refactor modes

## [0.3.0] - 2026-04-05

### Added
- README Documentation section must describe docs/mission.md with two decision-making levels: proactive (interpret requests through mission lens before implementation) and reactive (choose between multiple valid solutions using the mission instead of asking the user)

## [0.2.1] - 2026-04-02

### Added
- Optional init-mission integration: after reconnaissance, offers to create a mission document (docs/mission.md) for business context
- Added docs/mission.md to the Topic Catalog
- Declared dependency on nicolasdao/init-mission

### Changed
- Phase 1 reconnaissance now uses shared reconnaissance.md from init-mission (single source of truth)

## [0.2.0] - 2026-04-02

### Added
- Size guardrails for documentation files (README.md at 750 lines, docs/ files at 750 lines) with rationale anchored in LLM progressive loading and single-concern coherence
- TOC format specification requiring linked markdown list with anchor links for LLM and human navigation
- Phase 3 size estimation step to proactively split oversized files during planning, before writing
- Phase 5 file size validation step to catch guardrail violations after writing
- Monorepo README guidance in Phase 4 with per-sub-project orientation in Project Structure section
- Concrete examples constraint (use actual codebase examples, not generic placeholders or hypothetical snippets)

## [0.1.1] - 2026-03-12

### Fixed
- Trimmed skill.json description to under 200 chars
- Added `devops` canonical keyword for registry discoverability

## [0.1.0] - 2026-03-12

### Added
- Initial release of init-doc skill
- 5-phase process: Reconnaissance, Deep Analysis, Documentation Plan, Writing, Validation
- Language/stack-agnostic project analysis with universal package manifest detection
- Topic catalog for docs/ files (architecture, database, api, cli, deployment, configuration, testing, infrastructure, gotchas)
- Mandatory user approval gate before writing any files (Phase 3)
- Cross-linking strategy compatible with init-context traversal and update-doc maintenance
- Protected files list (CLAUDE.md, MEMORY.md, specs/, docs/manual/, .claude/)
