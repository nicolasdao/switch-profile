# Changelog

## [1.17.0] - 2026-03-15

### Added
- Add "Trigger Phrase Resilience" subsection to skill-authoring.md Section 5 (Writing Effective Descriptions) — guides authors to cover multiple phrasing families (past tense, questions, declarations, noun-phrase shorthand, progressive tense) in skill descriptions, with a table of phrasing families, concrete examples for auto-discovery lists and frontmatter descriptions, and a mental-test checklist
- Update SKILL.md authoring workflow step 4 to reference the new Trigger Phrase Resilience guide — reminds authors that users don't always phrase requests as imperative commands

## [1.16.1] - 2026-03-15

### Fixed
- Add working directory constraint to Section 6 — install, uninstall, update, list, check, refresh, and convert commands must run from the project root directory to avoid installing skills in the wrong location

## [1.16.0] - 2026-03-15

### Added
- Expand Section 1 (File Structure) with Agent Skills spec standard directories (`scripts/`, `references/`, `assets/`), purpose table, `templates/` vs `assets/` guidance, and 5-step decision framework for choosing standard vs custom directories — with source citations to agentskills.io spec and Anthropic skills repo
- Expand Section 7 (Supporting Files) into "Supporting Files & Progressive Disclosure" — adds 3-level progressive disclosure model, conditional file reference pattern, file reference depth rule, content type table with reasoning, and good vs bad examples of organizing complex skills with many supporting files — with source citations
- Add 3 new anti-patterns to Section 10 — files dumped at root, custom directories for standard-folder content, deeply nested reference chains
- Add 2 new best practices to Section 9 — organize supporting files by content type, use conditional file references
- Add Section 17 (Sources) — consolidated table of authoritative source URLs (agentskills.io spec, best practices, Claude Code docs, Anthropic skills repo)

## [1.15.0] - 2026-03-12

### Added
- Add `visibility` command routing, Section 3.8 (Visibility) with get/set usage examples, and result formatting guidelines
- Add visibility JSON response shapes to references/json-shapes.md (get, set, not found, forbidden)
- Add `visibility` to auth-required commands list in Section 2

## [1.14.1] - 2026-03-12

### Fixed
- Fix incorrect kit name example in happyskills-conventions.md — changed `"react-fullstack-kit"` to `"_kit-react-fullstack"` to match the enforced `_kit-` prefix convention

## [1.14.0] - 2026-03-12

### Added
- Add search concierge step to Kit Creation Workflow — optionally search the HappySkills cloud registry for additional skills to include in a kit alongside locally installed skills
- Add `_kit-` prefix convention to Kit Creation Workflow — kit name suggestions now start with `_kit-`, and the workflow notes the CLI auto-prepends the prefix

### Changed
- Renumber Kit Creation Workflow steps 2–9 to 3–10 to accommodate the new search concierge step
- Update Kit Creation Workflow description in SKILL.md to mention cloud registry search support
- Update version strategy step to handle cloud-selected skills (use version from search results as base for `^major.minor.0` ranges)

## [1.13.0] - 2026-03-12

### Added
- Add version strategy step to Kit Creation Workflow (step 5) — asks user to choose between pinned (`^major.minor.0`) and always-latest (`*`) dependency ranges with friendly explanations of both options

### Changed
- Renumber Kit Creation Workflow steps 5–8 to 6–9 to accommodate the new version strategy step

## [1.12.0] - 2026-03-12

### Added
- Add guided Kit Creation Workflow — LLM-assisted kit creation that lists installed skills, lets users select which to bundle, infers kit name and description, and iterates until approved before scaffolding
- Add Kit Creation Workflow subsection in Section 7 with cross-reference to skill-workflows.md
- Add full 8-step Kit Creation Workflow procedure in skill-workflows.md (list → select → inspect → infer → review → create → write SKILL.md → streamlined enrichment)

### Changed
- Route "init kit", "create a kit", "scaffold a kit" to Kit Creation Workflow (Section 7) instead of bare `init --kit`
- Condense kit scaffold docs in Section 3.3 to a single line with workflow cross-reference

## [1.11.0] - 2026-03-11

### Added
- Add kit routing intents: "init kit", "search kits", "install kit", "list kits", "publish kit"
- Add `init --kit` subsection under Authoring Commands (Section 3.3) documenting kit scaffolding
- Add `--type kit` search filter documentation under Discovery Commands (Section 3.1)
- Add `[kit]` badge to search and list formatting guidelines (Section 4)
- Add `type` field to init response shape and search/list JSON output in json-shapes.md
- Add kit specification to happyskills-conventions.md — `type` field, no-frontmatter SKILL.md, dependency-driven value

## [1.10.0] - 2026-03-11

### Added
- Add `delete` command routing and Section 3.6 (Registry Deletion) with usage, confirmation requirements, and JSON mode flags
- Add delete JSON response shapes to references/json-shapes.md (success, not found, forbidden, confirmation required)

