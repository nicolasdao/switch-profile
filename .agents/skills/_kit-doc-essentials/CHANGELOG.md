# Changelog

## [1.1.1] - 2026-07-30

### Fixed
- **README described `init-doc` as source-analysis-only**, which stopped being true at `nicolasdao/init-doc` 1.10.0. Both the "What's Included" entry and step 1 of the lifecycle now name the **session-native** path — documenting from the session that built the project, so the decisions and dead ends behind the build survive the session closing. Documentation only. Kit composition is unchanged, so this is a patch, not a minor.

## [1.1.0] - 2026-06-02

### Added
- **`nicolasdao/init-spec` added to the kit composition.** Installing the kit now also installs the SpecKit skill, which generates a one-shot-ready `SPEC.md` from session context under `specs/YYMMDD-NN-slug/` and archives finished specs to `specs/-DONE` / `specs/-ARCHIVED`. This complements the Project Memory constellation by capturing forward-looking work specs alongside the living documentation. No change to the existing `project-memory` or `git-commit` dependencies.

## [1.0.1] - 2026-05-25

### Changed
- **Migrated kit from frontmatter-less `SKILL.md` to `README.md`** (per `happyskills` CLI v0.52.0). The previous format relied on Claude Code silently dropping a `SKILL.md` with no frontmatter; Codex and Gemini correctly treat the same file as malformed and warn on every load. With `README.md`, the kit's invisibility to every agent runtime is a structural property (no `SKILL.md` present) instead of a runtime trick. No change to `dependencies` or kit composition.

## [1.0.0] - 2026-05-20

### Changed (BREAKING)
- **Composition refactored around the Project Memory constellation.** The kit now bundles two top-level skills (`nicolasdao/project-memory` and `nicolasdao/git-commit`) instead of four. The explicit dependency contract has changed — anyone pinning the kit to a specific composition (rather than relying on transitive resolution) will see a different `dependencies` array in `skill.json`.
- Description rewritten to lead with "perpetual project memory" and reference the Project Memory constellation directly.
- SKILL.md narrative rewritten: introduces the constellation, names all six member skills (`project-memory`, `init-doc`, `update-doc`, `refactor-doc`, `init-context`, `init-mission`), spells out the auto-invocation workflow, and contrasts with Karpathy's LLM Wiki.

### Removed (BREAKING)
- Explicit dependencies on `nicolasdao/update-doc`, `nicolasdao/init-doc`, and `nicolasdao/init-context` from the kit's `skill.json`. These three skills are still installed when the kit is installed, but now transitively through `nicolasdao/project-memory`'s own dependency declarations. The dependency graph is cleaner, but the kit's explicit-deps contract has narrowed from four entries to two.

### Added
- Three skills now transitively included via `project-memory` that were not part of the previous kit composition: `nicolasdao/project-memory` (the constellation core), `nicolasdao/refactor-doc` (restructures existing docs without source analysis), and `nicolasdao/init-mission` (interviews to produce `docs/mission.md`).
- Keywords for SEO and discoverability: `project-memory`, `agent-memory`, `llm-memory`, `perpetual-memory`, `context-engineering`, `amnesia`, `hallucination`, `claude-code`, `cursor`, `llm-wiki`.

### Migration
- Users updating from 0.4.x will see **three additional skills** installed: `project-memory`, `refactor-doc`, and `init-mission`. The original four (`init-doc`, `update-doc`, `init-context`, `git-commit`) remain installed unchanged.
- Anyone introspecting `skill.json` for the kit's explicit `dependencies` field will see only two entries instead of four. Use the resolved install tree (e.g., `npx happyskills list --json`) to enumerate the full set of installed skills.

## [0.4.0] - 2026-05-02

### Changed
- Reframed the kit description around the concept of **infinite, source-controlled memory** — well-organized local docs as a project's persistent memory, versioned and reviewable through git.
- Added `memory`, `infinite-memory`, and `source-controlled-memory` keywords for discoverability.
- Added a "Why this kit" section to SKILL.md explaining the memory-versus-context-window framing.

## [0.3.0] - 2026-05-01

### Changed
- Repositioned the kit as documentation-focused. Rewrote the `skill.json` description and SKILL.md narrative to lead with the documentation lifecycle (generate, maintain, consume, commit) rather than generic developer tooling.
- Reordered and expanded keywords so registry searches for "documentation", "docs", "readme", and related terms surface this kit first.

## [0.2.0] - 2026-05-01

### Added
- Declared the four bundled skill dependencies (`init-doc`, `update-doc`, `init-context`, `git-commit`) after a workaround for a server-side first-publish issue.

## [0.1.0] - 2026-05-01

### Added
- Initial kit bundling `init-doc`, `update-doc`, `init-context`, and `git-commit`.
