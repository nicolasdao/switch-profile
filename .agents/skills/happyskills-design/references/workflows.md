# happyskills-design — Workflows

Full step-by-step procedures for design-related workflows. SKILL.md has the quick steps and routing; this file has the complete procedures with all guardrails.

## Common Procedures

### Invocation Model Confirmation

When confirming the user's invocation preference, present these two options via AskUserQuestion:

- **"Auto-invoke (Recommended)"** — Claude automatically invokes the skill when relevant. Best for most skills.
- **"User-only (/slash command)"** — Only the user can trigger via `/skill-name`. Claude won't know the skill exists. Recommended only for destructive operations like deployments, releases, or deletes.

**Default to auto-invoke.** Action depends on state:
- **New skill** (Post-Init): Do NOT add the `disable-model-invocation` flag. NEVER set it without asking.

### First-Time Publish Routing

When an enrichment workflow needs to publish, do NOT run publish yourself — route to `happyskills-publish`. Tell the user: "The skill is ready to publish. Say 'publish my-skill' and the publish skill will handle the workflow including pre-flight checks."

The publish skill owns the First-Time Publish procedure (auth + workspace resolution + visibility prompt + publish command). Don't duplicate it here.

---

## Post-Init Enrichment

After the Authoring Workflow (SKILL.md Section 2, steps 1–9) completes, the skill has a well-designed SKILL.md but its `skill.json` has only the scaffold fields (`name`, `version`, empty `description`, `type`, empty `dependencies`). Run this enrichment to complete the HappySkills ecosystem metadata and make the skill publish-ready.

> **Do NOT add a `keywords` field.** `keywords` is a deprecated, platform-ignored `skill.json` field — HappySkills derives all discovery labels server-side from the skill's `description` + `SKILL.md` content (the platform-owned taxonomy), so an author-supplied keyword list has zero effect on search, ranking, or filtering. Never populate `keywords` during enrichment (or authoring, conversion, fork, or update). If a scaffold or existing manifest already contains a `keywords` array, leave it untouched — do not fill it. See [happyskills-conventions.md § 3](happyskills-conventions.md).

1. **Read the SKILL.md** — Understand what the skill does, its domain, and target audience.
2. **MANDATORY — Verify SKILL.md frontmatter has `name` and `description`** — The Authoring Workflow (step 6) should have set these, but verify they are present and non-empty. If the `description` is still the placeholder ("Describe what this skill does and when to invoke it"), replace it with a proper description following the canonical format from spec 260501-mega-skill-refactor: `<Namespace> — <verb-led action>. Use when <specific trigger context>. Not for <where to redirect>.` Target 80-180 chars (250 soft cap, 1024 hard cap). Use em-dash, not colon, for the namespace separator. Use only safe characters (no semicolons, colons, hashes, quotes, brackets per current validator). See [skill-authoring.md § 5](skill-authoring.md) for the full description format guide. Ask the user to confirm. NON-NEGOTIABLE — the CLI will warn on publish if description is missing.
3. **Write skill.json `description`** — A concise summary (under 200 chars) optimized for registry search. This is different from the SKILL.md `description` which targets Claude auto-invocation.
4. **Detect system dependencies (MANDATORY scan + Confidence Gate)** —

   **a. Discover.** Apply the **detection procedure** from [happyskills-conventions.md § 4](happyskills-conventions.md): scan SKILL.md and every file under `scripts/` for command invocations, extract the unique binaries called, subtract the POSIX baseline, and declare **every remaining binary** in `systemDependencies` — including ubiquitous tools like `git`, `node`, `npm`, `npx`, `python`, `python3`, `pip`, `curl`, and `jq`. **Do NOT skip a tool because "it's always installed"** — the skill's host may be a Docker container, CI runner, or sandbox.

   **b. Verify per platform (Confidence Gate).** For every `(tool, platform)` pair across `darwin`, `linux`, and `win32`, apply the **Confidence Gate** in [happyskills-conventions.md § 4](happyskills-conventions.md). For any pair where you are not certain from training — niche tools, vendor-specific CLIs, recent releases, or anything where you would "probably guess" the package name or `winget` ID — run a `WebSearch` for the official install instructions **before** writing the command. If `WebSearch` is unavailable or the official docs are ambiguous, fall back to `"See <official-docs-url> for install instructions"`. **Never** write a plausible-sounding command from memory; **never** extrapolate one verified platform's command to the other two.

   **c. Report verified-vs-deferred to the user.** After populating `systemDependencies`, present a short summary listing:
   - Each `(tool, platform)` pair resolved from training-level confidence (no lookup needed).
   - Each `(tool, platform)` pair resolved via `WebSearch`, with the source URL cited.
   - Each `(tool, platform)` pair where you fell back to an official-docs pointer (with the URL).
   - Each `(tool, platform)` pair marked `"Not supported on <platform>"`, with a one-line reason.

   This lets the user see at a glance what was verified vs. what was deferred, and catch any pair where the agent's self-assessment was over-confident.
