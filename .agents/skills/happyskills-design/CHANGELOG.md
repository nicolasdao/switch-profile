# Changelog

## [0.14.3] - 2026-08-29

### Fixed

- **`references/constellation-pattern.md` said HappySkills ships as a "6-member constellation".** It ships nine — a core plus eight satellites. The stale count sat in the reference this skill loads to *teach* the pattern, and the repo's constellation-count guard could not see it: that guard's file list stopped at published pages and never walked the bundled skills. It does now.

## [0.14.2] - 2026-08-25

### Changed
- **The Constellation Decomposition Workflow now defaults hard to bundled, and states what an opt-in tier costs.** The bundled-vs-opt-in choice remains legitimate for a third-party constellation, but step 8 now names the failure mode measured on HappySkills' own: a roster maintained by hand in three places, two of which had silently drifted, and a flow that took four turns and an agent restart to reach one capability. Choose opt-in only for a satellite that is genuinely large and genuinely rare.
- Dropped the now-false "In HappySkills this is `happyskills-search`" example from the discovery-skill bullet — HappySkills no longer has an opt-in tier for search to serve.

### Fixed
- **Step 11 recommended `^0.1.0` for new satellite dependency ranges** — the exact caret trap that silently downgraded HappySkills' own constellation by thirteen-plus releases (`happyskills@2.8.2`). It now prescribes a `>=` floor at the tested version and explains why a caret goes stale on a `0.x` minor.

## [0.14.1] - 2026-08-07

### Fixed
- **Audit step 11 no longer reads as an instruction to flag differing descriptions.** `SKILL.md` step 11 said *"skill.json description differs from SKILL.md description (different purposes)"* and `references/workflows.md` step 10 asked it outright — *"Does the skill.json `description` differ from the SKILL.md `description`?"*. As a checklist **item**, "X differs from Y" reads as a condition to verify and report, and the interrogative form invites a yes/no the agent then acts on. `references/happyskills-conventions.md` already had it right (*"they serve different purposes and can differ"*); the three disagreed. Both now state that the two descriptions serve different purposes (registry search vs agent auto-invocation), **can differ**, and that a difference is **not a finding** — never flag it, never ask the user to reconcile them. Same defect class that produced `docs/gotchas/skills.md` § 2.7 in `happyskills-publish@0.6.3`. Pinned by `test/skill-description-independence.guard.test.js`.

## [0.14.0] - 2026-07-13

### Added
- **How to design COMPLEX configuration** (`references/skill-authoring.md` § Configuration). A `config` field's `type` may now be `object` or `array`, not just a scalar — so a skill can declare a setting that has no scalar form (a theme, a named palette library). An `env` var stays scalar-only: a `.env` value is always a string. A field authored by the skill's **own UI** rather than by a human at an install prompt declares **`prompt: false`** and is skipped at install (an object/array field is never prompted regardless) — without it, installing such a skill was a wall of unanswerable questions.
- **The opt-in author-declared `schema`** — the single highest-value thing an author does when designing complex config. Without one, HappySkills stores the value verbatim and never looks inside, so nothing can tell an agent that `palettes.Acme.palette[2]` is not a hex colour; it finds out at runtime and cannot reliably repair it. With one, `skills-config set` **refuses** the bad write and `skills-config validate` reports **every** violation with an exact path and an imperative fix, so an agent repairs and re-runs until it converges. **This does not violate content opacity:** the schema ships *inside* the skill and versions *with* it, so it cannot drift from the skill's real contract the way a validator on HappySkills' release cycle would. There is no second validator — one schema, declared once, enforced on the author's behalf.
- **Four design rules that decide whether the repair loop converges:** close the shape (`additionalProperties: false`) so a typo'd key becomes a located error rather than silent acceptance; constrain the **leaves**, not just the branches (`"type": "string"` on a colour tells an agent nothing — `"pattern": "^#[0-9a-fA-F]{6}$"` tells it exactly what to write); use `patternProperties` for an author-keyed map and `properties` + `required` for a fixed record (getting this backwards is the common mistake); and keep the schema as the **single source of truth** rather than maintaining a second validator that will diverge.
- **The consumer-side write path** — `skills-config set` / `unset`: atomic, key-scoped, locked, whole-key semantics (no deep-merge — do your own read-modify-write), the scope decision table (`--global` / `--root`), and that `set` refuses a key declared `secret: true`. Plus `skills-config validate`, which checks the consumer file itself.

### Changed
- **Hardened the canonical config-resolution recipe: ABSENT ≠ CORRUPT (new step 2b).** A *missing* `skills-config.json` means "nothing configured yet" → fall back to defaults. A file that *exists but does not parse* means the consumer's settings are **unreadable**, and quietly treating that as "nothing configured" is a silent failure — the skill runs with the wrong settings and reports success. Never `catch { return null }`: stat the path first, and on a present-but-unparseable file **throw**, naming the file and pointing at `happyskills skills-config validate`, and telling the user to repair it in place rather than delete it.
- Drew the **configuration vs application-state** boundary: `skills-config.json` is committed and meant to be read in a pull request. A theme, a palette library, thresholds — fine. Documents, layouts, caches, edit history — not fine. The CLI warns past 64 KB, which is the smell, not the rule.

## [0.13.5] - 2026-07-08

### Added
- Declared `authors` and `license` (BSD-3-Clause) in `skill.json`.
- **Least-privilege `allowed-tools` guidance** — a new Best Practice #18 (plus an anti-pattern row) in `references/skill-authoring.md`, and prescriptions in the Authoring Workflow (step 6) and Audit Workflow (step 7): `allowed-tools` is the no-prompt surface and must be scoped to what the skill actually invokes; a read-only or CLI-dispatch skill carries no `Write`/`Edit`, and the broad scaffold default must never be inherited unnarrowed.

### Changed
- Reworded the forbidden-YAML-character constraint to match the validator: `description` (and `compatibility`) are scanned unconditionally, quoted `argument-hint` is exempt, and `name` is pattern-restricted — instead of the over-broad "all frontmatter values".

### Fixed
- Marked out-of-bundle `docs/*` references in `references/constellation-pattern.md` and `references/skill-authoring.md` as "not bundled with this skill" so the agent no longer treats them as loadable on-demand references.

## [0.13.4] - 2026-07-06

