# Changelog

## [0.8.1] - 2026-08-07

### Fixed
- **The mid-session loading trigger is described correctly (requires `nicolasdao/init-context` ≥ 1.10.0).** Two places still described `init-context`'s ongoing rule as firing when *"the conversation shifts to a topic area"* — the topic-shift judgment 1.10.0 removed for firing unreliably. Both now state the real trigger: the lookup runs immediately before the first `Edit`/`Write` to any file, keyed on the path. The core skill was documenting a mechanism its own satellite had deleted.
- **Routing table's `Output` row for init-context corrected (requires `nicolasdao/init-context` ≥ 1.10.0).** It read *"A summary of loaded context"*, contrasted against Query's *"An answer with citations"*. As of init-context 1.10.0 Recall ends with a grounded answer rather than a load summary, so the stated contrast was false and would misroute a user to Query for questions Recall now answers directly. The row now describes what Recall actually emits. The two operations remain orthogonal on the axes that still separate them — scope, loading style, and mandatory files.

## [0.8.0] - 2026-07-30

### Added
- **Routing for `init-doc`'s session-native bootstrap (requires `nicolasdao/init-doc` ≥ 1.10.0).** A new Routing Table row sends *"document what we just built"*, *"write the docs before we close this session"*, and *"capture what we did while building this"* to `/init-doc` when the same session created the project. The satellite roster entry for `init-doc` now names the mode. Without this the core advertised init-doc as source-analysis-only, so a birth-session intent had no route — the capability existed and the router that exists to reach it did not know.

### Changed
- **`nicolasdao/init-doc` dependency tightened from `*` to `>=1.10.0`.** The router now routes to a mode that does not exist before 1.10.0, so `*` would let this version install alongside 1.9.0 and promise a capability the satellite cannot deliver. This makes the constellation's existing publish order (satellites before the core) load-bearing rather than conventional — release `init-doc` first.

### Fixed
- **Set-Up Procedure misrouted a birth session to `/init-mission`.** Step 3's state checks are evaluated in order, and a project scaffolded in-session routinely has a `README.md` (emitted by `npm create`, `cargo new`, or a template) but no `docs/`. That matched the "`README.md` exists but no `docs/mission.md`" branch and recommended the compass-only flow, skipping the bootstrap entirely and losing the build reasoning the session was holding. A new first branch — "this session created the project" — takes precedence over the state checks. State alone cannot distinguish a birth session from a clone, which is why the branch is ordered ahead of it rather than folded into it.

### Changed
- Anti-pattern wording updated for the new README-only TOC policy: the "Bypassing the satellites" row now reads "README doc-index + TOC regeneration" (TOC regeneration is README-only and generator-owned). No behavior change.

## [0.7.0] - 2026-06-15

### Fixed
- **Inspect interprets the `--check` exit code as a three-way signal, not pass/fail.** Previously any non-zero exit was reported as "manifest stale → run a producer." Inspect now distinguishes **exit 1** (stale — regenerate via `/update-doc`) from **exit 2** (structural — no `README.md`, or no `## Documentation` section to host the managed block), which regeneration cannot fix; exit 2 now recommends `/refactor-doc` (adds the section) or `/init-doc`, then re-run `--check`. This prevents a misleading "stale" diagnosis on exactly the legacy corpus Inspect targets. Aligned with `nicolasdao/init-doc` ≥ 1.7.0 `references/standards.md § --check mode`.
- **`skill.json` declares `systemDependencies`** (`git`, `python3`) — Inspect, Query, and Set-Up invoke both (project-root detection + the generator's `--check`/`--drift`) but they were previously undeclared.

## [0.6.0] - 2026-06-15

### Added
- **North Star — the constellation's canonical mission + strategy, embedded in the skill.** A new top-level `## North Star` section (placed as the root the other sections elaborate) states the ultimate mission — give a codebase a *great*, agent-first memory of itself so understanding *compounds into foresight* — and the ten strategic tenets (1–7 build trust/the floor, 8 bridges to foresight, 9–10 keep it great and used). The skill now answers *"what is the North Star / the mission?"* directly from this section (added to the routing table's education intent), and the Six Failure Modes section cross-references it as the *symptom-level* view of this deeper *principle-level* lens. This also satisfies the North Star's own tenet 1 — the mission now lives in the project (the repo), not only in agent-side memory.

## [0.5.0] - 2026-06-15

### Added
- **Inspect detects structural drift — "has the graph gone archaic?"** A new Inspect step runs the generator's write-free `--drift` mode and interprets its mechanical signals (`dangling_docs`; in a monorepo `groups_without_docs` and `cross_group_docs`), plus a judgment pass for single-project uncovered-source areas the script can't determine. When drift **accumulates** — several undocumented sub-projects, many dangling docs, sprawled docs, or whole source areas uncovered — Inspect recommends **`/refactor-doc` in re-architect mode** to re-derive the structure from current source. This is explicitly distinguished from step 5's *freshness* check ("manifest stale → regenerate") vs. this *structural* check ("graph aged → re-architect"). Advisory throughout; reports "unassessed" when Python is unavailable. The routing table's Inspect intent and the report example are updated.

## [0.4.0] - 2026-06-14

### Added
- **Set-Up flags a missing manifest.** The Set-Up state check now looks for `doc-manifest.json`; when the structure exists but the manifest is absent (a legacy corpus predating it, or docs missing frontmatter), Set-Up recommends `/refactor-doc` to generate it instead of declaring the system fully set up.
- **Inspect verifies manifest freshness via `--check`.** Inspect gains a step that runs the manifest generator (`../init-doc/scripts/build-doc-manifest.py --root <root> --check`, write-free): exit 0 means the committed `doc-manifest.json` + README managed block are in sync with a fresh scan; non-zero means a producer changed docs without regenerating, reported as drift with a `/update-doc` recommendation. This is the committed-manifest + diff-check freshness mechanism (no background hook). When Python/the script is unavailable, Inspect reports "manifest freshness unverified (generator unavailable)" rather than asserting fresh. Report example updated.