5. **Detect skill dependencies** — If the SKILL.md references other published HappySkills skills, suggest adding them to `dependencies`.
6. **Attribution Prompt (MANDATORY — three separate AskUserQuestion calls, in order)** — Authors, license, and repository are populated via **three separate AskUserQuestion calls in this exact order**. NEVER pick defaults on the user's behalf. NEVER skip a field. NEVER assume MIT. Silently defaulting is a workflow failure, not a shortcut.

   **6a. `authors`** — AskUserQuestion: ask if the user wants to add authors. Suggest the format `"Jane Doe <jane@acme.com>"`.

   **6b. `license`** — AskUserQuestion with these exact four options, in this exact order. Do NOT improvise, reorder, drop, or substitute options, and do NOT tag any option "Recommended" — order is not endorsement (per the no-default constraint, you never pick a license for the user). Do NOT add a free-text "Other" / "Type something" option yourself — AskUserQuestion injects one automatically, and it is NOT a substitute for "Show me more".
   1. **"MIT"** — "Permissive and most common. Do anything, just keep the license text."
   2. **"Apache-2.0"** — "Permissive with an explicit patent grant. Common for company-backed projects."
   3. **"UNLICENSED"** — "Proprietary — all rights reserved, not open source. Keep the skill private and closed."
   4. **"Show me more"** — "See all other licenses (BSD-3-Clause, GPL, MPL, CC0, etc.)."

   "Show me more" is the discovery path for users who don't already know the SPDX identifier they want — it is distinct from the auto-injected "Other" free-text option and must never be dropped in favor of it.

   If the user selects **"Show me more"**, present the SPDX reference table (Permissive: MIT, ISC, BSD-2/3-Clause, Apache-2.0; Copyleft: GPL-3.0-only, LGPL-3.0-only, MPL-2.0, AGPL-3.0-only; Public Domain: CC0-1.0, 0BSD; Proprietary: UNLICENSED), then a second AskUserQuestion with BSD-3-Clause, GPL-3.0-only, MPL-2.0, CC0-1.0.

   **After license selection, generate a LICENSE file** in the skill directory with the standard text for the chosen SPDX identifier. Use the current year and the `authors` value (or ask via AskUserQuestion for a copyright holder name if no authors were set). Write as `LICENSE` (no extension).

   **6c. `repository`** — Run `git remote get-url origin 2>/dev/null` to detect the current git remote URL. If found, AskUserQuestion: "Yes, use <detected-url>" / "No, skip" (Other available for a different URL). If not found: AskUserQuestion: "Enter a URL" / "Skip".
7. **Confirm invocation model** — Check whether the SKILL.md has `disable-model-invocation: true`, or if you're about to set it. Run the **Invocation Model Confirmation** procedure. For new skills, the action is "do not add the flag."
8. **Initialize CHANGELOG.md** — If none exists, create one with the initial version entry.
9. **Check for embedded executable code** — Scan SKILL.md and any files in `references/` for code blocks containing executable logic intended to be run as part of the skill's workflow (not documentation examples). All executable code MUST be in `scripts/` as actual files. If executable code is found embedded in markdown, extract it into `scripts/` and replace the code block with a reference: `${CLAUDE_SKILL_DIR}/scripts/<filename>`. Use AskUserQuestion to confirm the extraction.
10. **Run validation (MANDATORY)** — Run `npx happyskills validate <skill-name> --json`. If `data.valid` is `false`, fix all errors per Section 7 of SKILL.md. Present warnings to the user. Final quality gate — do NOT skip.
11. **Optional publish** — Use AskUserQuestion: "Would you like to publish this skill now, or test it first?" If publish, route to `happyskills-publish` ("say 'publish <skill-name>'"). If test first, tell the user they can publish later via the publish skill. The skill at this point is a **draft** in HappySkills terms (per `happyskills@0.51.0+`: it lives under `data.drafts[]` in `npx happyskills list --all-scopes --json`). The publish skill ships drafts via the atomic `release` primitive in a single step — no `convert` detour, no "external skill" / "claim workspace" language to the user. If the user asks "why does it say external" in any tool output they look at, the answer is "it doesn't anymore — drafts are a separate category from external skills; only skills you hand-rolled outside the tool show up as external."

---

## Skill Update Workflow

When the user wants to update an existing skill based on session learnings, new requirements, or feedback. This workflow ensures the update is done in one cohesive pass — merging intent, context, and best practices.

**When to enter this workflow:** The user says things like "update this skill", "improve this skill based on what we just did", "apply what we learned to the skill", "the skill should handle X now", "refine this skill", "enhance this skill", or references updating a specific skill's content.

**Key distinction:** This workflow is for updating skill **content** (SKILL.md body, references, frontmatter, skill.json metadata). It is NOT for CLI package operations like `happyskills update` (which downloads newer versions from the registry — owned by core). If the user says "update acme/deploy-aws", disambiguate.

### Phase 1 — Pre-flight

1. **Identify the target skill** — Determine which skill to update. If the user says "this skill" or "the skill we just used", identify it from the session context. If ambiguous, use AskUserQuestion to clarify.