### Added
- **Teach the `setupGuide` authoring pattern and its proactive detection** (`references/skill-authoring.md` § Configuration). When a required credential needs human-only setup the agent can't do (mint a token in a dashboard, register an OAuth app, grant permissions), the author attaches a `setupGuide` (a reference file) + optional `verify` to the `env`/`config` entry, and install surfaces a `complete_manual_setup` next_step. Guidance directs the author/reviewer to actively watch for this (any required secret obtained from a dashboard/OAuth is a candidate), notes that `validate` flags the common case, and — the key move — to **offer to research and draft the guide**, automating whatever the agent can first. Full contract: `docs/skill-format.md` § 4.6.1.

## [0.13.3] - 2026-07-06

### Added
- **Prescribe safe runtime consumption of secrets — keep credential values out of the agent's context window.** The Configuration guidance covered where a secret is *stored* (git-ignored `.env`, pointer in `skills-config.json`) and how to check *presence* (`secretsPresent`), but said nothing about the moment a skill actually *uses* a credential — and its step 4 ("Load secrets from the resolved `envFile`") could be read as "the agent opens the `.env` and reads the value," the exact leak. The canonical embed-verbatim recipe in `references/skill-authoring.md` § Configuration now (1) rewrites step 4 to forbid the agent from reading a secret's value into its own context (no `Read`/`cat`/`echo` of the `.env`, no inlining into a `fetch`/`curl`), directing the value straight from the `.env` into a subprocess's environment; (2) rewrites step 5 to check presence, not value; and (3) adds an authoring directive to ship a thin in-process wrapper (the pattern the `cloudflare` skill's `scripts/cf.js` and this repo's `database/migrate.js` already use) so a subprocess — never the model — consumes the credential. Mirrored as a one-line contract in `docs/skill-format.md` § 4.6 and as a new "Using a secret when the skill runs" section on the public docs-site secrets page.

## [0.13.2] - 2026-07-06

### Added
- **Teach `sharedEnv` for constellation secrets.** When a constellation's members share a secret (the common case — e.g. a `cloudflare` core + satellites all reading one `CLOUDFLARE_API_TOKEN`), the author now declares `sharedEnv: true` on the core so install scaffolds ONE `./secrets/<core>.env` for every member instead of an identical secrets file each. Added to `references/constellation-pattern.md` (new § 1.1), `references/skill-authoring.md` § Configuration, and the Constellation Decomposition Workflow in `references/workflows.md` (step 18b — set it alongside the dependency-as-bundle wiring). Opt-in, core-only, invalid on a kit. Full contract: `docs/skill-format.md` § 4.6.

## [0.13.1] - 2026-07-05

### Fixed
- **Correct `envFile` resolution in the canonical config-resolution recipe (`references/skill-authoring.md` § Configuration).** Step 3 previously over-simplified to "resolve `envFile` against the project root", which is wrong for a secrets pointer declared in the **global** `~/.agents/skills-config.json`. It now resolves `envFile` against the directory of the `skills-config.json` that *declared* it — a project-layer pointer against the project root, a global-layer pointer against `~/.agents` — with project-first precedence, matching the CLI's `skills-config get` resolver. Also notes that the CLI's `happyskills validate` now statically lints config usage (warns when a config/env-declaring skill omits the `skills-config get` recipe or declares a field/var it never uses).

## [0.13.0] - 2026-07-05

### Changed
- **Replace the in-skill `config.json` setup pattern (Pattern 6) with the `skills-config.json` convention.** Configuration now lives OUTSIDE the skill, in a committed project-root `skills-config.json` — a reinstallable skill's own folder is wiped on every update, so anything stored inside is lost. `references/skill-authoring.md` drops Pattern 6 and gains a "Configuration" section covering the author-declared `config`/`env` schema in `skill.json` and the canonical, verbatim SKILL.md read snippet every configurable skill embeds (prefer `happyskills skills-config get`, fall back to reading the file with a walk-up to the project root, stopping at `.git`). Rewrote the now-dangling cross-references in `references/happyskills-conventions.md` and `SKILL.md` to point at the new convention.

### Added
- **Add a config-drift check to the Skill Audit Workflow (`references/workflows.md`).** For a skill that declares `config`/`env`, the audit now flags declared-but-unused fields and used-but-undeclared config/env tokens, and confirms the SKILL.md embeds the canonical "resolve configuration before using any default" snippet. Implemented as skill guidance — there is no `happyskills audit` CLI command.

## [0.12.2] - 2026-07-03

### Changed
- **Added an explicit "Do NOT add `keywords`" guard to Post-Init Enrichment (`references/workflows.md`).** Even though the "keywords is deprecated" guidance already lived in `references/happyskills-conventions.md § 3`, the enrichment *workflow* the agent runs never mentioned `keywords` — so an agent completing `skill.json` metadata would populate the empty `keywords: []` field out of habit. The guard now sits inline in the workflow: never populate `keywords` during enrichment/authoring/conversion/fork/update; leave any existing array untouched. Also refreshed the stale intro that claimed a fresh `skill.json` "only has `name` and `version`" (it has the full scaffold set).
- **Removed the skill's own populated `keywords` array from `skill.json`.** The design skill was carrying a 9-item `keywords` list, contradicting its own deprecation guidance. Removed for self-consistency now that the CLI scaffold (`happyskills init`/`fork`, CLI ≥ 1.16.x) no longer emits the field at all.

## [0.12.1] - 2026-06-29

### Changed
- Update inventory reads to `list --all-scopes` (CLI `1.13.0+`) so they span **both** project-local and global skills — a globally-installed sibling loads in the project too. The cross-skill orthogonality check, kit identification, kit-member version resolution, and the draft-publish note now use it; `data.skills` is an array in that mode (iterate / match on `name`), and when a kit appears in both scopes the local copy is the edit target. Merged with the 0.12.0 dependency-declaration rework — neither change diluted.

## [0.12.0] - 2026-06-29

### Changed
- **Dependency declaration is now a first-class, mandatory authoring step (`SKILL.md` Section 2, steps 5/8/10).** Step 5's "does this skill execute code?" question now also asks which external binaries the code or `scripts/` invoke, and routes them to `systemDependencies`. Step 8 is rewritten from "Verify skill.json basics" to "Set skill.json basics AND declare both kinds of dependency (MANDATORY — runs before validate, NOT deferred to publish)", covering the `systemDependencies` detection scan (object shape + per-platform install + Confidence Gate) and the `dependencies` check, and calling out the common CLI-vs-skill conflation (invoking a CLI is a `systemDependency`; depending on another skill is a `dependency`). Step 10 (Post-Init Enrichment) is rescoped to publish-facing metadata and states that skipping enrichment for an unpublished skill is never a reason to skip dependency declaration.
- **Removed a contradiction in `references/happyskills-conventions.md`.** A callout under the "Minimal Example (Unpublished / Local)" now clarifies that "unpublished / local" exempts a skill from registry/publish metadata only — never from dependency correctness.

