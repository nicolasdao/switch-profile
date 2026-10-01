# Changelog

## [0.3.0] - 2026-07-19

### Added

- **Configuration mode** — a third mode alongside authoring and lifecycle. Auto-invokes on phrases like "add custom rules for init-spec" and "set the spec rules for this project", and configures an optional per-project spec-rules file. Offers two paths via AskUserQuestion — point at an existing rules file, or define rules ad hoc (the skill writes the file, default `specs/.spec-rules.md`). The pointer is stored the HappySkills way: in the project-root `skills-config.json` under key `nicolasdao/init-spec`, field `rulesFile` (declared in `skill.json` `config` with `prompt: false`, so install never prompts and default behavior is unchanged), written via `npx happyskills skills-config set` — never inside the skill folder, which `update` would wipe.
- **Authoring Step 5a** — authoring mode now resolves `rulesFile` (CLI-preferred `skills-config get`, file-fallback) before writing a SPEC.md. When set and the file exists, the rules both shape how the spec is authored and are embedded into it (a §0 source note plus §3/§5/§7/§8) so the fresh implementer session honors them too. Absent config → behavior unchanged; configured-but-missing file, or a `skills-config.json` that exists but won't parse → stop and ask (absent ≠ corrupt).
- Self-audit rubric extended to 13 checks (row 13 verifies configured project rules were applied).

### Changed

- Description advertises the third mode while staying under the soft cap; added `config` and `project-rules` keywords.
- Constraints reorganized into "apply to all modes / authoring / lifecycle / configuration". The "no publishing" rule is clarified to permit `skills-config get/set` (consumer config I/O) while still forbidding publish, release, version bumps, and CHANGELOG edits.

## [0.2.0] - 2026-05-28

### Added

- **Lifecycle mode** — the skill now auto-invokes on phrases like "archive spec X", "mark spec X as done", and "move spec X to done", and moves the named folder into `specs/-DONE` or `specs/-ARCHIVED` (creating the destination if absent). The move uses `git mv` when the folder is tracked, plain `mv` otherwise. The skill does not edit spec contents, does not commit, and does not run the 8-step authoring workflow when in lifecycle mode.
- Disambiguation discipline — AskUserQuestion fires only when the target spec or destination is genuinely ambiguous. Unambiguous requests execute silently.

### Changed

- Description updated to advertise both modes (authoring + lifecycle) while staying under the 250-char soft cap.
- Top-level Purpose section reorganized to distinguish the two modes up front.
- Constraints section split into "applies to both modes" / "authoring mode" / "lifecycle mode" subsections.

## [0.1.1] - 2026-05-28

### Fixed

- Folder naming convention switched from `DDMMYY-NN-slug` to `YYMMDD-NN-slug` so that `ls specs/` lists specs in chronological order. The previous `date +%d%m%y` placed the day first, breaking sort order across days/months. Updated the bash snippet in Step 3 to `date +%y%m%d` and refreshed the example slugs.

## [0.1.0] - 2026-05-27

### Added

- Initial release of `init-spec`.
- Generates a one-shot-ready `SPEC.md` under `specs/DDMMYY-NN-<slug>/` from the current session's context, taking a single `$goal` argument.
- Auto-invocation triggers on phrases like "create a spec", "write a specification", "generate a spec", with explicit guards against speculative or future-tense mentions.
- 8-step workflow: confirm goal + session inventory, brief clarifying-questions pass (AskUserQuestion, max 4), slug resolution following the `DDMMYY-NN-slug` convention, single-file-vs-`BACKGROUND.md` decision, spec authoring against the canonical template, 12-point self-audit rubric, report-back with a ready-to-paste fresh-session prompt, and a no-drift constraint set.
- Canonical SPEC.md template (`references/spec-template.md`) with required sections: fresh-session preamble, goal, context, verifiable acceptance criteria, fixes (with symbol anchors, mandatory pre-edit verification steps, and stop conditions), non-goals, known uncertainties, anti-hallucination guardrails, verification commands, domain glossary, references.
- Anti-bloat discipline: 700-line cap, sibling `BACKGROUND.md` only when supporting context can be deferred to "if curious" reading.
- Bakes in two Anthropic best practices: fresh-session execution (the report-back format) and writer/reviewer split (separate fresh session for code review).