2. **Divergence check** — Run `npx happyskills status <skill> --json` to check the skill's state. Act based on the result:

   | Status | Action |
   |---|---|
   | `clean`, `modified`, or `ahead` | Safe to proceed. (`ahead` = you bumped `skill.json` locally and haven't published — the normal authoring state, not an error.) |
   | `outdated` | Route to `happyskills-sync` ("say 'pull <skill>'") before making changes. |
   | `diverged` | Route to sync to merge. Resolve conflicts if any. Then return. |
   | `conflicts` | Unresolved conflicts from a prior pull. Route to sync to resolve. |
   | `drift` | **BLOCK.** Lock and on-disk `skill.json` disagree — the baseline is incoherent. Route to `happyskills-sync` Section 2.5 (Drift Repair). Do not edit on a broken baseline. |
   | `not_found` | No lock entry — the skill is a **draft** (scaffolded by `init`, never published). `status` reads only the lock file, so it returns `not_found`; there is no remote baseline to diverge from. Safe to proceed. |

   **Why this matters:** Skipping the divergence check risks making changes on a stale base. When you later try to publish, the server rejects with DIVERGED, forcing a pull + merge that may conflict with your freshly-written content.

3. **Read current skill state** — Read the skill's SKILL.md, skill.json, CHANGELOG.md, and scan the directory structure (Glob for `references/`, `scripts/`, etc.). Understand the current architecture before changing anything.

### Phase 2 — Analysis

4. **Understand the update requirement** — Gather the full picture:
   - **Session context** — What did the user do in this session? What problems were encountered? What worked well? What did the skill fail to handle?
   - **Explicit request** — What exactly is the user asking to change?
   - **Observed gaps** — Based on the session, are there missing trigger phrases, missing workflows, incorrect instructions, or structural issues?

   If the requirement is unclear, use AskUserQuestion to prioritize: "I see several possible improvements. Which should I focus on?"

5. **Load best practices** — Read [skill-authoring.md](skill-authoring.md) and [happyskills-conventions.md](happyskills-conventions.md) to ensure changes comply with all conventions.

### Phase 3 — Implementation

6. **Design the changes** — Before writing any files, plan what changes are needed:
   - Does the **description** need new trigger phrases? Use the formula. If the description is heading above 250 chars (new spec soft cap), consider mega-skill decomposition rather than just adding more keywords.
   - Does the **routing table** need new entries? (If the skill has a routing section)
   - Does the **SKILL.md body** need new sections, updated instructions, or restructured content?
   - Do **reference files** need to be created, updated, or reorganized?
   - Does **skill.json** metadata need updates (description, dependencies)?
   - Will the changes push SKILL.md over 500 lines? Extract content to references.

7. **Apply changes** — Use the Edit tool to modify files:
   - **Preserve existing structure** — Surgical changes are better than rewrites unless the user asked for a rewrite.
   - **Forbidden characters** — Scan all frontmatter values for `;`, `:`, `#`, `{`, `}`, `[`, `]`, `'`, `"`, `!`, `&`, `*`, `%`, `|`, `>`. Replace per spec patterns (em-dash `—` for namespace separator until validator update).
   - **Line limits** — SKILL.md ≤ 500 lines. Supporting files ≤ 400 lines (split by topic if larger).
   - **Supporting file organization** — New reference content goes in `references/`, new scripts in `scripts/`, new templates in `assets/` or `templates/`.
   - **Consistent cross-references** — If you add a new reference file, add a conditional link in SKILL.md ("Read X if Y").
   - **DRY** — If your changes introduce content that duplicates something already in another file, extract the common content to a single location and reference it. See [skill-authoring.md § Best Practices](skill-authoring.md).

### Phase 4 — Validation and Release

8. **Validate** — Run `npx happyskills validate <skill-name> --json`. If `data.valid` is `false`, fix all errors per Section 7 of SKILL.md. Present warnings to the user.

9. **Offer to release** — Use AskUserQuestion: "The skill has been updated. Would you like to release this update now, or continue working?"
   - **"Release now"** — Route to `happyskills-publish` ("say 'release my skill'"). Publish wraps the `release` primitive — an atomic snapshot + validate + bump + changelog + publish pipeline that recognizes the `ahead` state (already-bumped skill.json) and proceeds without re-bumping. On any failure it restores the snapshot and returns a structured `next_step` envelope. Do NOT run release yourself.
   - **"Continue working"** — Done. Remind the user they can release later via the publish skill.

---

## Skill Audit Workflow

When the user wants a quality review of an existing skill — checking for best practice compliance, structural issues, and content quality. Works on both HappySkills-managed skills and external (unconverted) skills.

**Key distinction:** An audit is a **read-only diagnostic** — it identifies issues and recommends fixes but does not modify files. If the user wants fixes applied, transition to the Skill Update Workflow after presenting the audit results.

### Phase 1 — Identify and Read

1. **Identify the target skill** — Determine which skill to audit. If ambiguous, use AskUserQuestion. Can be HappySkills-managed (has skill.json) or external/unconverted (only has SKILL.md).

2. **Read the full skill** — Read every file in the skill directory: SKILL.md, skill.json (if present), all files in `references/`, `scripts/`, `assets/`, and any other directories. Build a complete picture.

3. **Load best practices** — Read [skill-authoring.md](skill-authoring.md) and [happyskills-conventions.md](happyskills-conventions.md).

### Phase 2 — Automated Checks

4. **Run validate** (if HappySkills-managed) — Run `npx happyskills validate <skill-name> --json`. Record all errors and warnings.

### Phase 3 — Manual Quality Review

For each area, note the file, location, and specific recommendation.

5. **Description quality** — Is the SKILL.md `description` keyword-rich, following the new spec format `<Namespace> — <verb-led action>. Use when <specific trigger context>. Not for <where to redirect>.`? Does it cover multiple phrasing families (imperative, question, past tense)? Are there forbidden characters per the current validator? Is it under 1024 chars (hard cap)? **If above 250 chars (new spec soft cap), check for mega-skill symptoms** (keyword density, synonym redundancy, coverage gaps) and recommend a strategy (compress, decompose, or hybrid). For the full guide, see [skill-authoring.md § The Mega-Skill Problem](skill-authoring.md).

6. **Frontmatter completeness** — Are `name` and `description` present? Is `allowed-tools` set appropriately? Is `disable-model-invocation` set correctly for the skill's purpose?

7. **Content structure** — Is SKILL.md under 500 lines? Are supporting files under 400 lines each? Is content organized into `references/`, `scripts/`, `assets/` appropriately? Are there files dumped at root that should be in subdirectories? If the skill splits gotchas into `references/gotchas/<domain>.md`, verify the `## Gotchas` index in SKILL.md links every domain file and every link resolves (hub↔domain sync — an unlinked gotcha file is invisible to the agent).

8. **DRY compliance** — Scan all files for content that appears in more than one file or more than once within the same file. For each duplication found, classify it before flagging:

   **Must deduplicate** (report as warning):
   - Identical tables, procedures, or rule blocks copy-pasted across files with no contextual differences
   - Content that has already drifted between copies (a sign that sync is failing)

   **Acceptable co-location** (do NOT flag):
   - Agent prompt templates embedded in the workflow step that spawns them — these must be immediately available in the execution context, not behind a reference hop
   - Short contextual reminders (1-2 lines) restating a critical safety constraint in a workflow step
   - Content in SKILL.md that overlaps with a reference file but is tuned for the executing LLM (SKILL.md serves the agent at runtime, reference files serve human readers or on-demand loading — these are different audiences)
   - Any overlap where SKILL.md is under the 500-line limit and deduplicating would force the agent to read across multiple files mid-workflow

   **Guiding principle:** DRY is a means to maintainability, not an end in itself. When deduplicating would degrade execution reliability (by adding indirection hops the agent may fail to follow), the duplication is the better trade-off.

9. **Anti-pattern scan** — Check against the full anti-pattern list in [skill-authoring.md](skill-authoring.md): vague description, oversized files, missing constraints section, missing gotchas section (on a knowledge- or domain-heavy skill), missing verification steps, executable code in markdown, restating obvious default behavior, deeply nested references, etc.

10. **skill.json completeness** (if HappySkills-managed) — Are `description`, `dependencies`, and `systemDependencies` set correctly? The skill.json `description` (registry search) and the SKILL.md `description` (agent auto-invocation) serve different purposes and **can differ** — do not check one against the other, and never report a difference between them as a defect.

11. **Config-drift check** (if the skill declares `config`/`env`) — Cross-check the declared schema against how the skill actually reads its configuration. There is no `happyskills audit` CLI command, so run this as a text scan yourself. Flag two mismatches as **warnings** (heuristic, non-blocking):
    - **Declared-but-unused** — a `config` field or `env` variable named in `skill.json` that never appears anywhere in `SKILL.md` or `references/`. Either the skill forgot to read it, or the declaration is stale.
    - **Used-but-undeclared** — a plausible config/env token the skill reads (an `UPPER_SNAKE_CASE` env name, or a `skills-config get` config key) that is **not** declared in the `config`/`env` schema. Undeclared config never gets prompted or scaffolded on install.

    Also confirm the SKILL.md embeds the canonical "resolve configuration before using any default" snippet (see [skill-authoring.md § Configuration](skill-authoring.md)) — a configurable skill that hard-codes defaults without reading `skills-config.json` is a drift risk.

### Phase 4 — Report and Offer Fixes

12. **Present the audit report** — Summarize findings grouped by severity:
    - **Errors** — Issues that break functionality (missing description, forbidden characters, oversized files)
    - **Warnings** — Issues that degrade quality (vague description, DRY violations, missing constraints, mega-skill symptoms)
    - **Suggestions** — Improvements that would strengthen the skill (better trigger phrases, file reorganization)

    For each issue, provide the specific file, the problem, and the recommended fix.

13. **Offer to fix** — Use AskUserQuestion: "Would you like me to fix these issues now?"
    - **"Yes, fix all"** — Transition to the Skill Update Workflow to apply all fixes.
    - **"Fix errors only"** — Apply only error-level fixes via the Update Workflow.
    - **"No, just the report"** — Done. The user can act on the report manually or later.

---

## Constellation Decomposition Workflow

When a skill has grown into a **mega-skill** — its description can no longer reliably route every capability it owns — apply this workflow to decompose it into a **constellation**: a slim core skill plus focused satellite skills bundled via the core's `skill.json` dependencies. This is the canonical answer for any skill whose description exceeds the 250-char soft cap, names ≥ 4 distinct primary verbs, or whose triggers span unrelated intent domains.

**When to enter this workflow:** the user says things like "decompose this mega-skill", "split this skill", "build a skill constellation", "this skill is doing too much"; OR an Audit (Section 4) detected mega-skill symptoms and the user accepted the offer to fix; OR the validator soft-cap warning fired and the user asks for help fixing it.

**Read first:** [constellation-pattern.md](constellation-pattern.md) — the operational reference for the Constellation Pattern, including the load-bearing orthogonality rule, the five-slot description grammar, and the orthogonality test. The workflow below executes the procedure; that file explains the rules the procedure enforces.

**Key distinction:** decomposition is a **refactor**, not an enhancement. The user's existing skill is split into multiple skills with the same total capability. Capabilities are not added or removed — they are redistributed.

### Phase 1 — Confirm the Symptom

1. **Read the target skill in full** — SKILL.md, skill.json, all files in `references/`, `scripts/`, `assets/`. Build a complete picture of what the skill currently does.

2. **Confirm at least one mega-skill symptom is present:**
   - Description > 250 chars (validator soft-cap warning), OR
   - Description names ≥ 4 distinct primary verbs, OR
   - `Use when` triggers span unrelated user-intent domains (e.g., publishing AND inviting AND designing — three different products in one skill), OR
   - User reports the skill failing to fire on capabilities it supports, OR
   - User explicitly asks for decomposition.

   If no symptom is present, **do not decompose**. A focused single skill is the right shape — route the user back to the Update Workflow if they want enhancements, or close out if no change is needed.

3. **Pre-flight divergence check** — Run `npx happyskills status <skill> --json`. If `outdated` or `diverged`, route to `happyskills-sync` to pull and resolve before refactoring. Decomposition will create new skills and modify the existing one — doing this on a stale base risks unrecoverable conflicts.

### Phase 2 — Map the Verb Space

4. **List every capability the skill currently exposes.** Read the SKILL.md routing table (or capability list, or workflow sections) and extract every distinct user intent. Each row should be: trigger phrase + verb + object + brief description of what happens.

5. **Cluster the capabilities by user-intent domain.** Group rows that share a coherent user purpose. Typical clustering axes:
   - **Lifecycle** (install, list, update, uninstall, configure) — usually the highest-frequency cluster, becomes the core.
   - **Authoring** (design, scaffold, audit, refine) — content creation.
   - **Distribution** (publish, release, fork, convert, validate) — shipping artifacts.
   - **Synchronization** (status, pull, diff, merge) — keeping local and remote aligned.
   - **Discovery** (search, recommend, ask, explain) — finding things and learning.
   - **Collaboration** (invite, permissions, groups, access) — working with others.

   Aim for clusters of 3–8 verbs each. A cluster of 1–2 verbs may belong inside another cluster; a cluster of 10+ verbs probably needs to be split further. Use AskUserQuestion to confirm the proposed clustering with the user before continuing — the user owns the product story.

### Phase 3 — Propose the Constellation

6. **Designate the core.** The core skill owns the cluster every user touches every day — usually lifecycle. The core should be slim (target SKILL.md ~ 200 lines) and act as the entry point. Naming: same name as the original skill (e.g., `happyskills`).

7. **Designate satellites.** Each remaining cluster becomes one satellite skill. Naming convention: `<core-name>-<cluster-domain>` (e.g., `happyskills-publish`, `happyskills-design`, `happyskills-sync`). Keep names short and verb-cluster-aligned, not feature-aligned.

8. **Decide bundled vs opt-in for each satellite — and default hard to bundled.** A satellite is **bundled** when it is declared as a hard dependency in core's `skill.json` and installs with it. An **opt-in** satellite is left out of core's deps and surfaced by a discovery skill that offers to install it on demand.

   Opt-in buys you description-budget savings and costs you a roster that has to be maintained by hand in every skill that mentions it. HappySkills ran an opt-in tier across three satellites and retired it: the roster lived in three places, two had silently drifted (one satellite was missing from a roster entirely for its whole life), and the flow ended in an agent restart, so using an opt-in capability took four turns instead of one. Choose opt-in only when the satellite is genuinely large, genuinely rare, and you accept that maintenance cost. Use AskUserQuestion to confirm.

9. **Identify the discovery skill and (optionally) the concierge.** These are two related but distinct roles — a constellation may combine them in one skill or split them:
   - **Discovery skill** — owns marketplace search and version/changelog lookup, and (only if your constellation keeps an opt-in tier) "install-on-recommendation" for those satellites. If your constellation has any opt-in satellites, you need a discovery skill — bundle it.
   - **Concierge** (optional) — owns "explain the constellation", "which skill handles X?", and other Q&A. If your constellation is large enough that explaining it deserves its own skill, split the concierge from the discovery skill; otherwise let the discovery skill carry the explain/route role too. In HappySkills the concierge is `happyskills-help` (split from discovery in `happyskills-search@0.1.0` / `happyskills-help@0.4.0`).

### Phase 4 — Draft Five-Slot Descriptions

10. **For each constellation member, draft a description using the five-slot grammar** from [constellation-pattern.md § 3](constellation-pattern.md):

    ```
    <Domain> — <Verb(s)> <Object>. Use when <Triggers>. Not for <Negative>.
    ```

    Compose in slot order — Domain (mechanical) → Verb(s) (the cluster's primary action) → Object (concrete, specific) → Triggers (3–5 user-vocabulary phrases) → Negative (redirect to the closest sibling).

    Target 80–180 chars per description; never exceed 250. If a member's description cannot fit under 250 chars, the member is itself a mega-skill — decompose it further before continuing.

11. **For each member, populate the Negative slot with the closest sibling's territory.** Every member except the most peripheral has a near-neighbor. The Negative slot is what prevents routing collisions on overlapping prompts.

### Phase 5 — Run the Orthogonality Test

12. **Cross-compare descriptions for verb collisions** per [constellation-pattern.md § 5](constellation-pattern.md):

    a. Extract `<verb, object>` pairs from each member's Verb and Object slots, plus each concrete trigger in `Use when`.
    b. For each pair across two members, ask: would a user prompt for one plausibly match the other's description? If yes, you have an overlap.
    c. Resolve overlaps by: narrowing the object, adding `Not for` clauses to both members naming each other, or merging the two members.

13. **Sanity-check with prompts.** Write 5 prompts a user might say. For each, predict which member should fire. If prediction is not deterministic, the LLM cannot route deterministically either — return to step 12 and tighten.

14. **Worked example to follow** — see [constellation-pattern.md § 2.3](constellation-pattern.md) for the `update` verb owned by core (lifecycle) vs design (content), separated by object.

### Phase 6 — Generate Files

15. **Create satellite skill directories.** For each satellite, run `npx happyskills init <satellite-name> --json` from the project root. This creates `.claude/skills/<satellite-name>/` with skeleton SKILL.md, skill.json, CHANGELOG.md.

16. **Migrate content into satellites.** For each cluster:
    - Move the relevant routing rows from the original skill's SKILL.md into the satellite's SKILL.md.
    - Move the cluster's reference files from `<original>/references/` into `<satellite>/references/`. Update internal links.
    - Update the satellite's SKILL.md frontmatter `description` to the five-slot version drafted in step 10.
    - Add a Section 1 routing table in the satellite's SKILL.md with a "what NOT to handle here" subsection naming sibling skills and trigger phrases (the second layer of orthogonality enforcement per [constellation-pattern.md § 2.2](constellation-pattern.md)).

17. **Slim the core.** In the original skill's SKILL.md:
    - Remove every cluster's content that was migrated to satellites.
    - Update the description to the five-slot core version drafted in step 10.
    - Update the Section 1 routing table to point at satellites for verbs they now own (use the trigger phrase format: "Say 'publish my-skill' and the publish skill will handle it.").
    - Keep the lifecycle content the core owns.

18. **Wire the dependency-as-bundle.** In the core's `skill.json`, declare each **bundled** satellite as a hard dependency:

    ```json
    "dependencies": {
      "<owner>/<core-name>-publish": "^0.1.0",
      "<owner>/<core-name>-design": "^0.1.0",
      "<owner>/<core-name>-sync": "^0.1.0",
      "<owner>/<core-name>-help": "^0.1.0"
    }
    ```

    Do NOT declare opt-in satellites here. Opt-in satellites are surfaced through the concierge, not bundled. Use AskUserQuestion to confirm version ranges with the user — declare a **`>=` floor at the version you tested against** (e.g. `>=0.1.0`), never a caret. On a `0.x` version a caret is narrow (`^0.1.0` means `>=0.1.0 <0.2.0`), so it goes stale the moment a satellite ships its next minor and the whole constellation silently resolves to the superseded release.

18b. **Share secrets across the constellation (`sharedEnv`).** If the members share a secret — i.e. two or more declare the same `env` credential (the common case for a domain constellation) — add **`sharedEnv: true`** to the core's `skill.json`. Install then scaffolds ONE `./secrets/<core>.env` for every member instead of an identical secrets file each. Opt-in and core-only; never on a kit (a validation error). Skip it only when the members genuinely need isolated secrets. See [constellation-pattern.md § 1.1](constellation-pattern.md).

### Phase 7 — Validate Each Member

19. **Validate every constellation member.** For each member (core + satellites), run `npx happyskills validate <name> --json`. Fix all errors per Section 7 of `happyskills-design`'s SKILL.md. Present warnings.

20. **Re-run the orthogonality sanity check** — write 5 fresh user prompts and confirm each routes deterministically to the intended member. If any prompt is ambiguous, return to step 12.

### Phase 8 — Release Coordination

21. **Bump the original skill to a major version** (e.g., `1.x` → `2.0.0`). The decomposition is a breaking change — users on the old version must migrate. Document the migration in CHANGELOG.md `## [2.0.0] - <date>` under `### BREAKING CHANGES`, listing which capabilities moved to which satellite and how users should re-invoke them.

22. **Initialize each satellite at `0.1.0`** with an initial CHANGELOG.md entry naming the source skill it was extracted from.

23. **Offer to release** — Use AskUserQuestion: "The constellation decomposition is complete. Would you like to release all members now, or continue working?"
    - **"Release now"** — For each member (start with satellites, then core), route to `happyskills-publish` ("say 'release <name>'"). Satellites must be published before the core, because the core declares them as deps. Do NOT run release yourself.
    - **"Continue working"** — Done. Remind the user that all members must be released together, satellites first, before users can install the new constellation.

---

## Kit Creation Workflow

When the user wants to create a kit (a meta-package that bundles multiple skills as dependencies), run this guided workflow. This replaces the bare `init --kit` command with an intelligent, LLM-assisted experience.

**Step 1: List installed skills**

Run `npx happyskills list --all-scopes --json` (CLI `1.13.0+`) and parse the response — this includes candidate members installed **globally**, which are valid to bundle (a kit references members by `owner/name`, and a globally-installed member resolves the same way). In `--all-scopes` mode `data.skills` is an **array** and each entry carries `scope` + `native`. Extract candidate kit members from all buckets: `data.skills` (managed — already in the registry, can be referenced as deps directly), `data.drafts` (scaffolded by `init`, never published — eligible to be bundled but will need to be published first via `release` before the kit can install cleanly), and `data.external` + `data.agent_orphans` (genuinely foreign — same caveat: needs `convert` + publish before kit installation works). When the same `owner/name` appears in both scopes, list it once. Display a formatted numbered list showing: number, owner/name (or just `name` for drafts/external), version, scope (local/global), source label (managed / draft / external), and description. If no skills exist in any bucket, tell the user they need installed or scaffolded skills to create a kit and stop.

**Step 2: Search cloud registry (optional)**

After showing installed skills, ask the user: "Would you also like to search the HappySkills registry for additional skills to include?"

If yes:
1. Ask what kind of skills they're looking for (or infer from already-selected local skills).
2. Run `npx happyskills search "<query>" --json --limit 10`. Use natural language for broad discovery (e.g. `"deploy AWS Lambda"`); a single slug for exact-name checks (e.g. `deploy-aws` — typo-tolerant); or `workspace/skill` form to scope to a specific workspace (e.g. `acme/deploy-aws` — typo-tolerant on both halves).
3. Present top results as a numbered list with owner/name, description, version.
4. User picks by numbers/names (or "none").
5. Merge cloud picks into the selection pool (alongside local skills).
6. Ask "Search for more?" — repeat until done.

If no: proceed to the next step.

Cloud-selected skills don't need to be locally installed — they go directly into the kit's `dependencies` map. The version range uses the version from search results (e.g., `^major.minor.0`).

**Step 3: User selects skills for the kit**

Present the combined list (local + cloud-selected) and ask the user which skills they'd like to bundle into the kit. The user can respond with numbers, names, natural language descriptions ("the React and database ones"), or "all". Confirm the selection by listing the chosen skills back. Allow the user to add or remove from the selection before proceeding.

**Step 4: Inspect selected skills**

For each selected skill, read its `SKILL.md` and `skill.json` from the installed directory (`.claude/skills/<owner>/<name>/` or `.claude/skills/<name>/`). For cloud-selected skills not locally installed, use the metadata from search results. Extract: name, description (from both SKILL.md frontmatter and skill.json), tags, version. Build a summary of what each skill does.

**Step 5: Infer kit name and description**

Analyze the commonalities across selected skills (related domains, complementary purposes). Suggest a kit name starting with `_kit-` (lowercase-with-hyphens, descriptive of the collection). Draft a description that explains what the kit provides as a whole — not just listing the skills, but describing the capability the bundle enables. Ask the user for an optional brief via AskUserQuestion:
1. **"Use your suggestion"** — Go with the LLM-inferred name and description.
2. **"I have a brief"** — Provide context to guide the name and description.

If the user provides a brief, incorporate it and regenerate.

**Step 6: Choose version strategy**

Ask via AskUserQuestion how the kit should handle skill versions:
1. **"Pin to current versions (Recommended)"** — The kit installs the same versions you have today. You control when to upgrade. Stable and predictable.
2. **"Always use the latest"** — The kit always installs the newest version of each skill, even if they change significantly. Best if you want your kit to stay current automatically.

Explain the difference in friendly terms before asking.

Store the user's choice:
- **Pin** → use `^major.minor.0` ranges (based on the installed version from `happyskills list --all-scopes` — `data.skills` is an array there, match on `name`; for cloud-selected, use the search version)
- **Always latest** → use `*` for every dependency

**Step 7: Review and iterate**

Present the proposed kit to the user: name, description, skills included (with version ranges based on step 6).

Use AskUserQuestion:
1. **"Looks good"** — Proceed to creation.
2. **"Change the name"** — Let user provide a new name.
3. **"Refine the description"** — User gives feedback, LLM regenerates.
4. **"Change the skills"** — Go back to step 3.

Loop until "Looks good".

**Step 8: Create the kit**

Run `npx happyskills init <kit-name> --kit --json` to scaffold. The CLI auto-prepends `_kit-` if omitted. Read the generated `skill.json`. Update it with:
- `description`: the approved description
- `dependencies`: map of `owner/name` → version range per the strategy from step 6

Write the updated `skill.json` using Edit.

**Step 9: Write kit README.md**

Replace the scaffolded `README.md` (NOT `SKILL.md` — kits never ship a `SKILL.md`; the absence of one is what keeps them invisible to every agent runtime) with a proper kit description:
- Kit name as heading
- "This is a kit — a curated collection of skills installed together in one command."
- "What's Included" section listing each skill with a brief description
- "When to Use" section based on the inferred purpose
- Install command example

If a `SKILL.md` is somehow present in the kit directory (e.g. from a pre-`happyskills@0.52.0` scaffold), delete it before continuing — `validate` rejects kits that contain a `SKILL.md`.

**Step 10: Run Kit Enrichment (streamlined)**

Skip steps that don't apply to kits: frontmatter verification, invocation model, system dependencies, skill dependencies (already populated), executable code check. Run only:

1. **Attribution Prompt (MANDATORY — three separate AskUserQuestion calls, in order)** — Authors, license, and repository are populated via **three separate AskUserQuestion calls in this exact order**. NEVER pick defaults on the user's behalf. NEVER skip a field. NEVER assume MIT. Silently defaulting is a workflow failure, not a shortcut.

   **1a. `authors`** — AskUserQuestion: ask if the user wants to add authors. Suggest the format `"Jane Doe <jane@acme.com>"`.

   **1b. `license`** — AskUserQuestion with these exact four options, in this exact order. Do NOT improvise, reorder, drop, or substitute options, and do NOT tag any option "Recommended" — order is not endorsement (per the no-default constraint, you never pick a license for the user). Do NOT add a free-text "Other" / "Type something" option yourself — AskUserQuestion injects one automatically, and it is NOT a substitute for "Show me more".
   1. **"MIT"** — "Permissive and most common. Do anything, just keep the license text."
   2. **"Apache-2.0"** — "Permissive with an explicit patent grant. Common for company-backed projects."
   3. **"UNLICENSED"** — "Proprietary — all rights reserved, not open source. Keep the skill private and closed."
   4. **"Show me more"** — "See all other licenses (BSD-3-Clause, GPL, MPL, CC0, etc.)."

   "Show me more" is the discovery path for users who don't already know the SPDX identifier they want — it is distinct from the auto-injected "Other" free-text option and must never be dropped in favor of it.

   If the user selects **"Show me more"**, present the SPDX reference table (Permissive: MIT, ISC, BSD-2/3-Clause, Apache-2.0; Copyleft: GPL-3.0-only, LGPL-3.0-only, MPL-2.0, AGPL-3.0-only; Public Domain: CC0-1.0, 0BSD; Proprietary: UNLICENSED), then a second AskUserQuestion with BSD-3-Clause, GPL-3.0-only, MPL-2.0, CC0-1.0.

   **After license selection, generate a LICENSE file** in the kit directory with the standard text for the chosen SPDX identifier. Use the current year and the `authors` value (or ask via AskUserQuestion for a copyright holder name if no authors were set). Write as `LICENSE` (no extension).

   **1c. `repository`** — Run `git remote get-url origin 2>/dev/null` to detect the current git remote URL. If found, AskUserQuestion: "Yes, use <detected-url>" / "No, skip" (Other available for a different URL). If not found: AskUserQuestion: "Enter a URL" / "Skip".

2. **Initialize CHANGELOG.md** — Initial version entry.
3. **Run validation** — `npx happyskills validate <kit-name> --json`. Fix errors before proceeding.
4. **Optional publish** — Use AskUserQuestion. If publish, route to `happyskills-publish` ("say 'publish <kit-name>'"). Do NOT run publish yourself.

---

## Kit Update Workflow

When the user wants to change what an **existing** kit bundles — add a member skill, remove one, swap one out, or change a version range — run this guided workflow. A kit's content is its `dependencies` map, so this is a surgical `skill.json` edit, not a re-scaffold. (To create a brand-new kit, use the Kit Creation Workflow above instead.)

**Step 0: Disambiguate the request (MANDATORY)**

"Update my kit" is ambiguous across three owners. Before touching anything, confirm intent via AskUserQuestion if it is not already explicit:

1. **"Change what it bundles"** — add, remove, or swap member skills, or change version ranges. → This workflow.
2. **"Upgrade the installed kit"** — pull newer published versions of the kit and its members. → Lifecycle, owned by core. Route: "Say 'upgrade owner/_kit-X' and core will refresh it." Stop.
3. **"Publish the kit"** — ship the current kit to the registry. → Owned by `happyskills-publish`. Route: "Say 'publish owner/_kit-X'." Stop.

Only proceed past this step for meaning (1). Never assume meaning (1) without checking.

**Step 1: Identify the target kit**

Run `npx happyskills list --all-scopes --json` (CLI `1.13.0+`). A kit is the `_kit-`-prefixed entry (the prefix is enforced by the CLI); managed (`data.skills`, an **array** in `--all-scopes` mode) and draft (`data.drafts`) entries additionally carry `type: "kit"`. **Record which bucket and which `scope` the kit is in** — `data.skills` (managed, lock-tracked) vs `data.drafts` (created locally, never published) — Step 2 branches on the bucket. If the user named the kit, match it. If exactly one kit exists, use it. If the SAME kit appears in both `local` and `global` scope, edit the **local** copy unless the user explicitly says global (you mutate the kit in this project). If more than one *distinct* kit exists and the user was not specific, ask which one via AskUserQuestion — never guess.

**Step 2: Pre-flight divergence check (managed kits only)**

**Branch on the kit's bucket from Step 1:**
- Under **`data.drafts`** (created locally, never published — the default state straight out of the Kit Creation Workflow, since its publish step is optional) → no lock entry, no remote baseline, nothing to diverge from. **Skip this step and go to Step 3.** (Running `status` on it returns `not_found`, which is expected here, not an error — `status` reads only the lock file: `cli/src/commands/status.js`.)
- Under **`data.skills`** (managed, lock-tracked) → run the divergence check below.

For a managed kit, run `npx happyskills status <kit-name> --json` and route by status (same policy as the Skill Update Workflow):
- `outdated`, `diverged`, or `conflicts` → route to `happyskills-sync` to pull/resolve before editing. Editing on a stale or conflicted base risks a DIVERGED rejection at publish time.
- `drift` → **BLOCK editing.** Narrate in plain English and route to `happyskills-sync` Section 2.5 (Drift Repair). Do not proceed.
- `not_found` → no lock entry (treat as a draft) → skip and proceed to Step 3.
- `clean`, `modified`, or `ahead` → proceed.

**Step 3: Read the current kit state**

Read the kit's `skill.json` (the `dependencies` map is the source of truth) and `README.md`. Build the current member list with each member's version range. Determine the existing version strategy by inspecting the ranges (`^major.minor.0` = pinned; `*` = always-latest) so additions match it.

**Step 4: Gather the change set**

From the user's request, determine the exact mutations:
- **Add a member** — resolve its current version: if installed, read it from `npx happyskills list --all-scopes --json` (`data.skills` is an array — match on `name`; a globally-installed member counts); if from the registry, run `npx happyskills search "<owner/name>" --json --limit 10` (single-slug or `workspace/skill` form, typo-tolerant; **`--limit` is required** — `search` errors without it) and confirm the match with the user. Apply the kit's existing version strategy to form the range.
- **Remove a member** — confirm the exact `owner/name` key to drop.
- **Swap a member** — a remove + an add, presented together.
- **Change a range** — confirm the new range and that it is intentional (e.g. widening `^1.2.0` to `*`).

Confirm the full change set back to the user before writing anything.

**Step 5: Apply the edit (surgical)**

Use **Edit** (never a full rewrite) to modify only the affected entries in `skill.json` `dependencies`. Do not touch `name`, `type`, `version`, or unrelated members. Leave `version` for the publish flow to bump — design never bumps.

**Step 6: Sync the README**

Update the kit's `README.md` "What's Included" list to match the new dependency set — add the new member with a one-line description, drop removed ones. Kits ship `README.md`, never `SKILL.md`; if a stray `SKILL.md` exists, delete it (`validate` rejects kits containing one).

**Step 7: Validate**

Run `npx happyskills validate <kit-name> --json`. Fix any errors (follow Validate Error Handling in the SKILL.md) before considering the change complete.

**Step 8: Offer to release**

Use AskUserQuestion: "Would you like to publish this kit update now, or keep working?" If yes, route to `happyskills-publish` ("say 'publish <kit-name>'") — the publish flow bumps the version and ships. Do NOT run publish or bump yourself.
