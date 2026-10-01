# Claude Code Skill Authoring — Complete Reference

Full specification for designing high-quality Claude Code skills. This covers the **Claude Code standard** (SKILL.md). For HappySkills-specific conventions (skill.json, dependencies, keywords, publishing), see [happyskills-conventions.md](happyskills-conventions.md).

---

## 1. File Structure

The [Agent Skills specification](https://agentskills.io/specification) defines three standard optional directories. HappySkills adds `skill.json` and `CHANGELOG.md` on top of this:

```
.claude/skills/<skill-name>/
├── SKILL.md                    # Required — main skill file
├── skill.json                  # HappySkills — manifest (name, version, description)
├── CHANGELOG.md                # HappySkills — version history
├── scripts/                    # Standard — executable code agents run
│   └── helper.sh               # Referenced via ${CLAUDE_SKILL_DIR}/scripts/helper.sh
├── references/                 # Standard — documentation loaded on demand
│   └── topic.md
├── assets/                     # Standard — static resources (templates, images, data files)
│   └── schema.json
└── ...                         # Custom directories are allowed when justified
```

### Standard directories

The spec defines three directories by **content type** ([source](https://agentskills.io/specification)):

| Directory | Purpose | Key trait |
|---|---|---|
| `scripts/` | Executable code (Python, Bash, JS) | **Executed** — code never loads into context, only output consumes tokens |
| `references/` | Documentation the agent reads when needed | **Read into context on demand** — not preloaded at activation |
| `assets/` | Static resources: templates, images, schemas, data files | **Copied/used in output** — not loaded into context |

> **Note on `templates/` vs `assets/`**: The Agent Skills spec uses `assets/` for templates and static resources. HappySkills and Claude Code docs also recognize `templates/` as a valid alternative when the directory exclusively contains boilerplate for Claude to fill in. Either name is acceptable — choose whichever is more descriptive for your content.

### Custom directories

The spec explicitly allows custom directories (`└── ...  # Any additional files or directories`). Use them when content genuinely does not fit `scripts/`, `references/`, or `assets/`. For example, Anthropic's official `skill-creator` skill uses an `agents/` directory for sub-agent prompt definitions — these aren't reference docs, scripts, or static assets, so a custom folder is justified ([source](https://github.com/anthropics/skills/tree/main/skills/skill-creator)).

**Decision framework — standard vs custom folder:**

1. Is it executable code the agent runs? → `scripts/`
2. Is it documentation the agent reads on demand? → `references/`
3. Is it a static resource used in output (template, image, schema)? → `assets/` (or `templates/`)
4. Does it not fit any of the above categories? → Custom directory with a self-documenting name
5. Is there only 1-2 supporting files? → Root level is fine (no subfolder needed)

**Common mistake**: Creating custom directories like `phases/`, `guides/`, or `protocols/` for content that is really reference documentation the agent reads on demand. If the agent reads a file into context during execution, it belongs in `references/` — possibly in a subdirectory like `references/phases/` for organization.

Keep `SKILL.md` under **500 lines**. Move heavy content to supporting files.

**Rule — All executable code goes in `scripts/`:** If the skill needs to execute code (Python, shell, Node.js, etc.) as part of its workflow, that code MUST live in actual executable files under `scripts/`. Code in markdown files is only for documentation, examples, and references to scripts — never for code that gets executed. This rule exists because:
- Scripts are executed directly — their code never loads into the context window, only their output consumes tokens
- Pre-made scripts don't drift, don't introduce variability, and don't waste context on code generation
- Embedded executable code gets manually transcribed by the LLM on each run, introducing subtle errors

Use `${CLAUDE_SKILL_DIR}` to reference bundled scripts at runtime. This variable resolves to the skill's directory path:

```bash
# Run a bundled Python script
python3 "${CLAUDE_SKILL_DIR}/scripts/extract_fields.py" --input form.pdf

# Run a bundled shell script
bash "${CLAUDE_SKILL_DIR}/scripts/deploy.sh" --env production
```

---

## 2. SKILL.md Structure

```yaml
---
name: skill-name
description: What this skill does and when to invoke it (auto-invocation trigger)
arguments: [action, target]
argument-hint: "[action] [target]"
allowed-tools: Read, Grep, Glob, Bash
model: opus
context: fork
agent: Explore
# disable-model-invocation: true   ← ONLY add if user explicitly requests it
# user-invocable: false             ← ONLY add for background knowledge skills
---

# Skill Content

Your instructions, workflows, and knowledge here.
Use $action, $target for named arguments (preferred).
Use $ARGUMENTS for the full argument string.
Use $0, $1 only when named arguments aren't practical.
```

---

## 3. Frontmatter Field Reference

| Field | Type | Default | Description |
|---|---|---|---|
| `name` | string | directory name | **Required.** Kebab-case name. Becomes `/skill-name` slash command. Max 64 chars. |
| `description` | string | — | **Required for auto-invocation.** What the skill does + when to use it. The #1 factor for auto-invocation quality. Without it, Claude cannot auto-invoke the skill. |
| `argument-hint` | string | — | Autocomplete hint shown during `/` autocomplete, e.g. `[issue-number]` or `[source] [target]`. Display-only — does not affect parsing or substitution. |
| `arguments` | string or list | — | Named positional arguments for `$name` substitution. Accepts a space-separated string or YAML list. Names map to argument positions in order. See [Section 6](#6-arguments--string-substitutions) for full details. |
| `disable-model-invocation` | boolean | `false` | If `true`, only the user can invoke. Claude cannot use automatically. Skill description hidden from context. |
| `user-invocable` | boolean | `true` | If `false`, hidden from `/` menu. Claude-only auto-invocation. |
| `allowed-tools` | string list | — | Tools usable without permission prompts when skill is active. |
| `model` | string | inherited | Model for this skill (e.g., `opus`, `sonnet`, `haiku`). |
| `context` | string | — | Set to `fork` to run in isolated subagent. |
| `agent` | string | — | Subagent type when `context: fork` (e.g., `Explore`, `Plan`, `general-purpose`). |

### Forbidden Characters in Frontmatter Values

YAML frontmatter values are **unquoted strings**. Several characters break the YAML parser or the skill discovery system, causing skills to be silently ignored with no error.

**Characters that MUST NOT appear anywhere in frontmatter values (especially `description`):**

| Character | Why It Breaks |
|---|---|
| `;` (semicolon) | Breaks skill discovery — skill is silently ignored |
| `:` (colon) | YAML key-value separator — causes parse errors or misinterpretation |
| `#` (hash) | YAML comment — everything after it is silently dropped |
| `{` `}` (braces) | YAML flow mapping — triggers object parsing |
| `[` `]` (brackets) | YAML flow sequence — triggers array parsing |
| `'` `"` (quotes) | Unmatched quotes cause parse errors |
| `!` (exclamation) | YAML tag indicator |
| `&` `*` (ampersand/asterisk) | YAML anchor/alias indicators |
| `%` (percent) | YAML directive indicator (at line start) |
| `|` `>` (pipe/angle) | YAML block scalar indicators (at start of value) |

**Safe characters:** letters, digits, spaces, periods (`.`), commas (`,`), hyphens (`-`), parentheses (`()`), forward slashes (`/`).

**Example:**

```yaml
# ❌ WRONG — colon and semicolon break the skill
description: Deploy apps to AWS: supports ECS; also Lambda

# ✅ CORRECT — use commas and natural phrasing
description: Deploy apps to AWS including ECS and Lambda
```

**Rule:** After writing any frontmatter value, scan it for the forbidden characters above. Replace colons with "including", "with", or restructure the sentence. Replace semicolons with periods or commas. Never use `#`, `{}`, `[]`, or unmatched quotes.

---

## 4. Invocation Models

Three modes for controlling who invokes a skill:

### Mode A — Default (both user and Claude)

```yaml
# No special flags needed
description: Explains code structure using diagrams
```

- User can run `/skill-name`
- Claude auto-invokes when description matches context
- **Use for**: Reference knowledge + helpful task automation

### Mode B — User-only (`disable-model-invocation: true`)

> **IMPORTANT — Do NOT set this by default.** When this flag is set, Claude cannot auto-invoke the skill AND the skill's description is completely hidden from Claude's context — Claude won't even know the skill exists. This is a common source of confusion ("why isn't my skill being invoked?"). Only set this when the user **explicitly** requests it. When creating, converting, or initializing a skill, always use AskUserQuestion to ask the user about their invocation preference with a clear explanation of the consequences (see Section 9, rule 5).

```yaml
disable-model-invocation: true
description: Deploy application to production
```

- Only the user can run `/skill-name`
- Claude CANNOT invoke automatically
- Skill description is NOT in context (Claude won't know it exists)
- **Use for**: Deployments, commits, releases, destructive operations — any workflow with side effects the user must consciously trigger

### Mode C — Claude-only (`user-invocable: false`)

```yaml
user-invocable: false
description: Background context about our legacy authentication system
```

- Skill is hidden from `/` menu (user cannot invoke directly)
- Claude auto-invokes when description matches
- **Use for**: Architectural context, coding conventions, domain knowledge, background that informs Claude's decisions without user action

---

## 5. Writing Effective Descriptions — The Five-Slot Grammar

The `description` field is the **#1 factor** in auto-invocation quality. Claude sees ONLY this one-line description when deciding whether to load the skill — it is the sole trigger signal.

**The canonical format** is a **five-slot grammar** — five named slots, in fixed order, that together produce a description that routes precisely:

```
<Domain> — <Verb(s)> <Object>. Use when <Triggers>. Not for <Negative>.
```

| Slot | Role | What goes here |
|---|---|---|
| **Domain** *(optional — see "When to drop the Domain" below)* | Scope declaration — narrows the routing surface to the topic the skill wants to serve. Serves either as a *brand anchor* (humans + LLM recognize the product) or as a *topical hard-filter* (the LLM fast-skips when the prompt is in an unrelated area). | EITHER a real product/constellation name (`HappySkills`, `Stripe`, `Figma` — CamelCase brand) OR a real topical category (`site-cloning`, `image-gen` — kebab-case matching the family's casing). One token. Followed by an em-dash. **Skip the Domain entirely** when the verb-object phrase already anchors the topic, when the skill is intentionally multi-purpose, or when the skill name itself is topical — see "When to drop the Domain" below. |
| **Verb(s)** | The action(s) this skill performs. The primary routing signal. | One primary verb, optionally paired with closely related verbs. Imperative mood (`Install`, `Publish`, `Sync`). |
| **Object** | What the verb acts on. The other half of the routing signal — same verb, different object often means a different skill. | The concrete thing the verb operates on (`AI agent skills`, `workspace members`, `local skills with the remote registry`). Be specific; vague objects (`things`, `data`, `items`) cause routing collisions with siblings. **If the skill is about a nameable technology, product, API, or file format, name it** — proper-noun identifiers (`Gemini`, `Postgres`, `JWT`, `.docx`) are the highest-precision routing tokens and cut both false negatives (the user names the technology and the skill fires) and false positives (a request naming a *different* technology correctly does not). Skip this for genuinely general-purpose skills — they have no proper noun to name, and inventing one narrows routing wrongly. |
| **Triggers** | Concrete user-intent phrases the LLM should recognize as belonging here. Introduced by `Use when`. | 3–5 short phrases naming concrete user intents (`adding a skill to a project`, `signing in`, `resolving merge conflicts`). Use the user's vocabulary, not the implementation's. |
| **Negative** | Explicit redirection away from sibling skills that own related verbs. Introduced by `Not for`. | One short clause naming the verbs/intents that belong to a sibling. This is the cross-skill disambiguator — effectively required whenever sibling skills exist. |

> **Why em-dash, not colon?** The original spec uses a colon (`<Domain>:`) following Google's GWS convention (`Gmail:`, `Google Docs:`, etc.). The HappySkills CLI/API validator rejects unquoted colons in description values because of past YAML parsing failures. Use an em-dash (`<Domain> —`) — it plays the same routing role at the LLM level without tripping the validator. If/when the validator is updated to accept colons, switch to the colon form.

### Composition recipe — author in slot order

Each slot constrains the next:

1. **Domain.** Decide what routing surface this skill should serve, then choose accordingly. A brand name for members of a named product/constellation. A kebab-case topical category for standalone skills with polysemous verbs (`Map`, `Clone`, `Build`, `Fetch`, `Sync`, `Run`) whose verb-object phrase doesn't already anchor the topic. **Skip the Domain entirely** when the verb-object phrase already anchors the topic, when the skill is intentionally multi-purpose, or when the skill name itself screams the topic. See "When to drop the Domain" below for the full decision rule and worked examples.
2. **Verb(s).** Pick the *one* primary verb that names the dominant action. If you need three verbs, you probably have two skills (apply the Constellation Pattern — see [constellation-pattern.md](constellation-pattern.md)). Pair only verbs that are genuinely the same intent at different granularity (`install and update`).
3. **Object.** Name what the verb acts on, with specificity. If two siblings share a verb, the object is what makes routing orthogonal. `Update AI agent skills` (lifecycle) vs `Update skill content based on session learnings` (authoring) are routable; `Update skills` vs `Update skills` are not. **If the skill is about a nameable thing (a library, API, tool, file format, or product), name that proper noun** — it is the highest-precision routing token — and carry it into the Triggers, not just here. A skill described as operating on `JWTs` routes far more precisely than one operating on `authentication tokens`. (Genuinely general-purpose skills with no nameable subject correctly skip this — forcing an identifier onto them narrows routing wrongly.)
4. **Triggers.** List concrete user phrases that should fire this skill. Test each one: would a sibling's description plausibly also match this phrase? If yes, either tighten the trigger or add a Negative clause.
5. **Negative.** Name the closest sibling's territory and redirect to it. Skip this only if the skill has no near-neighbors (rare — most skills in a constellation have at least one sibling).

### Annotated example — HappySkills core (234 chars)

```yaml
description: HappySkills — Install and update AI agent skills. Use when adding a skill to a project, listing installed skills, refreshing or removing them, signing in, or configuring HappySkills. Not for searching the registry or asking questions.
```

| Slot | Value |
|---|---|
| Domain | `HappySkills` |
| Verb(s) | `Install and update` |
| Object | `AI agent skills` |
| Triggers | `adding a skill to a project, listing installed skills, refreshing or removing them, signing in, or configuring HappySkills` |
| Negative | `searching the registry or asking questions` |

### Bad vs good — same skill, two ways to write it

| | Description | Why |
|---|---|---|
| ❌ Bad | `HappySkills — Manage skills and workspaces. Use when working with HappySkills.` | Vague verb (`manage`), vague object (`skills and workspaces`), tautological trigger (`working with HappySkills`), no Negative. Will fire on prompts owned by every sibling. |
| ✅ Good | The 234-char example above. | Specific verbs, concrete object, user-vocabulary triggers, Negative redirects to the concierge sibling. |

### When to drop the Domain — the two-function lens

The Domain slot does two distinct jobs. Knowing which one matters for your skill tells you what to put in the slot — or whether to skip it.

| Function | What it does | Who it serves |
|---|---|---|
| A. **Brand anchor** | Tells humans + the LLM that this skill belongs to a named product/constellation | Constellation members (`HappySkills —`, `Tiny-Gemini —`, `Stripe —`) |
| B. **Topical hard-filter** | Narrows the LLM's routing prior to a topic *before* the verb is read | Skills whose verb is polysemous (`Map`, `Clone`, `Build`, `Fetch`, `Sync`, `Run`) and whose verb-object phrase doesn't already anchor the topic |

**Function B matters even outside constellations.** Polysemous verbs like `Map` (data structure? geography? site-mapping?) and `Clone` (git? object? website?) appear in many unrelated contexts. A leading topical token narrows the prior so the LLM fast-skips the skill on unrelated prompts.

**But the verb-object phrase often does function B for free.** `Map a website` already anchors to web territory. `Render a video` anchors to video. `Tokenize a code file` anchors to compiler territory. Adding a Domain on top is redundant and consumes character budget that could buy sharper Triggers.

**Decision rule:**

| Situation | Domain |
|---|---|
| Skill is a member of a named product/constellation | Brand name (CamelCase or kebab-case, matching the constellation's existing convention) |
| Standalone skill, polysemous verb, verb-object phrase does NOT anchor on its own | Real topical category (kebab-case, e.g. `site-cloning —`) |
| Standalone skill, verb-object phrase already anchors the topic | Skip the Domain |
| Skill is intentionally multi-purpose (broad routing surface is the goal) | Skip the Domain — narrowing would degrade routing |
| Skill name itself screams the topic (`deploy-aws`, `eslint-fix`, `web-crawler`) | Skip the Domain — the name does the work |

**The principle:** the Domain is a *scope declaration* — the routing surface this skill is electing to serve. It is NOT a category label every skill must have. A skill with no near-neighbors and a self-anchoring verb-object phrase loses nothing by skipping the Domain.

**Calibrate per-skill, not per-constellation.** Two skills shipped together can — and sometimes should — make different Domain choices because their routing surfaces differ. Example: a `web-crawler` / `web-cloner` pair. `web-cloner` is single-purpose (only fires on cloning prompts) → `site-cloning —` narrows it correctly. `web-crawler` is multi-purpose (also serves SBOM audits, CMS migration prep, inventory) → using `site-cloning —` would narrow it to a scope it doesn't actually serve. Different scopes → different Domain choices.

**Worked examples:**

| Skill | Domain | Reasoning |
|---|---|---|
| `happyskills` (constellation core) | `HappySkills —` | Brand anchor — member of a named constellation |
| `tiny-gemini-image` | `tiny-gemini —` | Brand anchor (kebab-case matches the constellation's existing convention) |
| `web-cloner` (single-purpose) | `site-cloning —` | Polysemous verb `Clone`; scope is narrow → topical anchor narrows correctly |
| `web-crawler` (multi-purpose) | *(none)* | Verb-object `Map a website` already anchors, and the skill serves multiple topics (cloning prep, SBOM audit, CMS migration, inventory) — narrowing would lose use cases |
| `deploy-aws` | *(none)* | Name already screams the topic |
| `eslint-fix` | *(none)* | Name already screams the topic |

### Why the Negative slot is effectively required in a constellation

When sibling skills own related verbs (e.g., `publish` lives in `happyskills-publish`, `design` in `happyskills-design`), the LLM needs explicit redirection to avoid firing the wrong skill on overlapping prompts. The `Not for X` clause is empirically supported — Vertex AI uses contrastive specificity in its tool-use guidelines, and academic research on tool selection (MetaTool, arXiv:2310.03128) confirms negative disambiguators improve accuracy on confusable siblings. In a constellation, every member except the most peripheral has a near-neighbor — so the Negative slot is required, not optional. See [constellation-pattern.md § 2 Orthogonal Verb Ownership](constellation-pattern.md) for the full rule and the failure mode when orthogonality is violated, [§ 2.4 Canonical-Command Escape Hatch](constellation-pattern.md) for the scoped softening when description-level orthogonality is unachievable, [§ 5 Orthogonality Test](constellation-pattern.md) for the three-layer test (front matter + routing tables + output vocabulary) you should run before publishing a multi-member constellation, [§ 6 Limits of Static Validation](constellation-pattern.md) for the kinds of collisions keyword tests cannot catch, and [§ 8 Case Study](constellation-pattern.md) for the worked example that grounded all of these refinements.

### Length budget

| Range | Status | Validator behavior |
|---|---|---|
| 80-180 chars | Recommended target | Pass |
| 180-250 chars | Acceptable | Pass |
| 250-1024 chars | Soft cap exceeded — likely a mega-skill | **Warning** (does not block publish) |
| > 1024 chars | Anthropic platform hard cap | **Error** (blocks publish) |

If your description exceeds 250 chars, you almost certainly have a mega-skill — see [The Mega-Skill Problem](#the-mega-skill-problem) below for decomposition strategies.

### Worked example (HappySkills core)

```yaml
description: HappySkills — Install and update AI agent skills. Use when adding a skill to a project, listing installed skills, refreshing or removing them, signing in, or configuring HappySkills. Not for searching the registry or asking questions.
```

Why this works:
- Namespace anchor: `HappySkills —` (em-dash form)
- Single primary verb: `Install` paired with `update` for the lifecycle
- Specific objects: `AI agent skills`, `installed skills`
- `Use when` clause names concrete scenarios users actually phrase
- Negative disambiguator (`Not for ...`) prevents collision with sibling skills (search lives in `happyskills-help`)

### Anti-patterns to avoid

| Anti-pattern | Why it fails |
|---|---|
| Vague verbs (`Helps with email`, `Manages email`) | Verb carries no routing signal |
| Multiple primary verbs (`Send, read, and manage email`) | Umbrella vs atomic siblings collide; model has to break a tie that didn't need to exist |
| Description as keyword list (`Gmail send compose write draft message recipient deliver outbound`) | Keyword stuffing degrades semantic signal — see spec § 4.4 |
| Padding to hit a length target | Wastes context budget; Anthropic explicitly warns about truncation under context pressure |
| **Tense and synonym matrices** (`extracting, analyzing, parsing, or pulling style guides`) | **Retired** per spec § 4.1 — no frontier lab recommends this, no benchmark validates it. LLMs handle tense and voice variation natively. The dominant failure mode is *semantic overlap between sibling tools* (MetaTool, arXiv:2310.03128), which is solved by adding **specificity** (negative disambiguators, `Use when` clauses), not synonyms. Empirically (EasyTool, arXiv:2401.06201), rewriting verbose descriptions into concise, structured, unambiguous forms produced +20-30% absolute gains in tool-selection accuracy. |
| **Fabricated Domain prefix** (inventing a brand-like word for the slot — e.g. `WebClone —` when no product called "WebClone" exists) | Adds noise without signal. Conflates *routing surface* with *naming*. The LLM has no reason to recognize the token, and humans reading the description are misled into thinking a product by that name exists. The slot is not mandatory; an invented token is worse than no token. | Replace with a real brand name, a real kebab-case topical category, or drop the Domain entirely. See "When to drop the Domain". |
| **Same Domain across siblings with different scopes** (paired skills shipped together forced to share one Domain even when their routing surfaces differ) | Narrows a multi-purpose skill's routing surface to the narrower sibling's scope. The multi-purpose skill then fails to auto-invoke on the topics it was meant to serve. | Calibrate the Domain per-skill, not per-pair. One skill may keep the Domain; the other may drop it or use a different one. See the `web-crawler` / `web-cloner` worked example in "When to drop the Domain". |
| **Casing mismatch between Domain and skill name** (`WebClone —` on `web-crawler` / `web-cloner`; `Tiny_Gemini —` on `tiny-gemini-image`) | Reads as a fake brand to humans and adds an unrecognized token to the LLM's routing input. Convention: match the family's casing — CamelCase Domains pair with CamelCase brand families, kebab-case Domains pair with kebab-case families. | If skills are kebab-case-named (`web-crawler`, `web-cloner`), use `site-cloning —`, not `SiteCloning —`. |

### Disambiguation playbook (for confusable siblings)

When two skills in the same namespace fire incorrectly, apply these in order:

1. **Sharpen the verb.** If both skills use `manage`, replace with the specific action (`archive`, `label`, `delete`).
2. **Sharpen the object.** `Reply to a message` is too generic if there's also a thread-wide reply. Use `Reply to one specific message` vs `Reply to all participants in a thread`.
3. **Add a negative disambiguator.** `— not a reply or forward.` Vertex AI and MetaTool research both endorse contrastive specificity.
4. **Add a `Use when` clause** with the trigger context.
5. **Last resort: split or merge.** If two skills are genuinely doing the same job, merge them. If they're genuinely different but the model can't tell, you have a naming problem — rename to make the difference legible.

Do **not** add synonyms or tense variants. They consume budget without empirical benefit.

### Common mistakes

- Too vague: `description: Technical coding tool` → Claude won't know when to use it.
- Missing namespace prefix WHEN the verb is polysemous AND the verb-object phrase doesn't anchor the topic on its own: skips the topical hard-filter benefit; the LLM can't fast-skip the skill in unrelated domains. (If the verb-object phrase DOES already anchor the topic — `Map a website`, `Render a video` — skipping the Domain is correct, not a mistake. See "When to drop the Domain".)
- No negative disambiguator when sibling skills exist: cross-skill verb collisions go unflagged.
- Wrong scope: description says "deploy" but skill also handles monitoring — split into focused skills, not a mega-skill description.
- Forbidden YAML characters in the description: the validator (`cli/src/validation/skill_md_rules.js`) hard-rejects `;`, `:`, `#`, `{`, `}`, `[`, `]`, `'`, `"`, `!`, `&`, `*`, `%`, `|`, `>` even when YAML-quoted, because the check runs on the decoded string. Use em-dashes, periods, and commas as separators.

### The Mega-Skill Problem

A **mega-skill** is a skill whose API surface has grown beyond what a single 1024-character description can reliably trigger. This is a known scaling problem — it happens when a skill covers many distinct user intents (e.g., a full CLI automation layer with 20+ commands spanning install, publish, auth, collaboration, and access control).

**How to detect it:**

- Description is above ~250 characters with high keyword density (short phrases, no prose) — the new spec soft cap from 260501-mega-skill-refactor. The 1024-char hard cap still applies, but 250 is the threshold at which decomposition becomes the right answer rather than just keyword tuning.
- New features are being added but there is no room in the description for trigger phrases
- Users report that the skill does not fire for certain capabilities even though the skill supports them
- The description reads like a keyword list rather than natural language

**Why it matters:**

The description is the **only** signal the LLM sees at session startup. When it becomes a dense wall of keywords, two things degrade:

1. **Semantic signal per intent drops** — the LLM has less context to distinguish when to trigger, especially for intents that share similar vocabulary
2. **Silent coverage gaps** — new features that cannot fit in the description are never auto-invoked, with no error or warning

**The user safety net:** If the skill name appears in the user's request (e.g., "use HappySkills to republish my skill"), the LLM will match on the `name` field regardless of description content. This is near-100% reliable. But users rarely prefix requests with the skill name — they expect the agent to route automatically.

**Resolution strategies — the Constellation Pattern is canonical:**

The canonical answer to a mega-skill is the **Constellation Pattern**: decompose the skill into a slim core entry point plus focused satellite skills, bundled via the core's `skill.json` dependencies. Each satellite owns one orthogonal verb cluster with its own 1024-char budget; the core handles lifecycle. Read [constellation-pattern.md](constellation-pattern.md) for the full operational reference (load-bearing orthogonality rule, five-slot grammar, orthogonality test, anti-patterns), and follow the **Constellation Decomposition Workflow** in [workflows.md](workflows.md) for the 8-phase procedure.

The three resolution strategies, in order of when each applies:

**Strategy 1 — Compress the description (first line of defense, only when slightly over).** Apply the AUDIT/LOSSLESS/LOSSY procedure from the SKILL.md error handling section. The key principle: **LLMs can infer synonyms from a strong anchor word.** If "Start, stop" is in the description, the LLM will match "launch", "halt", "shut down" without those words being present. Synonym clusters can be aggressively trimmed without losing trigger coverage. Only UNIQUE phrases (the sole trigger for a capability) and IDENTITY phrases (what the skill is) must be preserved. Compression buys time but does not solve the underlying scaling problem — once the API surface grows again, you will be back over the cap.

**Strategy 2 — Constellation Pattern (canonical, recommended once decomposition is justified).** Apply the full Constellation Pattern: extract focused satellite skills from the mega-skill, give each a five-slot description with orthogonal verb ownership, and bundle them via the core's `skill.json` dependencies. Each member gets its own 1024-char budget; the constellation ships as one product via one install command. Example decomposition for a CLI automation skill:

| Skill | Covers | Bundled? |
|---|---|---|
| `my-tool` (core) | Lifecycle (install, search, list, update, check) | Yes — entry point |
| `my-tool-publish` | Publish, fork, release, validate | Yes — auto-installed with core |
| `my-tool-author` | Skill design, review, audit, improvement | Yes — auto-installed with core |
| `my-tool-collab` | Workspace, members, groups, permissions, access | Opt-in — surfaced through concierge |

Run the **Constellation Decomposition Workflow** in [workflows.md](workflows.md) for the 8-phase procedure (confirm symptom → map verb space → propose constellation → draft five-slot descriptions → run orthogonality test → generate files → validate → release coordination).

**Strategy 3 — Hybrid umbrella + satellites (a Constellation Pattern variant).** A specific shape of the Constellation Pattern: one main skill for the most common operations plus one or two satellites for genuinely distinct domains. Use this when most intents cluster around a single core use case with only 1–2 outlier domains. Same orthogonality rules apply.

**When to recommend each strategy:**

| Situation | Strategy |
|---|---|
| Description is 250-400 chars and still has synonym redundancy | Compress (Strategy 1), then re-evaluate |
| Description is above the 250-char soft cap and new features keep coming | **Constellation Pattern (Strategy 2)** |
| Skill covers genuinely distinct user personas or intent domains | **Constellation Pattern (Strategy 2)** |
| Most intents cluster around a core use case with 1–2 outlier domains | Hybrid (Strategy 3) — a Constellation Pattern variant |
| Skill description names ≥ 4 distinct primary verbs | **Constellation Pattern (Strategy 2)** |

**When auditing or updating a skill**, proactively check for mega-skill symptoms. **If the description is above 250 characters, flag it to the user and offer to apply the Constellation Decomposition Workflow.** The Constellation Pattern is the canonical answer once a skill crosses 250 chars — compression alone will not keep up as the API surface grows.

---

## 6. Arguments & String Substitutions

Skills accept arguments when invoked. Arguments are **positional** and **whitespace-separated**, using shell-style quoting for multi-word values. There are no flags, no key-value pairs, and no structured parsing — arguments are strictly positional strings.

> **Source**: [Claude Code Skills Documentation — Pass arguments to skills](https://code.claude.com/docs/en/skills)

### Argument parsing rules

- Arguments are split by whitespace: `/my-skill foo bar` → position 0 = `foo`, position 1 = `bar`
- Multi-word values must be shell-quoted: `/my-skill "hello world" bar` → position 0 = `hello world`, position 1 = `bar`
- There are **NO** flags (`--verbose`), **NO** key-value pairs (`key=value`), **NO** structured parsing
- Arguments are always strings — no type validation, no required/optional declaration, no defaults

### All string substitution variables

| Variable | Description |
|---|---|
| `$ARGUMENTS` | All user-provided arguments as a single raw string |
| `$ARGUMENTS[N]` | Argument at 0-based index N (e.g., `$ARGUMENTS[0]`, `$ARGUMENTS[1]`) |
| `$N` | Shorthand for `$ARGUMENTS[N]` (e.g., `$0`, `$1`, `$2`) |
| `$name` | Named argument from the `arguments` frontmatter field (see below) |
| `${CLAUDE_SESSION_ID}` | Current session ID |
| `${CLAUDE_SKILL_DIR}` | Directory containing the skill's SKILL.md file |

**`$ARGUMENTS` auto-append behavior**: If `$ARGUMENTS` is NOT present anywhere in SKILL.md, Claude Code automatically appends `ARGUMENTS: <input>` to the end of the rendered skill content so the AI still sees what the user typed. If `$ARGUMENTS` IS present, it is replaced inline with the full user input string.

### Named positional arguments (the `arguments` field)

The `arguments` frontmatter field maps names to argument positions, enabling `$name` placeholders instead of `$0`, `$1`, etc. This is the **recommended approach** for any skill that takes 2 or more positional arguments, because named placeholders are self-documenting and make the skill content easier to read and maintain.

**Syntax**: Accepts a space-separated string or a YAML list. Both are equivalent:

```yaml
arguments: [component, source, target]
arguments: component source target
```

**Example — named arguments:**

```yaml
---
name: migrate
arguments: [component, source, target]
argument-hint: "[component] [source] [target]"
---
Migrate the $component component from $source to $target.
Preserve all existing behavior and tests.
```

`/migrate SearchBar React Vue` → `$component` = `SearchBar`, `$source` = `React`, `$target` = `Vue`

**Equivalent using indexed arguments** (less readable, not recommended for 2+ args):

```yaml
---
name: migrate
argument-hint: "[component] [source] [target]"
---
Migrate the $0 component from $1 to $2.
```

### Best practices for argument design

1. **Use `arguments` for skills with 2+ positional args.** Named placeholders (`$action`, `$note`) are self-documenting. Indexed placeholders (`$0`, `$1`) require the reader to mentally map positions to meaning.

2. **Use `argument-hint` alongside `arguments`.** The hint is what users see in autocomplete — it should mirror the argument names so the user knows what to type:

   ```yaml
   arguments: [action, note]
   argument-hint: "[patch|minor|major|draft] [\"description\"]"
   ```

3. **Use known keywords in fixed positions for deterministic routing.** When a skill has multiple modes, put the mode selector in the first position with a finite set of known values. The skill body then routes on that keyword:

   ```yaml
   arguments: [action, note]
   ```

   Where `$action` is always one of: `patch`, `minor`, `major`, `draft`, or omitted (AI decides). This is deterministic — the AI does not need to guess which argument is which.

4. **Design around omission for optional trailing arguments.** Since there are no defaults or required/optional declarations, the skill body must handle the case where an argument is empty. Instruct the AI explicitly: "If `$note` is empty, derive the description from session context and git analysis."

5. **Never rely on flag or key-value syntax.** `--verbose`, `key=value`, `--env=production` are NOT supported. Arguments are strictly positional. If you need multiple optional parameters, use known keywords in fixed positions rather than flags.

6. **`$0` is fine for single-argument skills.** When a skill takes exactly one argument (e.g., an issue number, a file path), `$0` or raw `$ARGUMENTS` is perfectly clear. Named arguments add value at 2+ positions.

### Example: multi-mode skill with named arguments

```yaml
---
name: release-api
description: Release a new version of the API
disable-model-invocation: true
arguments: [action, note]
argument-hint: "[patch|minor|major|draft] [\"description\"]"
allowed-tools: Bash, Read, Edit, AskUserQuestion
---

## Arguments

- **$action** (optional): `patch`, `minor`, `major`, `draft`, or omitted (AI determines bump)
  - `patch`, `minor`, `major` — explicit semver bump, proceeds to full release
  - `draft` — writes unreleased changelog notes only, no version bump or tag
  - omitted — AI analyzes changes and determines the appropriate bump
- **$note** (optional): Quoted description to include in the release changelog.
  If provided, the skill ensures this content is reflected in the changelog
  and factored into the bump decision. If omitted, the skill derives the
  description from session context and git history.

## Workflow
...
```

Invocations:

```
/release-api                                        # AI decides everything
/release-api patch                                  # explicit bump, no note
/release-api draft                                  # snapshot unreleased notes only
/release-api minor "Added streaming SSE support"    # explicit bump + note
/release-api draft "Chat streaming halfway done"    # draft + note
```

---

## 7. Supporting Files & Progressive Disclosure

Skills use a **progressive disclosure** model — content loads in stages, not all at once ([source](https://agentskills.io/specification)):

| Level | What loads | When | Token budget |
|---|---|---|---|
| 1. Metadata | `name` + `description` from frontmatter | At startup, for ALL installed skills | ~100 tokens per skill |
| 2. Activation | Full SKILL.md body | When skill is invoked or auto-triggered | < 5,000 tokens recommended |
| 3. Execution | Files from `references/`, `scripts/`, `assets/`, etc. | Only when the agent determines they are needed | As needed |

This is why keeping SKILL.md under 500 lines matters — it loads entirely at Level 2. Supporting files only load at Level 3 when explicitly referenced.

### Referencing supporting files

Claude loads supporting files **on demand** — not every invocation. Reference them in SKILL.md with **conditional links** that tell the agent *when* to load each file ([source](https://agentskills.io/skill-creation/best-practices)):

```markdown
## Additional resources
- Read [references/api-errors.md](references/api-errors.md) if the API returns a non-200 status code
- For complete field details, see [references/api-reference.md](references/api-reference.md)
- For usage examples, see [examples.md](examples.md)
```

Conditional links ("read X **if** Y happens") are more effective than generic "see references/ for details" because they help the agent decide when loading is worthwhile.

### File reference depth

Keep file references **one level deep** from SKILL.md. Avoid deeply nested reference chains where file A references file B which references file C ([source](https://agentskills.io/specification)). Subdirectories within `references/` are fine (e.g., `references/phases/01.md`) — the rule is about chain depth, not directory depth.

### When to create supporting files

| Content Type | Location | Reasoning |
|---|---|---|
| Detailed specs, API docs, domain knowledge | `references/<topic>.md` | Documentation read into context on demand |
| Organized reference subdomain | `references/<category>/<topic>.md` | Subdirectories keep large reference sets manageable |
| Executable code (Python, shell, JS) | `scripts/<name>.py`, `.sh`, or `.js` | Executed, not loaded into context. Reference via `${CLAUDE_SKILL_DIR}/scripts/` |
| Templates, boilerplate for output | `assets/<name>.md` or `templates/<name>.md` | Static resources used in generated output |
| Images, schemas, data files | `assets/<name>` | Static resources, not loaded into context |
| Usage examples (1-2 files) | `examples.md` or `examples/<name>.md` | Root-level file is fine for small sets |

### Organizing large skills with many supporting files

For skills with 10+ supporting files, organize them into the standard directories rather than leaving them at the skill root. A flat list of 15+ `.md` files alongside SKILL.md makes it hard to understand the skill's structure at a glance.

**Example — a complex skill with well-organized supporting files:**

```
my-complex-skill/
├── SKILL.md                           # Routing + core instructions (< 500 lines)
├── skill.json
├── references/                        # All documentation the agent reads on demand
│   ├── philosophy.md
│   ├── api-reference.md
│   ├── error-handling.md
│   └── phases/                        # Subdirectory for sequential docs
│       ├── 01-analysis.md
│       ├── 02-extraction.md
│       └── 03-validation.md
├── scripts/                           # All executable code
│   ├── extract.py
│   └── validate.sh
└── templates/                         # Output boilerplate
    ├── report.md
    └── summary.md
```

Compare with what to **avoid** — everything dumped at root:

```
my-complex-skill/
├── SKILL.md
├── philosophy.md                      # Reference doc... at root
├── api-reference.md                   # Reference doc... at root
├── error-handling.md                  # Reference doc... at root
├── 01-analysis.md                     # Reference doc... at root
├── 02-extraction.md                   # Reference doc... at root
├── 03-validation.md                   # Reference doc... at root
├── extract.py                         # Script... at root
├── validate.sh                        # Script... at root
├── report.md                          # Template... at root
└── summary.md                         # Template... at root
```

The second structure provides no signal about what each file does or when to load it.

---

## 8. Advanced Patterns

### Shell Preprocessing (`!` backtick syntax)

Run shell commands BEFORE the skill is sent to Claude. Prefix with `!` followed by a backtick-quoted command:

```markdown
## Current State

Git status:
!`git status --short`

Last 5 commits:
!`git log --oneline -5`
```

Claude Code executes these `!`command`` expressions during preprocessing and replaces them with the command output. Claude sees the rendered result, not the command.

**Use for**: Live system state, config values, metrics, API responses injected at skill load time.

**Important**: The `!` prefix is required. Plain backtick-quoted text without `!` is treated as normal inline code, not a preprocessing command.

### Isolated Subagent (`context: fork`)

Run the skill in an isolated subagent with its own tools and model:

```yaml
---
name: security-audit
context: fork
agent: general-purpose
---
Audit this codebase for security vulnerabilities...
```

**Built-in agent types:**

| Agent | Tools Available | Use For |
|---|---|---|
| `Explore` | Read, Grep, Glob, WebFetch, Task | Read-only research, codebase investigation |
| `Plan` | Bash, Read, Glob, Task | Planning and analysis |
| `general-purpose` | All standard tools | Full implementation work |

**Use for**: Research tasks, large file scans, parallel work, isolation from main context.

### Extended Thinking

Include the word **`ultrathink`** anywhere in the skill content to enable Claude's extended reasoning mode:

```markdown
Use ultrathink to analyze the architectural trade-offs...
```

**Use for**: Complex analysis, architectural decisions, difficult debugging.

---

## 9. Best Practices

1. **SKILL.md under 500 lines** — Use supporting files for anything longer.
2. **Specific, keyword-rich descriptions** — Include words and phrases users would naturally say.
3. **Always add a Constraints section** — Prevents hallucinated commands and misuse.
4. **Include verification steps** — "Run tests", "check exit code", "show output". Silent failures are worse than visible errors.
5. **NEVER set `disable-model-invocation: true` unless the user explicitly asks for it.** When creating, converting, or initializing a skill, always ask the user with AskUserQuestion: "Should Claude be able to auto-invoke this skill, or should it be user-only (manual /slash command)?" with these options:
   - **"Auto-invoke (Recommended)"** — Claude invokes when relevant. Best for most skills.
   - **"User-only (/slash command)"** — Only you can trigger it. Claude won't know it exists. Use for deployments, releases, or destructive operations.
   Default to auto-invoke. Only set the flag if the user picks "User-only".
6. **Use `user-invocable: false` for background knowledge** — Architectural context, conventions, domain knowledge.
7. **Split large domains into a skill constellation** — Three focused 150-line skills > one 500-line skill.
8. **Name supporting files clearly** — `json-shapes.md`, `api-reference.md`, not `stuff.md`.
9. **Organize supporting files by content type** — Use `references/` for docs, `scripts/` for code, `assets/`/`templates/` for static resources. Only create custom directories when content genuinely doesn't fit these standard categories.
10. **Use conditional file references** — "Read `references/errors.md` if the API returns non-200" is better than "see references/ for details."
11. **Idempotent workflows** — "Check if already done, skip if so." Safe to re-run.
12. **Show what will happen before doing it** — Use AskUserQuestion for destructive or irreversible ops.
13. **DRY — Don't Repeat Yourself across skill files** — If the same procedure, rule, or reference data appears in more than one file (or more than once in the same file), extract it into a single location and reference it from the other places. This prevents content from drifting out of sync when updated. Specifically:
    - **Procedures** (multi-step workflows): Define once in a "Common Procedures" section and reference by name from each workflow that uses it.
    - **Rules and constraints**: Define the authoritative version in one reference file and point to it from workflows.
    - **Reference data** (tables, option lists): Define once, reference everywhere else.
    - **Exceptions**: Single-line cross-references ("see Section X") are not duplication. Short contextual reminders (1-2 lines restating a critical rule in a workflow step) are acceptable when they reinforce a safety constraint — but the authoritative definition must still live in one place.
    - **When NOT to extract**: If two blocks look similar but have meaningful contextual differences (different actions, different assumptions about starting state), keep them separate. False deduplication that hides genuine nuances is worse than the repetition it eliminates.
14. **Translate tool output for the user — don't transcribe it.** Skills that wrap a CLI command and surface its JSON output **must prescribe the user-facing phrasing, not just the agent behavior.** A "Status Values" table that lists `Status | Meaning | Action` is a *behavior* prescription. To also be a *communication* prescription, every status value, response key, or aggregate field the agent will present to the user needs an explicit plain-English opening sentence the agent should use verbatim. Without this, under uncertainty an LLM agent defaults to enumerating the JSON's vocabulary (`status: diverged`, `base_commit`, `merge_parents` …) — producing a wall of jargon for the user. The fix is structural: add a "Plain-English meaning (use as your opening sentence)" column to every status-value table, and frame the section with an explicit rule ("Lead with the plain-English meaning; quote JSON values only if the user asks"). See `happyskills-sync` SKILL.md Section 2 for the reference implementation. This rule applies to **every** skill that interprets command output for a user — `validate`, `status`, `check`, `pull`, `diff`, `publish`, anything that returns a status field or a result code.
15. **Capture hard-won failure knowledge in a Gotchas section** — The highest-signal content in most skills is the set of counterintuitive, domain-specific facts Claude gets *wrong* by default: the table that's append-only so the row you want is the highest version, not the most recent `created_at`; the field called `@request_id` in one service and `trace_id` in another; the staging endpoint that returns 200 even when the webhook never fired. This is distinct from the Constraints section (#3): constraints are *prohibitions* ("never do X"), whereas gotchas are *corrections to the model's wrong priors* about how the domain actually behaves. Seed the section with the first failure you hit and grow it each time the skill trips on a new edge case — most strong skills started as a few lines plus one gotcha. The Skill Update Workflow exists precisely to fold session-discovered gotchas back into the skill. **Where they live scales with how many you have, and SKILL.md must always link to them:**
    - **A few:** an inline `## Gotchas` section in SKILL.md.
    - **Many, or domain-split:** keep that section as a *thin index* (one line per area) and move the detail into `references/gotchas/<domain>.md`, linked **directly** from the index — one hop, so it respects the reference-depth rule (§ 7) and stays off SKILL.md's hard 500-line budget.
    - **The index is load-bearing:** a gotcha file SKILL.md doesn't point to is one the agent never loads. Keep it in sync (every domain file linked, every link resolves — the Audit Workflow checks this), and don't split until the inline section is genuinely unwieldy (over-structuring three gotchas is #17 in miniature). This mirrors the hub+domain gotchas pattern the project's docs use, folded into a skill's single always-loaded entry point.
16. **Don't state the obvious — encode only the non-default** — Claude already writes code competently and can read the codebase, so body instructions that restate what the model would do anyway spend context budget without adding signal *and* dilute the high-value content around them. Every line should push Claude off a default it would otherwise take: an org-specific convention, a taste judgment (the frontend-design skill earns its keep by steering away from the default Inter-font-and-purple-gradient look, not by explaining CSS), a non-obvious gotcha. Litmus test — if a sentence would be true of any competent engineer working with no skill loaded, cut it. This is the body-content counterpart to the description discipline in #2 and the length budget in § 5: signal density, not volume.
17. **Give judgment room — don't railroad** — A skill is reused across situations its author never anticipated, so rigid, over-specified step sequences make it brittle: the moment reality diverges from the assumed path, the skill stalls or forces a wrong action. Prefer handing Claude the *goal plus the context it needs to decide* over a fixed script it must follow blindly. The exception is deliberate and important — where an operation is destructive, irreversible, or must be deterministic (releases, migrations, anything safety-critical, cf. #4 and #12), prescribe it tightly and verify each step; there, removing the model's discretion is the whole point. Calibrate by stakes: tight rails on the dangerous path, room to adapt everywhere else.
18. **Grant `allowed-tools` by least privilege — never inherit the scaffold default** — `allowed-tools` is the *no-prompt* surface (the tools the skill may use without a permission prompt), not a capability grant and not a box to fill with everything. Claude can still reach for other tools; they just prompt. So list exactly the tools the skill's own workflow invokes. A read-only or CLI-dispatch skill — one that searches, lists, reports, answers questions, or only wraps a CLI and reads files — needs no `Write`/`Edit`; omitting them means an unexpected write surfaces a permission prompt instead of executing silently, which is the whole safety point. Only skills that author or mutate files carry `Write`/`Edit`. The failure mode is copy-pasting a broad set like `Bash, Read, Write, Edit, Glob, Grep, AskUserQuestion` from a sibling skill and never narrowing it — derive the set from the workflow, don't inherit it. This is the frontmatter counterpart to the signal-density discipline in #16: grant only what earns its place.

| Anti-Pattern | Problem | Fix |
|---|---|---|
| Vague description (`"Coding tool"`) | Claude never auto-invokes | Add action verbs and specific domain keywords |
| SKILL.md > 500 lines | Context bloat, slow loading | Move content to supporting files |
| No Constraints section | Hallucinated flags and misuse | Add explicit "never do X" rules |
| No verification steps | Silent failures | Add "run tests / check output" after actions |
| `disable-model-invocation: true` on a safe reference skill | User must manually invoke every time | Remove flag for knowledge-only skills |
| Missing `argument-hint` when skill takes args | Poor UX — user doesn't know what to type | Add `argument-hint: "[what to pass]"` |
| Using `$0`, `$1` for 2+ arguments without `arguments` field | Skill content is cryptic — reader must mentally map positions to meaning | Use the `arguments` frontmatter field for named placeholders (`$action`, `$target`) |
| Relying on `--flag` or `key=value` argument syntax | Not supported — arguments are strictly positional with shell-style quoting | Use known keywords in fixed positions for deterministic routing |
| Two skills with identical description topics | Both trigger or neither triggers | Differentiate descriptions; split by domain |
| Task skill with no clear end state | Claude doesn't know when it's done | Define explicit success criteria |
| Executable code embedded in markdown instead of `scripts/` | Code drifts from what works, wastes context tokens, introduces variability on every run | All executable code goes in `scripts/`. Code in markdown is only for documentation, examples, and references to scripts. Reference via `${CLAUDE_SKILL_DIR}/scripts/` |
| Many supporting files dumped at skill root | No signal about file purpose or when to load each file, hard to navigate | Organize into `references/`, `scripts/`, `assets/`/`templates/`. Use root only for 1-2 files |
| Custom directories for content that fits standard folders | Misleading structure — suggests a distinct content type when there isn't one | Use `references/` for docs, `scripts/` for code, `assets/` for static resources. Only create custom dirs for genuinely distinct content categories |
| Deeply nested reference chains (A → B → C → D) | Agent may lose context traversing multiple hops | Keep references one level deep from SKILL.md. Subdirectories are fine, but avoid chains of files referencing other files |
| Same procedure or rule copy-pasted across multiple files | Content drifts out of sync when one copy is updated but others are forgotten | Extract to a single location (Common Procedures section or authoritative reference file) and reference it from each workflow. See Best Practice #13 |
| Skill describes CLI status values or result codes without prescribing the plain-English opening sentence the agent should use | Under uncertainty, the agent transcribes the JSON vocabulary (`status: diverged`, `base_commit`, `merge_parents`) into prose — producing a wall of jargon for the user | Add a "Plain-English meaning (use as your opening sentence)" column to every status-value table, and frame the section with "Lead with the plain-English meaning; quote JSON values only if the user asks." See Best Practice #14 and `happyskills-sync` SKILL.md Section 2 for the reference implementation |
| No Gotchas section in a knowledge- or domain-heavy skill | The skill's highest-signal content — the model's wrong priors about the domain — is never corrected, so Claude repeats the same default mistakes | Add a Gotchas section; seed it with the first observed failure and grow it over time. Distinct from Constraints (prohibitions vs. prior-corrections). See Best Practice #15 |
| Gotchas that outgrow SKILL.md, or sit in `references/` unlinked from it | Either bloats SKILL.md toward the 500-line silent-death cap, or leaves a gotcha file the agent never loads (unlinked = invisible) | Move the detail to `references/gotchas/<domain>.md` and link it directly from a thin `## Gotchas` index in SKILL.md (one hop). See Best Practice #15 |
| Body content that restates what Claude already does by default | Wastes context budget and dilutes the high-signal content around it | Cut it — encode only what pushes Claude off a default (conventions, taste calls, gotchas). See Best Practice #16 |
| Rigid, over-specified steps on a non-critical path | Brittle — the skill stalls or misfires the moment the situation deviates from the author's assumed path | Give the goal plus context and let Claude adapt; reserve tight rails for destructive or deterministic operations. See Best Practice #17 |
| Over-granted `allowed-tools` (broad scaffold default left unnarrowed) | A read-only or CLI-dispatch skill silently auto-approves `Write`/`Edit` it never legitimately uses, so an unexpected mutation runs with no prompt | Grant only the tools the workflow invokes; strip `Write`/`Edit` from any skill that doesn't author or mutate files. See Best Practice #18 |

---

## 11. Design Patterns

### Pattern 1 — Reference Skill (Knowledge Only)

```yaml
---
name: api-conventions
description: Project API conventions for naming, HTTP methods, status codes, error format
user-invocable: false
---

When designing endpoints:
- Resources are plural nouns (users, not user)
- Properties use camelCase
- Errors follow { error: { code, message } } format
...
```

Claude consults this automatically when working on API code. User never needs to invoke it.

---

### Pattern 2 — Task Workflow (User-Controlled)

```yaml
---
name: release
description: Release a new version of the CLI
disable-model-invocation: true
allowed-tools: Bash, Read, Edit
arguments: [action, note]
argument-hint: "[patch|minor|major|draft] [\"description\"]"
---

1. Check git status is clean
2. Analyze changes since last release
3. Classify changes and determine bump (use $action if provided)
4. If $note is provided, ensure it is reflected in the changelog
5. Update CHANGELOG.md
6. Bump version, commit, and tag
7. Show release summary
```

User triggers `/release patch` or `/release minor "Added streaming"`. Claude won't do this accidentally.

---

### Pattern 3 — Hybrid (Knowledge + Workflow)

```yaml
---
name: code-review
description: Review code against project standards. Use when reviewing PRs or code quality.
---

## Our Standards

[conventions content]

## Review Process

1. Check against standards above
2. Look for edge cases
3. Verify test coverage
4. Output findings by severity
```

---

### Pattern 4 — CLI Wrapper

```yaml
---
name: my-tool
description: Automate my-tool CLI via natural language
allowed-tools: Bash, AskUserQuestion
---

## Routing

Map user intent → CLI commands:
| User Intent | Command |
|---|---|
| "search" | `my-tool search "<query>" --json` |
| "install" | `my-tool install <name> --json` |

## Constraints

- ALWAYS use `--json` flag
- NEVER run destructive commands without AskUserQuestion confirmation
- NEVER fabricate flags not listed above
```

---

### Pattern 5 — Skill Constellation (Multiple Focused Skills)

Instead of one large skill:

```
.claude/skills/
├── react-patterns/       # Reference: component conventions (user-invocable: false)
├── react-testing/        # Reference: testing patterns (user-invocable: false)
├── react-migrate/        # Task: migration workflow (disable-model-invocation: true)
└── react-optimize/       # Task: performance optimization
```

Each skill is focused, small, and has a precise description for accurate auto-invocation.

---

### Configuration — declare a schema, read `skills-config.json`

Some skills need setup values the author can't know in advance — a channel, a project ID, a token. **Never store these inside the skill folder**: a skill is a reinstallable artifact, so anything written into it is wiped on the next `update`. Configuration lives **outside** the skill, in a committed project-root `skills-config.json` (sibling of `skills-lock.json`) — as `.npmrc` relates to `node_modules`.

1. **Author: declare the schema in `skill.json`** — a `config` block for non-secret tunables, an `env` block for the environment contract (`required: true` = activation gate; `secret: true` routes to a gitignored `.env`, name-only to `.env.example`). Full reference: `docs/skill-format.md` § 4.6 in the HappySkills source repo (not bundled with this skill). On install/update the CLI prompts the consumer and writes their choices to `skills-config.json` (keyed `owner/name`) — you write no setup code, and secret **values** never land in any committed file.

   ```json
   { "config": { "channel": { "type": "string", "default": "#general", "description": "Channel to post to" } },
     "env":    { "SLACK_BOT_TOKEN": { "required": true, "secret": true, "description": "Slack bot token" } } }
   ```

   A `config` field's `type` is one of `string`, `integer`, `number`, `boolean`, **`object`**, or **`array`**. An `env` var's type is scalar only — a `.env` value is always a string, so structured data belongs in `config`, never in `env`.

   **App-managed fields — `prompt: false`.** Some settings are not something a human can type at an install prompt: a theme object, a named palette library, anything the skill's *own* UI authors. Declare them structured and mark them `prompt: false` — install will skip them (an object/array field is never prompted anyway) and the skill writes them itself with `skills-config set` (step 3 below). Without this, install becomes a wall of unanswerable questions.

   ```json
   "config": {
     "theme":    { "type": "object", "default": {}, "prompt": false, "description": "Workspace default theme." },
     "palettes": { "type": "object", "default": {}, "prompt": false, "description": "Named palette library." }
   }
   ```

   **Declare a `schema` for every structured field — this is the single highest-value thing you do when designing complex config.** Without one, HappySkills stores the value verbatim and never looks inside (content opacity), which means *nothing* can tell an agent that `palettes.Acme.palette[2]` is not a hex colour. The agent finds out at runtime, from whatever error your code happens to throw, and it cannot reliably repair the value. With a schema, `skills-config set` **refuses** the bad write and `skills-config validate` reports **every** violation with its exact path and an imperative fix — so an agent fixes and re-runs until it converges. That loop is the whole point.

   ```json
   "palettes": {
     "type": "object", "prompt": false, "default": {},
     "schema": {
       "patternProperties": {
         ".*": {
           "type": "object",
           "required": ["accent", "palette"],
           "additionalProperties": false,
           "properties": {
             "accent":  { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" },
             "palette": { "type": "array", "minItems": 1, "maxItems": 8,
                          "items": { "type": "string", "pattern": "^#[0-9a-fA-F]{6}$" } }
           }
         }
       }
     }
   }
   ```

   ```
   ✖ palettes.Acme.palette[2] — "not-a-hex" does not match ^#[0-9a-fA-F]{6}$
     → Replace it with a 6-digit hex colour, e.g. "#eb4a26".
   ✖ palettes.Acme.eighth_token — unknown key; this skill's schema does not allow it
     → Remove it, or check it for a typo. Allowed keys: accent, palette.
   ```

   **The schema is YOURS, and that is what makes it safe.** HappySkills does not invent a contract for your data — it enforces the one *you* declare, which ships inside your skill and versions with it. It therefore cannot go stale against your own code the way a validator on someone else's release cycle would. That is precisely why this does not violate content opacity: there is no second validator, just your contract, enforced on your behalf.

   **Supported keywords** (a closed JSON-Schema subset — anything else is an authoring error, caught by `happyskills validate`): `type`, `enum`, `const`, `properties`, `required`, `additionalProperties`, `patternProperties`, `items`, `minItems`, `maxItems`, `pattern`, `minLength`, `maxLength`, `minimum`, `maximum`, `description`.

   **Designing the schema — four rules that decide whether the loop actually converges:**

   1. **Close the shape: `"additionalProperties": false`.** An open object silently accepts a typo'd key forever. Closing it turns `eighth_tokn` into a located error with the allowed keys listed.
   2. **Constrain the leaves, not just the branches.** `"type": "string"` on a colour tells an agent almost nothing. `"pattern": "^#[0-9a-fA-F]{6}$"` tells it exactly what to write. Reach for `pattern`, `enum`, `minItems`/`maxItems`, `minimum`/`maximum` — every constraint you add is one more mistake the agent can fix by itself instead of shipping.
   3. **Use `patternProperties` for a map with author-chosen keys** (a palette *library*, a named-profile map). Use `properties` + `required` for a fixed record (a theme). Getting this backwards is the most common mistake: a fixed record under `patternProperties` validates nothing useful.
   4. **Keep the schema and your runtime validator in agreement — ideally make the schema the source of truth.** Two independently-maintained validators *will* diverge, and then a config that HappySkills accepts blows up in your code. If your skill already has a validator, derive it from the schema or delete it in favour of it.

   **Keep it configuration, not application state.** A committed `skills-config.json` is meant to be read in a pull request. A theme, a palette library, a set of thresholds — fine. Documents, layouts, caches, edit history — not fine; those belong in your own storage. The CLI warns past 64 KB, which is the smell, not the rule.

   `happyskills validate` warns (advisory, never blocking) when a structured field declares no schema — omitting one is a legitimate decision for a value that is genuinely opaque to everyone but your skill, but it should be a *decision*, not an oversight.

   **Constellation secrets — `sharedEnv`.** If you are authoring a **constellation** whose members share a secret (the common case — e.g. one API token read by the core and its satellites), declare `sharedEnv: true` on the **core** so install scaffolds ONE `./secrets/<core>.env` for all members instead of an identical file each. Opt-in, core-only, invalid on kits. See [constellation-pattern.md § 1.1](constellation-pattern.md) and `docs/skill-format.md` § 4.6 in the HappySkills source repo (not bundled with this skill).

   **Post-install manual setup — `setupGuide` (detect this proactively).** A required secret is only half the story: *how does the consumer obtain it?* When getting the credential needs **human-only steps the agent cannot do** — create a scoped API token in a provider dashboard, register an OAuth app, grant a lengthy permission list — attach a **`setupGuide`** (a path to a reference file that explains how) to that `env`/`config` entry:

   ```json
   "env": { "CLOUDFLARE_API_TOKEN": { "required": true, "secret": true,
            "setupGuide": "references/token-model.md",
            "verify": "node scripts/cf.js rest GET /user/tokens/verify" } }
   ```

   On install, when that required field is unset, the CLI emits `next_step.action: complete_manual_setup` pointing at the guide, so the agent walks the human through it (and re-surfaces until done). **As an author or reviewer, actively watch for this need:** whenever a skill declares a `required: true` **secret** — especially one obtained from a provider dashboard / console / OAuth flow — ask *"can the agent get this itself?"* If not, it wants a `setupGuide`. `validate` flags the common case (a required secret with no `setupGuide`, in a skill whose text mentions dashboards/tokens/OAuth) as an advisory warning — but you are the precision layer: when you detect it, **offer to research and draft the guide** (a provider's exact dashboard steps + required permissions), then wire `setupGuide` in. First automate whatever the agent *can* do; the guide covers only the irreducibly-human residue. Full contract: `docs/skill-format.md` § 4.6 in the HappySkills source repo (not bundled with this skill).

2. **Consumer-side read: embed this canonical snippet verbatim in your SKILL.md.** There is exactly **one** correct way to resolve config — follow it, do not invent your own. Identical wording in every skill is what keeps agents from re-deriving it (and getting it subtly wrong):

   > **Resolve configuration before using any default — there is one correct way; follow it, don't improvise.** Prefer `happyskills skills-config get <owner>/<name> --json`: it returns the merged non-secret `config`, the resolved `envFile`, the required-secret names, and a present/absent flag. If the CLI is unavailable, do the **same** resolution by hand, in this exact order:
   >
   > 1. **Find the project root.** Search upward from your current directory for the nearest `skills-config.json` or `skills-lock.json`, stopping at a `.git` boundary. That directory is the project root.
   > 2. **Read the config.** In that project root, read `skills-config.json` (then the global `~/.agents/skills-config.json`) under the key `<owner>/<name>`. Anything unset falls back to this skill's hardcoded defaults.
   > 2b. **ABSENT ≠ CORRUPT — never `catch { return null }`.** A *missing* `skills-config.json` legitimately means "nothing configured yet" → fall back to defaults. A file that *exists but does not parse* means the consumer's settings are **unreadable**, and quietly treating that as "nothing configured" is a silent failure: the skill runs with the wrong settings and reports success. **Stat the path first**: absent → defaults; present-but-unparseable → **throw**, naming the file and telling the user to run `npx -y happyskills skills-config validate --json` (which reports the exact line, column, and how to fix it) — and to repair it **in place**, never to delete it, because it holds every configured skill's settings.
   > 3. **Resolve `envFile` against the directory of the `skills-config.json` that declared it — NOT your current directory.** Use the project file's `envFile` if it declares one; otherwise the global file's. The `envFile` value (e.g. `./secrets/x.env`) is relative to the directory holding the `skills-config.json` it came from: a value from the project file resolves against the project root (step 1); a value from the global `~/.agents/skills-config.json` resolves against `~/.agents`. Join it to that directory to get the real path — never to the directory you happen to be running from. **This is the one step that is easy to get wrong: resolving it against your current working directory makes the skill work from the project root but fail from any subdirectory. Anchor it to the declaring config file's own directory and it works from anywhere.**
   > 4. **Never read a secret's value into your own context.** Do not `Read`, `cat`, `echo`, or open the `envFile` to inspect a secret, and never inline a secret into a `fetch`/`curl`/command string. The value must pass straight from the `.env` into the process that needs it: run the skill's script or CLI with the `envFile` loaded into that child process's environment (e.g. `set -a; . ./secrets/<skill>.env; set +a; <tool> …`, or a `scripts/*.mjs` that reads `process.env`), so that only the subprocess — never you — ever sees the token. An ambient environment variable of the same name takes precedence over the file.
   > 5. **Check presence, not value.** Use the `secretsPresent` flag from `skills-config get` to decide whether you can run (CLI-less, test that the variable is non-empty) — never print or echo it. If a required secret is missing, **STOP** and tell the user exactly which variable to set and in which file.

3. **Consumer-side write: `skills-config set` — never hand-edit the JSON.** When your skill (or its UI) needs to *persist* a setting — the user clicks "Save palette" — write it through the CLI. It is atomic, key-scoped and locked: every other skill's block, your other keys, and `envFile` all survive untouched, and a concurrent `install` cannot erase your write.

   ```bash
   # scalar
   npx -y happyskills skills-config set <owner>/<name> format --value a4 --json
   # object / array — the only way to set a structured field
   npx -y happyskills skills-config set <owner>/<name> theme --json-value '{"preset":"forest"}' --json
   # large value — pipe it rather than quoting it into a shell
   cat palettes.json | npx -y happyskills skills-config set <owner>/<name> palettes --json-value - --json
   # remove
   npx -y happyskills skills-config unset <owner>/<name> theme --json
   ```

   `set` writes the **whole key** — it does not deep-merge into the previous value. Do your own read-modify-write: `get`, change the one entry, `set` the result back.

   **Choose the scope deliberately.** By default the write lands in the project's `skills-config.json`. Two flags exist for when that is wrong, and picking the right one is a design decision, not a detail:

   | Flag | Writes to | Use when |
   |---|---|---|
   | *(none)* | The nearest project's `skills-config.json` | The setting is about **this project** |
   | `--global` | `~/.agents/skills-config.json` | The setting is about **this user** — brand colors, a default theme. It should follow them into every project, and it is the right answer for a tool launched from an arbitrary directory. |
   | `--root <dir>` | `<dir>/skills-config.json`, created if absent | You know the workspace root and the cwd is not a HappySkills project (a tool run via `npx` from anywhere) |

   **`set` refuses to write a key you declared `secret: true`** (`FORBIDDEN_FIELD`). That is not a limitation to work around — `skills-config.json` is committed, and a secret in it is a leak. Secrets go in the `envFile`, always.

   **The consumer file is checkable: `happyskills skills-config validate --json`.** It reports every problem with its exact location (the field path; for a syntax error the line, column, and the offending source line) and a `fix` for each — including a hard error if a declared secret has ended up in the committed file. Every read and write refuses with `VALIDATION_FAILED` while the file is corrupt, so a broken file fails loudly instead of silently resolving to "nothing configured". Point users at `validate` rather than at a text editor, and **never** repair it by deleting the file: it holds *every* skill's settings, not just yours.

4. **Design the skill so a subprocess — never the model — consumes the credential.** If your skill calls an authenticated API or CLI, ship a thin wrapper (as the `cloudflare` skill's `scripts/cf.js` and this repo's `database/migrate.js` both do): it reads the secret from its own `process.env`, uses it, and prints **only** results — the token's value never crosses the shell or the context boundary. The agent handles names and a present/absent check; the value stays inside the child process. This is the same secret-hiding contract the repo already applies to its own credentials — do not hand-roll a different one, and never let the agent bridge the `.env` and the API call by reading the value itself.

Reads and writes are both **CLI-preferred, file-fallback** — a skill stays portable and works with no CLI installed. The read fallback above is the **same** logic `skills-config get` runs; if you must write without the CLI, do what `set` does: read the file, replace only your own `<owner>/<name>` key, and write it back atomically (write a temp file, then rename) so a reader never sees a torn file and no other skill's block is disturbed. One recipe, two ways to reach it, never a bespoke resolver per skill. Secrets live only in the `.env` the `envFile` points at — never in `skills-config.json`, never in the skill folder (HappySkills already excludes `.env`).

---

## 12. Size Guidelines

| Skill Type | Target Size | Rule |
|---|---|---|
| Reference (knowledge only) | < 300 lines | Move details to `references/` |
| Task (workflow only) | < 300 lines | Each step should be a single line |
| Hybrid (both) | < 500 lines | Split into two skills if approaching limit |
| Supporting files | < 400 lines each | Split by topic if larger |

> Supporting files can be larger than SKILL.md because they only load on demand, not every invocation.

---

## 13. Skill Scoping & Locations

| Scope | Location | Who Can Use |
|---|---|---|
| Personal | `~/.claude/skills/` | You, across all projects |
| Project | `.claude/skills/` | Current project only |
| Enterprise | Managed settings | All org users |

**Precedence**: Enterprise > Personal > Project. When skill names conflict, higher priority wins.

**In monorepos**: Claude auto-discovers skills in parent directories. A skill in `packages/frontend/.claude/skills/` is available when editing files in that package.

---

## 14. Allowed Tools Syntax

```yaml
# Basic tools
allowed-tools: Read, Grep, Glob, Bash, Edit, Write

# With command restrictions
allowed-tools:
  - Bash(npm run *)
  - Bash(git commit *)
  - Read
  - Grep
```

Restricting to `Bash(npm run *)` means Claude can run `npm run test` but not arbitrary bash commands.

---

## 15. Context Budget for Descriptions

Claude allocates ~2% of its context window for all skill descriptions combined. If you have many skills:

- Descriptions that exceed the budget are excluded (least-used skills dropped first)
- Keep descriptions concise but keyword-rich — don't pad with filler
- Minimum budget: 16,000 characters (fallback)
- Override with `SLASH_COMMAND_TOOL_CHAR_BUDGET` env variable if needed

**Rule of thumb**: If you have 20+ skills, keep each description under 200 characters.

---

## 16. Testing Your Skill

### Verify Auto-Invocation

1. **Ask naturally**: Say something that should match your description
2. **Check if Claude loads the skill**: It should appear in the response context
3. **If not triggering**: Add more keywords to description that users would naturally say
4. **Use `/context`**: Run `/context` in Claude Code to see which skills are currently active

### Verify Manual Invocation

1. Run `/skill-name` and check that it loads
2. Run `/skill-name some arguments` and verify `$ARGUMENTS` substitution works
3. Check that `allowed-tools` grants the right permissions

### Common Debugging

| Symptom | Likely Cause | Fix |
|---|---|---|
| Skill never auto-invokes | No frontmatter or missing `description` field | Add YAML frontmatter with `name` and `description` |
| Skill never auto-invokes | Description too vague or missing trigger phrases | Add specific keywords users would say |
| Skill triggers for wrong requests | Description overlaps with another skill | Differentiate descriptions; narrow scope |
| Skill not in `/` menu | `user-invocable: false` is set | Remove the flag if user should invoke |
| Claude can't find skill | Wrong directory or naming | Check `.claude/skills/<name>/SKILL.md` path |
| Subagent mode fails | Missing `context: fork` or wrong `agent` type | Verify both fields are set correctly |

---

## 17. Sources

This document synthesizes guidance from the following authoritative sources:

| Source | URL | Covers |
|---|---|---|
| Agent Skills Specification | https://agentskills.io/specification | Directory structure, frontmatter fields, standard directories, progressive disclosure, file references |
| Agent Skills Best Practices | https://agentskills.io/skill-creation/best-practices | Context efficiency, progressive disclosure, conditional references, calibrating control |
| Claude Code Skills Documentation | https://code.claude.com/docs/en/skills | Skill locations, invocation control, supporting files, subagent execution, string substitutions |
| Anthropic Official Skills Repo | https://github.com/anthropics/skills | Reference implementations (skill-creator, pdf, docx, webapp-testing) |