### Changed
- Extract Section 8 (Happy Skills) content to references/happy-skills.md to free SKILL.md line budget

## [1.9.0] - 2026-03-10

### Added
- Add `validate` command routing, command reference (Section 3.5), and result formatting guidelines
- Add mandatory `validate --json` pre-publish gate in the publish workflow (Section 3.3, step 2)
- Add validate step to authoring workflow (step 9) replacing manual anti-pattern checks
- Add validate as mandatory quality gate in Post-Init Enrichment (step 11), Post-Convert Enrichment (step 10), and Post-Fork Enrichment (step 9)

### Changed
- Replace manual pre-release checklist in Skill Release Workflow (step 4) with deterministic `validate --json` check
- Trim verbose descriptions in Sections 3.1, 3.2, 3.4, and 4 to stay within 500-line SKILL.md limit

## [1.8.1] - 2026-03-10

### Changed
- Require all three platforms (`darwin`, `linux`, `win32`) in systemDependencies install commands across all enrichment workflows — if the install method is unknown or the tool is unsupported on a platform, use a descriptive message instead of omitting the key
- Update systemDependencies examples in happyskills-conventions.md to include `win32` install commands
- Document the three platform keys (`darwin`/`linux`/`win32`) with a reference table and "not supported" fallback pattern

## [1.8.0] - 2026-03-10

### Changed
- Align SKILL.md size limit with official agentskills.io and Claude Code spec — updated from 200 lines to 500 lines across skill-authoring.md (Section 1, Section 9, Section 10, Section 12), SKILL.md (Step 5, Step 9, Core Principles), and size guidelines table
- Clarify executable code rule — all executable code MUST go in `scripts/`, code in markdown is only for documentation, examples, and references to scripts. Previous wording was ambiguous about when embedded code was acceptable
- Refine Post-Init Enrichment embedded code check (step 10) — now extracts executable code to `scripts/` and replaces with `${CLAUDE_SKILL_DIR}/scripts/` references instead of just recommending
- Tighten anti-pattern wording in skill-authoring.md — "Executable code embedded in markdown instead of scripts/" with clear fix guidance

## [1.7.0] - 2026-03-10

### Added
- Add executable code decision point to authoring workflow Step 5 — asks whether the skill needs to execute code and directs authors to use `scripts/` instead of embedding code snippets in markdown
- Add "embedded executable code in markdown" to anti-patterns table in skill-authoring.md with fix guidance
- Add `${CLAUDE_SKILL_DIR}` documentation to skill-authoring.md Section 1 (File Structure) with usage examples for referencing bundled scripts
- Add "Use scripts/ for executable code" principle to Core Principles table in SKILL.md
- Add embedded code check step (step 10) to Post-Init Enrichment workflow — scans SKILL.md and references/ for executable code blocks and recommends extraction to scripts/

### Changed
- Update authoring workflow Step 9 (anti-pattern check) to include "no executable code embedded as snippets in markdown" as a key check
- Enhance scripts/ guidance in skill-authoring.md Section 7 (Supporting Files) to reference `${CLAUDE_SKILL_DIR}/scripts/` and support Python files

## [1.6.1] - 2026-03-10

### Added
- Add LICENSE file generation after license selection in all 3 enrichment workflows — writes the standard license text with copyright holder name (reused from authors step) and current year into a `LICENSE` file in the skill directory

## [1.6.0] - 2026-03-10

### Added
- Add prescriptive two-tier license selection to Post-Init, Post-Convert, and Post-Fork enrichment workflows — tier 1 offers MIT, BSD-3-Clause, Apache-2.0, and "Show me more"; tier 2 displays a full reference table of 12 SPDX licenses across permissive, copyleft, public domain, and proprietary categories, then offers UNLICENSED, GPL-3.0-only, MPL-2.0, and CC0-1.0
- Add git remote auto-detection for the `repository` field — runs `git remote get-url origin` and suggests the detected URL, with fallback to manual entry or skip

### Changed
- Replace vague "Prompt for optional fields" step with explicit sub-steps (a. authors, b. license, c. repository) that must each be asked individually — prevents the LLM from skipping `repository`

## [1.5.0] - 2026-03-10

### Added
- Add mandatory SKILL.md frontmatter validation step (name + description) to Post-Init, Post-Convert, and Post-Fork enrichment workflows — marked as NON-NEGOTIABLE to prevent skills from shipping without the description that drives auto-invocation
- Add "No frontmatter or missing description" as first entry in Common Debugging table in skill-authoring reference

### Changed
- Strengthen authoring workflow steps 4 and 6 with MANDATORY language — frontmatter block with `name` and `description` is now explicitly required, SKILL.md without frontmatter is never acceptable
- Mark `name` and `description` as **Required** in frontmatter field reference table
- Strengthen pre-release validation to check frontmatter name, description, placeholder detection, and forbidden character scanning before allowing bump/publish

## [1.4.0] - 2026-03-08