### Rationale
Surfaced by a real failure: a skill that shells out to `gws` and `python3` was authored end-to-end through this skill and shipped with `dependencies: {}` and no `systemDependencies`. The MANDATORY detection scan already existed in `references/workflows.md` § Post-Init Enrichment, but was gated behind a publish-flavored step that is rational to skip for local skills, while the one inline authoring trigger (step 5) dead-ended at `scripts/` and the word `systemDependencies` never appeared anywhere in the authoring path. These edits co-locate the trigger with the moment of recognition, make the dependency scan run before `validate`, and decouple it from the publish decision.

## [0.11.3] - 2026-06-22

### Added
- **"Unique identifiers" guidance in the five-slot description grammar (`references/skill-authoring.md` § 5 — Object slot + composition recipe step 3, with a one-line echo in `SKILL.md` Section 2 step 4).** Authors are now told to name the concrete proper-noun identifier a skill is about — a library, API, tool, file format, or product (`Gemini`, `Postgres`, `JWT`, `.docx`) — directly in the description's object and triggers, because proper nouns are the highest-precision routing tokens and cut both false negatives (the user names the technology and the skill fires) and false positives (a request naming a *different* technology correctly does not). Worked contrast: `JWTs` routes more precisely than `authentication tokens`. The guidance **explicitly excludes genuinely general-purpose skills** — they have no proper noun to name, and inventing one narrows routing wrongly (guardrail stated at all three insertion points).

