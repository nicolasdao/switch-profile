# Changelog

All notable changes to this skill are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com),
and this skill adheres to [Semantic Versioning](https://semver.org/).

## [0.4.1] - 2026-08-08

### Fixed
- **Dependency range no longer pins to a superseded version.** `happyskillsai/happyskills-design` was declared `^0.9.0`, written when design was at 0.9.x. On a `0.x` version `^` is narrow (`^0.9.0` means `>=0.9.0 <0.10.0`), so once semver ranges are actually evaluated (spec 260808-01) this resolved to `design@0.9.8` rather than the current `0.14.1` — a silent downgrade, with no warning, because the range was satisfiable. Now `>=0.14.1`, which states the tested floor and permits forward movement instead of going stale on the next minor.

## [Unreleased]

## [0.4.0] - 2026-06-23

### Changed
- Rename the Mode C `draft` argument to `unreleased` and enrich it into an explicitly multi-agent-safe `[Unreleased]` ledger mode in `references/release-skill-spec.md`: generated release skills now create-or-amend the `[Unreleased]` section (preserving other agents' bullets, deduping), follow the project's release push posture for sharing the ledger (with an auto-deploy-on-push caveat), and a new "Multi-agent note" explains why the mode exists. Aligns generated skills with the `unreleased` convention now standardized across the HappySkills `release-api` / `release-web` / `release-cli` skills. The behavior (no version bump, no tag, promote-on-release) is unchanged — only the argument name and the multi-agent guidance.

## [0.3.0] - 2026-05-31

### Changed
- Restructure Phase 3 to delegate skill scaffolding and structural best practices to the `happyskills-design` skill, separating concerns: this skill now owns the release-skill *content* (assembled into a brief in Phase 3.2), while `happyskills-design` owns the *form* — `npx happyskills init`, the five-slot description grammar, SKILL.md organization, frontmatter, validation, and enrichment (Phase 3.3)
- Replace the in-house shaping steps (self-run `init`, self-read authoring reference, inline five-slot grammar duplication, self-written files, self-validation) with a delegation handoff that passes pre-decided form choices through so `happyskills-design` does not re-ask the user
- Repoint pre-flight check 3 from locating the core `happyskills` skill to confirming `happyskills-design` is installed (the skill-authoring reference lives in `happyskills-design`, not core)

### Fixed
- Declare the previously-empty `dependencies` block in `skill.json` with `happyskillsai/happyskills-design` so the runtime dependency this skill relies on is explicit and installed

## [0.2.0] - 2026-05-25

### Changed
- Rewrite frontmatter `description` per the five-slot grammar: under the 250-char soft cap, with a Domain prefix and a Negative clause for sibling-skill disambiguation
- Enable Claude auto-invocation by removing `disable-model-invocation: true` (skill confirms before all irreversible actions, so auto-invoke is safe)
- Expand `skill.json` keywords from `["deployment"]` to a richer set covering release, changelog, semver, versioning, git-tag, release-automation, keep-a-changelog, monorepo
- Cross-reference the Mode C pre-flight exception from Section 3 of `references/release-skill-spec.md` so the hard-gate rule reads correctly in isolation
- Rewrite Phase 3.5 (Craft the Description) to enforce the five-slot grammar, a length budget, multiple-phrasing-family `Use when` clauses, and a mandatory `Not for` clause when sibling `release-*` skills exist — directly addressing poor auto-invocation in generated release skills
- Add a worked GOOD/BAD example and a mandatory pre-write self-check to Phase 3.5 so the generator catches grammar violations before the file is written (the validator only catches length, not structure)
- Differentiate the SKILL.md description (Claude routing) from the skill.json description (registry search) in Phase 3.5 and Phase 3.6 so generated skills no longer paste the same string into both

### Fixed
- Renumber the duplicated `### 3.6` section header (Validate is now `### 3.7`)

## [0.1.0] - 2026-04-22

### Added
- Initial release
