# Changelog

## [0.6.0] - 2026-06-18

### Changed
- **`docs/mission.md` no longer carries a Table of Contents** — per the constellation's new README-only TOC policy (a mission doc is ≤ 150 lines and agent-facing; its structure is indexed by the manifest's `headings`). Phase 3 writes it without a TOC; Phase 4 drops the TOC-matches-headings check. (Aligned with `nicolasdao/init-doc` ≥ 1.9.0.)

## [0.5.0] - 2026-06-15

### Changed
- **The Quality Standard's "Concise" rule now applies the constellation's canonical concision discipline.** The bullet references [`../init-doc/references/standards.md § Writing Standards`](../init-doc/references/standards.md#writing-standards) — the new concision bright lines (cut filler and hedging) *and* their limits (keep prose grammatical; never trade clarity for terseness). init-mission keeps its own Quality Standard (mission.md is human-facing and capped at 150 lines) but no longer states concision rules that can drift from the shared source. No duplication — the bright lines live once, in standards.md.

## [0.4.3] - 2026-06-15

### Fixed
- **`skill.json` declares `systemDependencies`** (`git`) — reconnaissance runs `git rev-parse` for project-root detection, but it was previously undeclared. init-mission runs no generator, so it needs no `python3` dependency.
- **`skill.json` now declares `authors` and `license` (`BSD-3-Clause`)** — aligning every constellation member on one license and author identity (the constellation previously mixed BSD-3-Clause, MIT, and none).

## [0.4.2] - 2026-05-25

### Reverted
- Removed the `nicolasdao/init-doc` dependency declared in 0.4.1. The dep created a circular constellation graph (`init-doc → init-mission → init-doc`), which the validator only surfaces when a parent like `project-memory` tries to bundle both. The reverse edge (init-doc → init-mission) is load-bearing because init-doc actually invokes `/init-mission`; this edge is the soft one (init-mission only references `standards.md` as documentation), so it loses. The cross-skill `../init-doc/references/standards.md` reference remains in SKILL.md but is no longer install-time-guaranteed.

## [0.4.1] - 2026-05-25

### Added
- Declared `nicolasdao/init-doc` as a dependency. Formalizes the long-standing reliance on `../init-doc/references/standards.md` for project-root and protected-files rules — previously the dep declaration was empty even though SKILL.md referenced init-doc's files.

### Changed
- skill.json description rewritten with `ProjectMemory` namespace consistency; emphasizes the in-session loading role of `docs/mission.md` over abstract "AI agent" framing.
- Softened the constraint reminder that duplicates the 150-line Quality Standard — the Constraints section now references the Quality Standard above instead of restating the cap.

## [0.4.0] - 2026-05-19

### Changed
- SKILL.md frontmatter description refactored to the five-slot grammar with `ProjectMemory —` Domain anchor, explicit `Use when` triggers (bootstrapping a mission, adding one to an existing project), and `Not for` negative redirecting to `init-doc`. Auto-invocation reliability improved — previously the description had no `Use when` or `Not for` clauses.
- skill.json description aligned with the Project Memory constellation positioning. Added `ai` canonical keyword for registry discoverability.

### Positioning
- This skill is now formally positioned as a transitive dependency of `init-doc` within the forthcoming `nicolasdao/project-memory` constellation.

## [0.3.0] - 2026-05-19

### Added
- Phase 0: Project Root determination, aligning init-mission with the rest of the doc-skill family (uses the canonical procedure in `../init-doc/references/standards.md`).
- Orphan-file warning in Phase 5: when `docs/mission.md` is created but no project README exists at the root, the skill now surfaces a prominent warning that the mission file is orphaned (invisible to init-context traversal) and directs the user to `/init-doc` to complete the integration.

### Changed
- Phase 5 (README Integration) is now conditional on the invocation context. When invoked from `init-doc` (signaled by reconnaissance results passed via `$ARGUMENTS`), Phase 5 is skipped — init-doc writes the README itself in its own Phase 4, including the mission entry with the proactive/reactive decision-making description. This eliminates the double-write where init-mission would update a README about to be overwritten by init-doc, wasting work and risking conflicts with init-doc's plan.
- Constraints reference the shared `../init-doc/references/standards.md` for protected files and TOC rules instead of duplicating them inline.

## [0.2.0] - 2026-04-05

### Added
- Phase 5: README Integration — after creating docs/mission.md, the skill now links it from the project's README with prescriptive guidance on two decision-making levels (proactive before implementation, reactive when facing multiple solutions)

## [0.1.0] - 2026-04-02

### Added
- Initial release of init-mission skill
- Adaptive interview process for creating docs/mission.md
- 5-section mission document: Vision, Values, Non-goals, Users, UX Compass
- Project reconnaissance process (reconnaissance.md) shared with init-doc
- Pre-computed reconnaissance input support to avoid duplicate work when called from init-doc
- Draft-first interview pattern: presents inferred content for refinement rather than blank prompts