### Rationale
Distilled from a comparison of three 2026 agent-skill research papers (SkillSmith arXiv:2605.15215, SkillJuror arXiv:2606.11543, SkillReducer arXiv:2603.29919) against this framework — SkillReducer makes unique identifiers one of only three routing signals a description needs. Of the gaps the comparison surfaced, only this one was adopted: it improves triggerability in both directions at near-zero risk and minimal footprint (no new section, no SKILL.md line growth). The remaining candidate gaps were deliberately rejected as marginal, redundant with existing best practices (e.g. #16), or impractical, to avoid over-optimizing the skill.

## [0.11.2] - 2026-06-21

### Fixed
- Correct the Publishing Checklist visibility item in `references/happyskills-conventions.md`, which described skills as "private by default (workspace only)" — conflating the *private* and *workspace* tiers. It now states the three distinct tiers (private = only people you explicitly grant; workspace = every member of the owning workspace, not public; public = listed in the catalog) and references the `--visibility` flag for choosing among them at first publish.

## [0.11.1] - 2026-06-10

### Changed
- **Sharpened Best Practice #15 (Gotchas) in `references/skill-authoring.md` with placement and progressive-disclosure guidance.** The original named *what* to capture but not *where it lives* or *how SKILL.md surfaces it*. Added a size-scaled placement ladder: a few gotchas stay in an inline `## Gotchas` section; many or domain-split gotchas keep that section as a thin index linking **directly** to `references/gotchas/<domain>.md` (one hop — respecting the reference-depth rule in § 7 and SKILL.md's hard 500-line cap). Made the load-bearing rule explicit — an unlinked gotcha file is invisible to the agent, so SKILL.md must always link to externalized gotchas, and the index must stay in sync with the files. Calibrated against over-structuring (don't split three gotchas — the #17 failure in miniature). Adapted from the hub+domain gotchas pattern the project's documentation tooling uses, folded into a skill's single always-loaded entry point.
- **New § 9 anti-pattern row** for gotchas that outgrow SKILL.md or sit unlinked in `references/`.
- **`references/workflows.md` Audit step 7 (content structure)** now checks hub↔domain gotchas sync — every `references/gotchas/<domain>.md` linked from SKILL.md's index, every link resolving.

### Rationale
Follow-up to 0.11.0, closing the gap that release left open: BP #15 specified the *content* of a Gotchas section but not its *placement* or the SKILL.md *linking contract* — the exact progressive-disclosure mechanics that keep externalized gotchas discoverable while holding SKILL.md under its hard line cap. Ports the mature hub+domain gotchas pattern already proven in the documentation tooling, adapted to a skill's single always-loaded entry point and its shallow reference-depth rule.

## [0.11.0] - 2026-06-09

### Added
- **Three authoring best practices in `references/skill-authoring.md` § 9**, distilled from Anthropic's "Lessons from building Claude Code: how we use skills" and integrated into the existing framework rather than appended:
  - **#15 Capture hard-won failure knowledge in a Gotchas section** — names the highest-signal content in a skill (the counterintuitive facts Claude gets wrong by default) and distinguishes it from the Constraints section (#3): constraints are *prohibitions*, gotchas are *corrections to the model's wrong priors*. Tied to the Skill Update Workflow as the mechanism that grows it.
  - **#16 Don't state the obvious, encode only the non-default** — the body-content counterpart to the description discipline (#2) and the § 5 length budget: every line should push Claude off a default it would otherwise take; cut anything true of any competent engineer with no skill loaded.
  - **#17 Give judgment room, don't railroad** — reconciled with the skill's own prescriptiveness via stakes-calibration: tight rails on destructive, irreversible, or deterministic operations (cf. #4, #12), room to adapt on non-critical paths.
  - Three matching anti-pattern rows in § 9, each cross-referencing its best practice.
- **`references/skill-authoring.md` § 11 — Pattern 6 (Setup via config.json)**: the per-user configuration convention (read `${CLAUDE_SKILL_DIR}/config.json` on start, ask once via AskUserQuestion, persist), framed explicitly as a convention (the Agent Skills spec defines no such file) rather than a platform feature, with a publish-safety caveat.

### Changed
- **`references/happyskills-conventions.md` § 7** — noted that a per-user `config.json` is NOT in the auto-excluded set; publish an empty or template config (or omit it), never filled-in values or secrets (secrets belong in `.env`, which is excluded). Cross-references Pattern 6.
- **`SKILL.md` Section 2 step 5** — the design-content-structure step now also asks whether the skill needs per-user setup, bridging authoring to Pattern 6 (which otherwise had no referrer).
- **`references/workflows.md` Audit step 9** — the anti-pattern scan enumeration now surfaces "missing gotchas section" and "restating obvious default behavior."

### Rationale
Folds the durable lessons from Anthropic's published skill-authoring guidance into the framework, integrated to fit existing structure: the three content-quality practices map to one principle — maximize signal, cut noise, stay adaptable — and the config.json pattern reuses the existing AskUserQuestion and `${CLAUDE_SKILL_DIR}` conventions. Deliberately excluded the blog's memory/persistent-state and on-demand-hooks ideas, both Claude-Code-specific and at odds with HappySkills' multi-platform mission. The change was audited via the skill's own Audit Workflow before release.

## [0.10.2] - 2026-06-06

### Changed
- Restructured `capabilities` into per-workflow clusters (`create-skill`, `review-skill`, `improve-skill`, `manage-kits`) with richer intents; the review/improve/kit capabilities carry intents but no CLI command, so `happyskills resolve` routes intents like "audit my skill" here even without a command (spec 260606-01). Additive metadata; no behavior change.

## [0.10.1] - 2026-06-06

### Added
- Declared the `author-skill` capability in `skill.json` (owns the `init` command + design/audit/update intents) so `happyskills schema` and `happyskills resolve` can route authoring intents to this skill (spec 260606-01). Additive metadata — older CLIs ignore it; no behavior change.

## [0.10.0] - 2026-06-03

### Added
- **Kit editing — design now owns mutating an existing kit, not just creating one.** A kit is a skill (`type: "kit"`) whose content is its `dependencies` list, so changing what a kit bundles is content authoring and belongs here. Added `SKILL.md` Section 6 "Kit Workflows (Create and Update)" with a new `6b — Update a kit` summary, and a full **Kit Update Workflow** in `references/workflows.md` (disambiguate edit-bundle vs upgrade-installed vs publish → identify the `_kit-` target and its `list` bucket → divergence pre-flight → surgical `skill.json` `dependencies` edit → README sync → validate → route to publish). New `SKILL.md` Section 1 routing-table rows ("add a skill to my kit", "remove a skill from my kit", "edit my kit", "swap a skill in my kit", …) and a disambiguation rule resolving the three-way "update my kit" ambiguity.

### Changed
- **`description` rewritten to cover kits (242 chars).** `Design, audit, and update skill content` → `Design, audit, and update skills and kits`, with `editing a kit` added to the triggers and `upgrading` added to the `Not for` clause (cedes "upgrade my kit" to core at the routing layer). Stays under the 250-char soft cap.
- **Skill Update Workflow (Section 3) pre-flight brought to full status-enum parity.** Both `SKILL.md` Section 3 and `references/workflows.md` Phase 1 now route the complete `status` enum — added handling for `not_found` (a draft scaffolded by `init`, never published: no lock entry, no remote baseline → proceed), `drift` (BLOCK → sync repair), `ahead` (proceed), and `conflicts` (route to sync).

### Fixed
- **Stale cross-reference in `references/cli-reference.md`** — `init` was documented as used by "the Kit Creation Workflow (SKILL.md Section 5)"; corrected to "Kit Workflows — Create (SKILL.md Section 6)".

## [0.9.8] - 2026-06-02

### Removed
- **Dropped all guidance that populates `skill.json` `keywords`.** Removed the "Suggest keywords" step from Post-Init Enrichment (`references/workflows.md`) and the canonical-slug doctrine from `references/happyskills-conventions.md` — the §3 "Keyword System" section, its slug table, the recommended-fields row, and the publishing/authoring checklist items — replaced with a short "Keywords (deprecated)" note. Also removed the keyword mentions in the Update, Audit, and Kit workflows, and in `SKILL.md` (authoring step 8/10, audit step 11). `keywords` is a deprecated, unused field — not read by search, ranking, or the platform taxonomy — so authoring spends no effort on it. Discovery is driven by the platform-owned taxonomy derived from `description` + `SKILL.md`.

## [0.9.7] - 2026-06-01

### Changed
- **`references/cli-reference.md` aligned to the canonical six-key envelope** (list payloads under `data.results`, exit status on `meta.exit_code`). Section 8 adds envelope hygiene: surface `warnings[]` and stop on an unrecognised `next_step.action` / `error.code`.

## [0.9.6] - 2026-06-01

### Changed
- **Attribution Prompt `license` options reworked and hoisted into SKILL.md.** The `license` AskUserQuestion (Post-Init Enrichment step 7b and Kit Enrichment step 1b in `references/workflows.md`) now presents `MIT` → `Apache-2.0` → `UNLICENSED` → `Show me more`. `UNLICENSED` (proprietary, all-rights-reserved) is promoted out of the "Show me more" sub-table into a top-level option so users keeping a skill private see it without a second hop. `BSD-3-Clause` moves down into the "Show me more" catalog (and replaces `UNLICENSED` in the second-prompt shortlist) — it is near-redundant with MIT, whereas Apache-2.0 (explicit patent grant) earns the slot on a distinct axis. Option descriptions reworded for clarity (MIT noted as "most common"; UNLICENSED spelled out as "not open source, keep private and closed").
- **The four license options + their order are now enumerated directly in `SKILL.md` Section 9 (Constraints).** Previously the literal option list lived only in `references/workflows.md` — a load-on-demand file. An agent running the authoring workflow without opening that file reconstructed the prompt from training priors (typically `MIT / Apache-2.0 / Type-something`), silently dropping `BSD-3-Clause`, `Show me more`, and the discovery path. Hoisting the list into the Constraints section (the same safeguarding move as `[0.7.1]`, applied one indirection-level deeper) removes the room to improvise.

### Added
- **Explicit guardrail against conflating "Show me more" with the auto-injected "Other".** Both `workflows.md` call sites and the `SKILL.md` constraint now state that AskUserQuestion adds a free-text "Other" / "Type something" option automatically, that the agent must NOT add one itself, and that "Other" is NOT a substitute for "Show me more" (which opens the full SPDX catalog for users who don't know the identifier they want). Also forbids tagging any license option "Recommended", since order is not endorsement and a Recommended tag would re-introduce the silent-MIT bias `[0.7.1]` removed.

### Rationale
Field report: the `license` prompt consistently rendered as `MIT / Apache-2.0 / Type something` instead of the documented four-option list, and the `UNLICENSED` and `Show me more` paths never appeared. Root cause was a partial recurrence of the `[0.7.1]` failure mode — `[0.7.1]` removed the third indirection hop but left the decisive content (the literal options) one hop deep in `references/workflows.md`, so an agent that didn't open that file improvised the prompt from priors. The fix mirrors `[0.7.1]`'s proven pattern (enumerate the load-bearing detail in the Constraints section so it cannot be missed) and additionally surfaces `UNLICENSED` at the top level so the "keep this private" intent is one click, not two.

## [0.9.5] - 2026-05-28

### Changed
- **Section 8 (Validate Error Handling)** updated for the canonical six-key response envelope (spec 260525-cli-default-json § 4). Failed validation now returns `ok === false` with `error.code === 'VALIDATION_FAILED'` and `next_step.action === 'fix_validation_errors'`. Per-rule failures are read from `error.validation_errors[]` (the new closed-schema location, alongside `data.errors[]` which remains backward-compatible). No procedural changes — the recommendations-driven fix loop is unchanged.

## [0.9.4] - 2026-05-25

### Changed
- **Kit format docs updated to README.md (per `happyskills@0.52.0+`).** Kits no longer ship a frontmatter-less `SKILL.md`; they ship a plain `README.md`. The absence of `SKILL.md` is what keeps a kit invisible to every agent runtime (Claude Code, Codex, Gemini, etc.) — no missing-frontmatter trick required, no warnings emitted by Codex/Gemini. Updated in: `SKILL.md` Section 6 key behaviors; `references/workflows.md` Kit Creation Workflow step 9 (now "Write kit README.md", with an explicit "delete any SKILL.md left over from a pre-0.52.0 scaffold" note); `references/happyskills-conventions.md` kit definition + key differences; `references/cli-reference.md` `init --kit` description + `files_created` example. Behavioural change on the CLI side: `init --kit` writes `README.md`, `validate` requires `README.md` for kits and rejects any `SKILL.md` found inside a kit directory.

## [0.9.3] - 2026-05-25

### Changed
- **Section 2 step "Optional final step" + `references/workflows.md` step 12** clarified to name the just-scaffolded skill as a **draft** (per `happyskills@0.51.0+`: `data.drafts[]`, not `data.external[]`) and to spell out that the publish skill ships drafts via `release` in a single step — no `convert` detour. Pre-empts the failure mode reported in spec 260522-02 where the design skill correctly routed to the publish skill but downstream user-facing language still surfaced "external" / "convert" jargon.

## [0.9.2] - 2026-05-24

### Changed
- **`references/workflows.md` step 9 rewritten** to reflect the post-260524-02 constellation. Step 9 previously conflated "discovery skill" and "concierge" into one role and named `happyskills-help` as that combined role. After `happyskills-search@0.1.0` was extracted from help, the two roles are distinct: the **discovery skill** owns marketplace search + version/changelog lookup + install-on-recommendation; the **concierge** (optional) owns explain-the-constellation Q&A. Step 9 now describes both and explains they can be combined or split, with HappySkills as the example of the split form (`happyskills-search` + `happyskills-help`).
- **Step 8 wording** in `references/workflows.md` aligned: opt-in satellites are surfaced through a "discovery skill" (not "concierge skill"), since install-on-recommendation lives on the discovery side after the split.

## [0.9.1] - 2026-05-24

### Changed
- **SKILL.md `description` rewritten.** `Design and audit Claude Code skills` → `Design, audit, and update skill content`. "Claude Code skills" replaced with "skill content" — HappySkills targets 8 agent platforms, not just Claude Code, and the skill's own SKILL.md framing is that it "operates on skill content." Added `decomposing a mega-skill` to the trigger list — a Section 5 capability that wasn't previously surfaced in the description and therefore wasn't reachable via auto-invocation.
- **`references/workflows.md` step 9.** "Release now" branch rewritten to describe the `release` primitive (atomic snapshot + validate + bump + changelog + publish, ahead-state recognition, structured `next_step` envelope on failure). Aligns design's prose with the publish skill's v0.4.0 framing.

## [0.9.0] - 2026-05-19

### Added
- **`references/happyskills-conventions.md` § 4 — new "Confidence Gate" subsection** under System Dependencies. Per-`(tool, platform)` self-assessment: high-confidence ubiquitous tools (`git`, `node`, `python`, `docker`, `curl`, `jq`, major cloud CLIs) may be written directly from training; any uncertainty MUST be resolved via `WebSearch` against official docs *before* writing the command, with a docs-pointer fallback (`"See <url> for install instructions"`) when web tools are unavailable or docs are ambiguous. Explicit forbidden shortcuts enumerated: guessing Homebrew formula names, guessing apt/yum package names by analogy, guessing `winget` `Vendor.Product` IDs, and extrapolating one verified platform to the other two.

### Changed
- **`references/happyskills-conventions.md` § 4 — tightened the "all three platforms" rule.** All three platform keys (`darwin`, `linux`, `win32`) are now MUST-be-present (a missing key is a validation failure, not a TBD). Each value MUST be exactly one of: (1) a verified install command, (2) `"See <official-docs-url> for install instructions"`, or (3) `"Not supported on <platform>"`. Empty strings, `null`, `"TBD"`, and `"Install manually"` are explicitly rejected. Guessing a command to fill a slot is rejected — use option 2 instead.
- **`references/workflows.md` — Post-Init Enrichment step 5 rewritten with explicit sub-steps a/b/c.** (a) Discover: unchanged detection procedure. (b) Verify per platform (Confidence Gate): for every `(tool, platform)` pair, agents MUST apply the Confidence Gate and run `WebSearch` for any uncertain pair before writing the command; never extrapolate one verified platform to the others. (c) Report verified-vs-deferred to the user: a transparency summary after population, listing pairs resolved from training, pairs resolved via `WebSearch` (with source URLs), pairs deferred to docs pointers (with URLs), and pairs marked Not supported (with reasons).

### Rationale
Field-report symptom: when authors used `happyskills-design` to populate `systemDependencies` for niche or vendor-specific CLIs, the agent confidently filled all three platform install commands by pattern-matching package-name conventions — and frequently got the Homebrew formula, the apt package, or the `winget` `Vendor.Product` ID wrong. The previous § 4 wording ("If the install command is known, include it; if unknown, write a message") relied on the LLM's self-knowledge of *what it knows* — the exact failure mode this update closes. The Confidence Gate makes the self-assessment explicit (per pair, not per tool), routes uncertainty to `WebSearch` against official docs, and provides a non-guessing fallback (docs pointer) so the file is always populated with verifiable content. Step 5c surfaces the verified-vs-deferred breakdown to the user, so over-confident self-assessments get caught at review time rather than at the user's install time.

## [0.8.0] - 2026-05-14

### Changed
- **Design pattern renamed: Suite Pattern → Constellation Pattern.** Coordinated rewrite across `SKILL.md`, `references/workflows.md`, `references/skill-authoring.md`, and the canonical reference. The umbrella name moves; "satellite skills" stays. Auto-invocation behaviour is unchanged (the skill's frontmatter `description` is verb-led and never referenced the pattern name).
- **`references/suite-pattern.md` → `references/constellation-pattern.md`** (file rename + body rewrite). Every internal linker — `SKILL.md`, `references/workflows.md`, `references/skill-authoring.md` — updated to the new path. "Suite Decomposition Workflow" → "Constellation Decomposition Workflow" throughout.
- **Naming-note prose tightened.** Removed the defensive "(analogous to a constellation being made of a family of stars)" parenthetical in `constellation-pattern.md` — the metaphor stands on its own.

### Rationale
The "Suite" metaphor was a flat-collection image (Office Suite, hotel suite) that never captured the core/satellite relationship the pattern actually describes. "Constellation" is coherent with the existing sub-pattern name — a constellation has structure and orbiting bodies, which is exactly the architectural claim. Internal-terminology refactor; no capability change, no breaking change to invocation or routing. Pre-alpha, so the rename ships before external surfaces accumulate the old name.

## [0.7.1] - 2026-05-13

### Changed
- **`references/workflows.md` — renamed `Optional Fields Prompt` to `Attribution Prompt (MANDATORY)`** and removed it from the Common Procedures section. The word "Optional" in the procedure name pattern-matched as skippable to LLM agents, and the three-hop indirection (SKILL.md → Post-Init Enrichment → Common Procedures) meant the agent often never loaded the third file and silently picked defaults instead of asking.
- **`references/workflows.md` — inlined the three prompts (authors, license, repository) directly into `Post-Init Enrichment` step 7 and `Kit Enrichment` step 1.** Each inlined block opens with: "NEVER pick defaults on the user's behalf. NEVER skip a field. NEVER assume MIT. Silently defaulting is a workflow failure, not a shortcut." The third hop is eliminated — every call site now contains the full procedure with explicit MANDATORY wording, matching the discipline already applied to system dependencies (step 5) and validation (step 11).
- **`SKILL.md` Section 2 step 10 — enumerated `authors, license, repository` by name** in the Post-Init Enrichment cross-reference. Previously the parenthetical listed only "skill.json description, keywords, dependencies, CHANGELOG, optional publish," so the agent's mental model of "what Post-Init does" didn't include attribution fields. Out of sight, out of mind.

### Added
- **`SKILL.md` Section 9 (Constraints) — new NEVER rule** banning silent license defaults: "NEVER pick a license on the user's behalf during enrichment. MIT is not a default. The Attribution Prompt is MANDATORY — three separate AskUserQuestion calls for `authors`, `license`, then `repository`, in that order. Silently defaulting to MIT (or any other choice) skips a critical user decision and is treated as a workflow failure, not a shortcut."

### Rationale
Field report from a user: every authoring session with `happyskills-design@0.7.0` skipped the authors/license/repository prompts and silently defaulted to MIT, despite the procedure being fully documented in `references/workflows.md`. Root cause was procedural/architectural, not missing content: (1) the procedure's name `Optional Fields Prompt` told agents it was skippable; (2) authors/license/repository were never enumerated in the SKILL.md routing description, so they fell out of the agent's working model; (3) the procedure was 3 hops deep behind voluntary reference loads, so an agent in flow would proceed from a partial mental model rather than reading the third file; (4) step 7's wording was a single-line cross-reference, lacking the MANDATORY framing that protects steps 5 and 11. The fix mirrors the safeguarding pattern already proven on system-deps and validation: name the procedure as mandatory, enumerate the fields at the call site, eliminate the indirection that allowed silent skipping, and add an explicit Constraints-section anti-pattern that the agent cannot miss on routing-table scan.

## [0.7.0] - 2026-05-13

### Added
- **`SKILL.md` — new "STOP — pre-flight for NEW skills" block at the very top, before Section 1.** Hard guardrail that mandates running `npx happyskills init <name> --json` BEFORE writing any file when the task is to design / create / scaffold / init a new skill. Explicitly forbids manual directory creation, manual `skill.json` authoring, and skipping `init` because the project uses a non-default skills location (`.agents/skills/`, `.cursor/skills/`, etc.) — instructs to run `init` in `.claude/skills/` first and relocate afterward. Pre-flight scope limited to NEW skills; updates/audits/decomposition of existing skills are unaffected.
- **`SKILL.md` Section 9 (Constraints) — new top-most NEVER rule** mirroring the pre-flight: NEVER manually create a skill directory, write `skill.json`, or write any file for a NEW skill before running `init`. Names the consequence (non-managed skill that breaks `validate`/`list`/`publish`/`sync`) and the only exception (editing files inside an existing skill whose directory was previously created by `init`).

### Rationale
Session learning: the design skill's existing "Scaffold if needed — If no skill directory exists yet, run `npx happyskills init`" was step 3 of a 10-step list in Section 2, softened by "if needed," and not echoed in the Constraints section. An agent following the workflow rationalized skipping `init` because the project kept its skills in `.agents/skills/` instead of the default `.claude/skills/` — assumed `init` would fail or scaffold in the wrong place, and manually scaffolded the files instead. The result was a structurally valid but non-managed skill that cannot be `validate`d, `list`ed, `publish`ed, or `sync`ed. The two reinforcing additions (procedural STOP at the top + absolute NEVER in Constraints) close the gap: a fresh agent reading the skill cannot reach Section 2 without seeing the pre-flight, and the constraint catches drift if an agent attempts to bypass anyway. Non-default skill locations are explicitly addressed so the previous rationalization path is closed.

## [0.6.0] - 2026-05-12

### Added
- **`references/skill-authoring.md` §5 — new "When to drop the Domain — the two-function lens" subsection.** Establishes that the Domain slot does two distinct jobs — *brand anchor* (suite identity) and *topical hard-filter* (narrows the LLM's routing prior for polysemous verbs like `Map`, `Clone`, `Build`, `Fetch`, `Sync`, `Run`) — and provides a five-row decision rule for when to use each form, when to skip the Domain entirely, and how to calibrate per-skill rather than per-suite. Includes a worked-examples table covering six real skills (suite members, single-purpose standalone, multi-purpose standalone, topically-named).
- **`references/skill-authoring.md` §5 — three new anti-pattern table rows.** (1) Fabricated Domain prefix (inventing a brand-like word for the slot — `WebClone —` when no product called WebClone exists). (2) Same Domain across siblings with different scopes (forcing a multi-purpose skill to share a narrower sibling's Domain). (3) Casing mismatch between Domain and skill name (CamelCase Domain on a kebab-case skill family).

### Changed
- **`references/skill-authoring.md` §5 — Domain row in the five-slot grammar table** marked optional and reworded. Previously framed as "namespace prefix" with "product or suite name" as the only valid content. Now framed as "scope declaration" with two valid content forms — a real product/suite name (CamelCase brand) OR a real topical category (kebab-case) — and explicit conditions for skipping the slot.
- **`references/skill-authoring.md` §5 — composition recipe step 1.** Replaced "Write the suite/product name. Mechanical." with a decision rule that distinguishes suite member, polysemous-verb standalone, anchoring verb-object, multi-purpose, and topically-named cases. Points at the new subsection for the full decision logic.
- **`references/skill-authoring.md` §5 — "Common mistakes" entry on missing namespace prefix** now conditional: only a mistake when the verb is polysemous AND the verb-object phrase doesn't already anchor the topic. If the verb-object phrase anchors (`Map a website`, `Render a video`), skipping the Domain is correct, not a mistake.
- **`references/suite-pattern.md` §3 — Domain row and §3.1 composition step 1 mirrored** to acknowledge the broader-scope-satellite edge case. Both link to the canonical treatment in `skill-authoring.md`. Suite-pattern stays consistent with the authoring spec.

### Rationale
A session-learning experience exposed that the framework treated the Domain slot as mandatory ("Write the suite/product name. Mechanical."), without acknowledging it has two functions, can be a kebab-case topical anchor, and may correctly be dropped on multi-purpose or topical-named skills. The author fabricated `WebClone —` on a paired skill suite because the spec said the slot was mechanical and required. The five-row decision rule, the per-skill calibration principle, and the three new anti-patterns close the gap — a new author following the spec today will not make the same mistake.

## [0.5.0] - 2026-05-12

### Added
- **Drift handling in Section 3 (Skill Update Workflow) pre-flight.** Step 2's divergence check now has a `drift` branch: BLOCK edits, narrate the state in plain English ("The skill on disk doesn't match what was installed — lock says version X, the on-disk `skill.json` says Y"), and route to `happyskills-sync` Section 2.5 (Drift Repair). Modifying a drifted skill bakes more changes onto an already-broken baseline and makes eventual repair harder.
- New constraint: **NEVER edit a skill whose status is `drift`** — route to sync's repair workflow first.

### Rationale
The CLI (`happyskills@0.44.0`) introduced lock-vs-disk drift detection. If a user asks to update a drifted skill's content, the design skill would otherwise proceed and pile new edits onto an inconsistent baseline — the eventual `publish` would either fail (because Section 3 step 2 in publish now blocks drift) or, worse, succeed at a structurally broken state and create a confusing release. This release closes the prevention path on the design surface.

## [0.4.0] - 2026-05-11

### Added
- **`references/skill-authoring.md` §9 Best Practice #14 — "Translate tool output for the user, don't transcribe it."** New authoring rule: skills that wrap a CLI command and surface its JSON output must prescribe the user-facing phrasing, not just the agent behavior. Every status value, response key, or aggregate field the agent will present to the user needs an explicit plain-English opening sentence the agent should use verbatim. Without this, under uncertainty an LLM agent defaults to enumerating the JSON's vocabulary — producing a wall of jargon. The fix is structural: add a "Plain-English meaning (use as your opening sentence)" column to every status-value table, and frame the section with an explicit "lead with the plain-English meaning" rule. References `happyskills-sync` SKILL.md Section 2 as the reference implementation. Applies to **every** skill that interprets command output for a user — `validate`, `status`, `check`, `pull`, `diff`, `publish`, anything that returns a status field or result code.
- **`references/skill-authoring.md` §10 Anti-Patterns** — new row matching #14: "Skill describes CLI status values or result codes without prescribing the plain-English opening sentence the agent should use."

### Rationale
Generalizes the framework lesson from the `happyskills-sync` v0.3.0 / `happyskills-publish` v0.2.0 release. The pattern of "skills prescribe *what to do* but not *how to narrate the result*" is suite-agnostic — any skill that wraps a CLI command is exposed to it. Promoting it from a per-skill fix to an authoring-level Best Practice prevents the same gap from recurring in future skills.

## [0.3.0] - 2026-05-11

### Added
- **`references/suite-pattern.md` §2.4 — The Canonical-Command Escape Hatch.** A scoped softening of the load-bearing orthogonality rule: when two suite members would both attract the same user question, both may route to the same canonical CLI command. Same question → same command from multiple skills is safe; same question → different commands is not. Includes when-to-apply table, worked example (the `check` registry-update query), and explicit "what this is not" guardrails.
- **`references/suite-pattern.md` §5 — Three-layer Orthogonality Test.** Extended the test to walk three layers of the orthogonality surface: L1 front matter (description), L2 Section 1 routing tables, L3 command names + output vocabulary (status values, response keys, aggregate field names). L1 cleanliness is necessary but not sufficient — sub-verb collisions hide at L2/L3.
- **`references/suite-pattern.md` §6 — The Limits of Static Validation.** Documents the distinction between *literal* collisions (keyword-checkable) and *semantic* collisions (same meaning, different words — hard to catch statically). Recommends a Confirm-Intent preamble as an optional runtime safety net for high-risk members.
- **`references/suite-pattern.md` §7 — three new anti-pattern rows.** (1) Two commands emitting the same status value for related-but-different states. (2) L1-clean descriptions that still collide at L2/L3. (3) Two members routing the same user question to different commands (the escape hatch does NOT cover this case).
- **`references/suite-pattern.md` §8 — Case Study: The `check`/`status` Collision.** Full retrospective of the first production failure: the symptoms, the three-layer root-cause walkthrough, the asymmetric fix, and the five framework lessons that drove §§2.4, 5, 6, and the new §7 anti-pattern rows.

### Changed
- **`references/skill-authoring.md` §5** — "Why the Negative slot is effectively required in a suite" subsection now cross-references the new §2.4 (escape hatch), §5 (three-layer test), §6 (static-validation limits), and §8 (case study) in suite-pattern.md, in addition to the existing §2 reference.

### Rationale
First production failure of the HappySkills suite (agent routed "which skills are out of date?" to sync's `status` instead of core's `check`) revealed the Suite Pattern framework was auditing front-matter only — collisions at routing-table and output-vocabulary layers slipped through. These refinements close those gaps and document the escape hatch we adopted as a scoped exception to the load-bearing rule.

## [0.2.1] - 2026-05-07

### Changed
- `references/workflows.md` Kit Creation Workflow Step 2 — search example expanded to mention all three query forms supported by the new search dispatcher (API v2.9.0 / CLI v0.43.0): natural language for broad discovery, a single slug for typo-tolerant exact-name checks (e.g. `deploy-aws`), and `workspace/skill` form to scope to a specific workspace with typo tolerance on both halves (e.g. `acme/deploy-aws`). Documentation polish; behavior unchanged.

## [0.2.0] - 2026-05-04

### Added
- `references/suite-pattern.md` — new operational reference for the **Suite Pattern**, the canonical answer to the mega-skill problem. Covers the load-bearing orthogonal verb ownership rule, the five failure modes when orthogonality is violated, the five-slot description grammar, when to apply the pattern, the pre-publish orthogonality test, and suite-level anti-patterns. Links to `docs/cli-skill.md` for the citation-grade reference.
- New **Suite Decomposition Workflow** in `references/workflows.md` — eight phases, twenty-three numbered steps. Confirms mega-skill symptoms, maps the verb space into clusters, proposes the core + satellites split, drafts five-slot descriptions, runs the orthogonality test, generates files via `npx happyskills init`, validates each member, and coordinates release (satellites first, then the core).
- New Section 5 in `SKILL.md` — Suite Decomposition Workflow phase summary with key constraints and pointers to `references/suite-pattern.md` and `references/workflows.md`. Other sections renumbered (Authentication → 7, Validate Error Handling → 8, Constraints → 9).
- New routing triggers in `SKILL.md` Section 1 — "decompose this mega-skill", "split this skill", "build a skill suite", "this skill is doing too much", "my description is too long", "apply the suite pattern", "extract satellites", "refactor this into a suite", "fix the soft-cap warning".
- Audit Workflow (Section 4) extended with proactive mega-skill detection — flags description > 250 chars, primary verb count ≥ 4, triggers spanning unrelated domains, or routing tables with ≥ 5 verb clusters. Offers to run the Suite Decomposition Workflow via AskUserQuestion when symptoms are present.
- Audit Workflow gained a five-slot grammar check (Domain / Verb(s) / Object / Triggers / Negative) and a cross-skill orthogonality check that runs `npx happyskills list --json` to find siblings under the same namespace and identifies `<verb, object>` overlaps.

### Changed
- `references/skill-authoring.md` Section 5 ("Writing Effective Descriptions") rewritten to lead with the **five-slot grammar** as the canonical description format. Object is now a first-class slot alongside Domain, Verb(s), Triggers, and Negative — previously buried inside the verb-led clause. Added a step-by-step composition recipe (slot order: Domain → Verb → Object → Triggers → Negative) and a bad-vs-good worked example to make the format pattern-matchable for skill authors.
- `references/skill-authoring.md` Mega-Skill Problem section restructured to lead with the **Suite Pattern** as the canonical resolution strategy. Strategy 2 is now explicitly named "Suite Pattern" with a pointer to `references/suite-pattern.md` and the Suite Decomposition Workflow. The "When to recommend each strategy" table now flags Suite Pattern as the answer for any skill above 250 chars or naming ≥ 4 distinct primary verbs.
- Section 1 routing block in `SKILL.md` now links to `references/suite-pattern.md` as the canonical reference for orthogonal verb ownership and mega-skill decomposition.
- Section 8 (Validate Error Handling) now recommends the Suite Pattern over compression for descriptions above the 250-char soft cap, with a pointer to the new reference.

## [0.1.1] - 2026-05-03

### Added
- `references/cli-reference.md` — documents `init` syntax (skill and `--kit`), JSON response shape, result formatting, and common errors. Closes a documentation gap relative to v1.30.0 where `init`'s shape was the only command lacking new-family coverage.

### Changed
- Section 2 step 3 (Authoring Workflow) now links to `references/cli-reference.md` for full init details.

### Fixed
- Constraints now include "NEVER fabricate CLI flags or subcommands" and "ALWAYS run `npx happyskills` from the project root" — both were missing relative to the v1.30.0 mega-skill.
- Constraints now echo "NEVER run `npx happyskills login --password`" — credentials-leakage prohibition is now consistent across the whole family.
- Section 6 (Authentication) expanded with the headless-environment fallback message and the `already_logged_in` vs `logged_in` status detail — now consistent with the rest of the family.

## [0.1.0] - 2026-05-03

### Added
- Initial release of the HappySkills design skill.
- Owns greenfield skill design (Authoring Workflow), skill review/audit (Audit Workflow), session-learning-driven updates (Update Workflow), and guided kit creation (Kit Creation Workflow).
- `references/skill-authoring.md` — Claude Code skill spec: frontmatter, invocation models, description formula, forbidden characters, advanced patterns, best practices, anti-patterns, design patterns, the Mega-Skill Problem and decomposition strategies. Lifted from the original `happyskills` skill v1.30.0.
- `references/happyskills-conventions.md` — HappySkills superset: skill.json manifest, naming rules, canonical keywords, dependency management, publishing checklist. Lifted from v1.30.0.
- `references/workflows.md` — full procedures for Authoring, Update, Audit, and Kit Creation workflows. Lifted from v1.30.0.
- Audit workflow numerics updated from 850→250 chars (new spec soft cap from spec 260501-mega-skill-refactor).
- Created as part of the mega-skill refactor — the original 57-intent `happyskills` skill was split into 5 default skills + 1 opt-in. Design owns the "shape a skill" layer (creation, quality, improvement); publish owns the "ship a skill" layer (versioning, publishing, registry management).