### Changed
- **Query reasons over `doc-manifest.json` as its lookup index.** Query Steps 2–4 now load the manifest and score candidate docs over its records (`source` → `description`/`tags`, with `group` narrowing in monorepos) in one pass, instead of "read README then peek each candidate's frontmatter header." Falls back to the README-link index when no manifest exists. Still cites file paths in answers and still escalates to `/init-context` for broad recall.

## [0.3.0] - 2026-06-14

### Added
- **Inspect detects an orphaned `.project-memory-backup/`.** Inspect gains a step that looks for the pre-mutation backup taken by `init-doc` / `refactor-doc`. Because that backup is deleted on clean convergence (see `nicolasdao/init-doc` `references/doc-review.md § Part D`), its presence signals that the last documentation rewrite is either in progress or **aborted / never verified clean** — a meaningful state signal squarely within Inspect's read-only remit. Inspect flags it with the path and recommends re-running the originating skill (which prompts on a stale backup) or removing it once the docs are confirmed correct. The Inspect report example now includes this case.

### Notes
- No new dependency: `doc-review.md` lives under the already-depended-on `nicolasdao/init-doc` (same host as the shared `standards.md`). The core still writes no docs; this is a read-only state check only.

## [0.2.0] - 2026-06-14

### Added
- **Query leverages `source` for entity lookups.** Query Step 4 now matches a question that names a file, directory, or code area against candidate docs' `source` globs — the doc whose `source` covers it is the owner, the most precise possible hit for "which file/doc owns X" intents. Bare code symbols (a function/class name with no path) cannot be glob-matched and correctly fall through to `description`/`tags` scoring, then README link text. (Schema: `nicolasdao/init-doc` `references/standards.md § Frontmatter`.)
- **Inspect freshness gains per-doc precision via `source`.** For docs that declare `source`, Inspect compares the doc's last commit against the last commit of the files its globs resolve to, flagging that *specific* doc as a stale candidate — framed honestly as a heuristic (a cosmetic doc edit can refresh the timestamp), with the prior whole-`docs/` comparison retained as the coarse path for docs without `source`.

### Changed
- The Frontmatter section in `nicolasdao/init-doc` `references/standards.md` (the constellation's canonical schema) now documents `project-memory` as a consumer of `source` (Inspect) and `description`/`tags` (Query).

## [0.1.1] - 2026-05-25

### Changed
- Sharpened the SKILL.md description's Negative slot. The previous "Not for direct satellite work" was vague; the new form names every sibling explicitly: "Not for writing docs (init-doc, update-doc, refactor-doc) or session recall (init-context)." Improves auto-invocation routing reliability against all five constellation members.
- Routing-table row for Core's Query procedure narrowed to named-entity lookups ("where is function X defined?", "which file owns Z?", "find the doc that covers W"). Removes the "how does our auth work?" example that overlapped with `init-context`'s "asking how something works" trigger. Adds an inline pointer to `/init-context` for broad how-it-works recall, making the routing boundary deterministic.

## [0.1.0] - 2026-05-19

### Added
- Initial release of `nicolasdao/project-memory` — the core skill of the Project Memory constellation.
- Five-slot SKILL.md frontmatter description with `ProjectMemory —` Domain anchor, explicit `Use when` triggers, and `Not for` redirection to satellites.
- SEO-tuned skill.json description targeting buzz keywords: Claude Code, Cursor, Codex, LLM amnesia, context rot, hallucination, Karpathy LLM Wiki.
- 15-keyword index optimized for HappySkills semantic search: `ai`, `documentation`, `project-memory`, `agent-memory`, `llm-memory`, `claude-code`, `cursor`, `llm-wiki`, `agents-md`, `context-engineering`, `hallucination`, `amnesia`, `context-rot`, `progressive-disclosure`, `persistent-context`.
- Declared dependencies on all five satellite skills (`init-doc`, `update-doc`, `refactor-doc`, `init-context`, `init-mission`) — installing this core skill installs the whole constellation.

### Sections (SKILL.md body)
- **Identity & Positioning** — what Project Memory is, what it is not, and the "flank Karpathy" comparison table.
- **The Six Failure Modes** — explicit mapping of LLM amnesia, context rot, hallucination, stale documentation, lost institutional knowledge, and inconsistent decisions to the satellite or structural invariant that defeats each.
- **The Constellation** — every satellite skill named explicitly with its verb and purpose.
- **The Workflow Contract** — the non-negotiable recall-start / maintain-end lifecycle.
- **Routing Table** — concrete user-intent phrases mapped to satellite invocations.
- **Set-Up Procedure** — state-dependent recommendation flow for new projects.
- **Query Procedure** — 7-step lazy progressive disclosure for in-doc info lookups, with anti-hallucination rules (cite sources, honest absence, lazy loading, no write operations).
- **Inspect Procedure** — read-only state check for project memory completeness and freshness.
- **Anti-Patterns** — seven concrete behaviors that break the system.
- **Constraints** — never write directly, never hallucinate, always cite, defer to satellites.
- **Glossary** — definitions of LLM amnesia, context rot, context engineering, progressive disclosure, hub+domain, workflow contract, etc. — surfaced for both reader clarity and embedding-search discoverability.

### Positioning
- Project-scoped alternative to Karpathy's LLM Wiki — designed for one codebase deeply known, not personal-KB cross-topic research.
- Brand promise: "Install once. Run recall at session start, maintain at session end. Your AI agent will never make up a function name or forget what you decided yesterday."