### Added
- Add `refresh` command routing, trigger phrases, and JSON shape documentation for the new check-and-update-all-in-one-shot CLI command
- Add invocation model confirmation step to Post-Init, Post-Convert, and Post-Fork enrichment workflows — always asks the user via AskUserQuestion before setting `disable-model-invocation: true`

### Changed
- Change `disable-model-invocation: true` to never be set by default — all skill creation, conversion, and fork workflows now require explicit user confirmation with a clear explanation of the consequences before adding this flag

## [1.3.2] - 2026-03-08

### Fixed
- Fix first-publish detection in publish pre-flight — replace unreliable `commit: null` lock file check with `npx happyskills check` registry query, which correctly handles locally developed skills that were already published

## [1.3.1] - 2026-03-08

### Fixed
- Enforce mandatory workspace resolution before every publish command — run `whoami` to get workspaces, check `skills-lock.json` for matching `<slug>/<skill-name>` entry, ask user only when ambiguous. NEVER run publish without `--workspace`
- Fix wrong lock file path references — corrected from `.claude-lock.json` to `skills-lock.json` (project root) across SKILL.md, skill-workflows.md, and happyskills-conventions.md
- Fix stale `happyskillsai/happyskills-cli` references — renamed to `happyskillsai/happyskills` in SKILL.md, json-shapes.md, and docs

## [1.3.0] - 2026-03-08

### Added
- Post-Init Enrichment workflow — authoring workflow (Section 7) now flows directly into HappySkills ecosystem metadata enrichment (description, keywords, dependencies, CHANGELOG) with optional publish, eliminating the need to manually `convert` after `init`

### Fixed
- Fix false dependency warning during publish — replaced broken `resolve_dependencies` call (which checked the unpublished skill itself) with per-dependency `get_repo` existence checks that run in parallel and name specific missing dependencies
- Enforce private-first visibility on first-time publish — AskUserQuestion now prescriptively lists "Private (Recommended)" as the first option in all publish and enrichment workflows

### Changed
- Authoring workflow step 8 now only verifies skill.json `name` and `version` — description, keywords, and dependencies are deferred to Post-Init Enrichment for a cleaner separation between SKILL.md design and ecosystem metadata

## [1.2.1] - 2026-03-07

### Fixed
- Stop re-prompting about visibility (public/private) when publishing a skill update — visibility is now only asked on the first publish and preserved automatically on subsequent publishes

## [1.2.0] - 2026-03-06

### Added
- Add Section 8 (Happy Skills) with status check workflow, conversion workflow, and tone guidelines — natural language support for "are my skills happy?", "make my skills happy", and related intents
- Add publish pre-flight checklist: managed check, CHANGELOG/skill.json read, change review, release workflow integration, and visibility confirmation before running `npx happyskills publish`

### Changed
- Change authentication flow from two-step (`login --json` + `login --browser`) to single command (`login --json --browser`) that handles both already-logged-in and fresh login cases

## [1.1.0] - 2026-03-06

### Changed
- Publish workflows (post-convert enrichment, release workflow, bare publish) now ask whether the skill should be public or private before running — skills are private by default
- Publishing Checklist in `happyskills-conventions.md` documents the `--public` opt-in flag and the private-by-default behavior

### Added
- `--public` flag example in the publish command reference

## [1.0.0] - 2026-03-06

### Added
- Natural language interface to all 16 `npx happyskills` CLI commands: `init`, `install`, `uninstall`, `list`, `search`, `check`, `update`, `bump`, `publish`, `convert`, `fork`, `login`, `logout`, `whoami`, `setup`, `self-update`
- Scoped search support: `--mine`, `--personal`, `--workspace <slug>`, `--tags` filters with browse mode (query optional when scope is provided)
- JSON output parsing for all commands with human-friendly result formatting (tables, summaries, counts)
- Browser-based device login flow with 6-minute timeout; password fallback for headless environments
- Automatic auth pre-flight check before auth-required commands (`publish`, `convert`, `fork`, `whoami`); auto-retry on `AUTH_REQUIRED` error
- Confirmation prompts via `AskUserQuestion` before destructive operations (`uninstall`, `publish`)
- Structured error handling by error code (`INTERACTIVE_REQUIRED`, `AUTH_REQUIRED`, `USAGE_ERROR`, `NETWORK_ERROR`, `API_ERROR`)
- Skill authoring expertise: 9-step workflow for designing Claude Code skills following the Claude Code spec (SKILL.md) and HappySkills conventions (skill.json, keywords, dependencies)
- Post-convert enrichment workflow: enriches `skill.json` metadata after `happyskills convert` succeeds
- Post-fork enrichment workflow: fills metadata for forked skills after `happyskills fork` succeeds
- Skill release workflow: analyzes changes, infers semver bump, updates changelog, validates, and publishes in one end-to-end pipeline
- Reference docs loaded on demand: `references/skill-authoring.md`, `references/happyskills-conventions.md`, `references/skill-workflows.md`, `references/json-shapes.md`
