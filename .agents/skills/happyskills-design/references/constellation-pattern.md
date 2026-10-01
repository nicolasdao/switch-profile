# The Constellation Pattern — Operational Reference

This document is the operational guide for applying the **Constellation Pattern** when designing or refactoring HappySkills skills. It is loaded on demand by `happyskills-design` when a user is decomposing a mega-skill, planning a multi-skill product, or auditing a skill suspected of being a mega-skill.

This reference focuses on **what to do**, not **why it works**. The canonical, citation-grade explanation of the pattern (full reasoning, failure-mode analysis, academic references) lives in `docs/cli-skill.md` in the HappySkills source repo — it is **not bundled with this skill**, so treat it as external background you cannot load at runtime, not a file to read on demand.

---

## 1. What the Constellation Pattern Is

The **Constellation Pattern** is the canonical way to overcome the **mega-skill problem** in AI agent skill ecosystems. Instead of letting one skill grow until its 1024-character description can no longer reliably trigger every capability it owns, you decompose the skill into a coordinated **constellation**:

- **One core skill** — a slim entry point owning the highest-frequency lifecycle verbs.
- **Satellite skills** — one per focused verb cluster (e.g., publishing, syncing, designing, collaborating).
- **Dependency-as-bundle** — the core declares the satellites as hard dependencies in its `skill.json`, so installing the core installs the constellation.

Result: each member's description fits inside its own 250-character soft cap, routing precision per skill stays high, and the user still gets the "one product, one install" experience.

> **Naming.** "Constellation" is the formal noun for the architectural pattern; "family" is the informal everyday noun for the resulting group of skills. HappySkills itself ships as a nine-member constellation (a core plus eight satellites) — see `docs/cli-skill.md` in the HappySkills source repo (not bundled with this skill) for the reference implementation.

### 1.1 Shared secrets — `sharedEnv`

A constellation's members are facets of one product, so they typically share a **config/secret namespace** — one API token, one set of credentials. When they do, declare **`sharedEnv: true` on the core** (a top-level `skill.json` field). Installing the constellation then scaffolds a **single** `./secrets/<core>.env` for every member, instead of an identical secrets file per skill — which is redundant, and drift-prone to rotate (N copies of the same token to keep in sync).

- **Opt-in, and only on the core.** Absent the flag, each member scaffolds its own `.env` (unchanged behaviour). The core already owns the constellation identity (it declares the members as dependencies), so it is the single place to declare the intent — satellites declare nothing. This is deterministic: read the core's manifest, know the behaviour. Do **not** rely on auto-detection.
- **Kits never share.** `sharedEnv` is invalid on a kit (a validation error). A kit bundles *unrelated* skills, which keep isolated secrets — the kit-vs-constellation line is exactly the secret-sharing boundary.
- **Safe by construction.** A consumer-set `envFile` overrides the shared default; a satellite installed standalone still gets its own file; and install warns if two members declare the same secret name with a different type.

**Rule:** whenever the constellation members share any secret (the common case — e.g. a `cloudflare` core + `cloudflare-deploy`/`cloudflare-config` satellites all reading one `CLOUDFLARE_API_TOKEN`), set `sharedEnv: true` on the core. Full contract: `docs/skill-format.md` § 4.6 in the HappySkills source repo (not bundled with this skill).

## 2. The Load-Bearing Rule — Orthogonal Verb Ownership

**Rule:** in a skill constellation, every `<verb, object>` pair has exactly one owner. No two members of the constellation may both plausibly claim the same user intent.

This is the **load-bearing constraint** that makes the Constellation Pattern work. A constellation that decomposes a mega-skill but lets two members claim the same `<verb, object>` pair is not a constellation — it is a set of overlapping skills that will route worse than the mega-skill it replaced.

### 2.1 Failure mode — what happens without orthogonality

The LLM's auto-invocation is a selector over skill descriptions. When the user types a prompt, the model scores each available skill's description against the prompt and picks the best match. This selection is approximately a softmax over similarity scores — it is **not** a deterministic rule engine.

When two skills in the same constellation claim overlapping verbs and objects:

1. **Routing nondeterminism.** The same prompt routes to skill A on one run and skill B on the next. Users perceive this as "the skill is broken."
2. **Split probability mass.** Even when one skill wins, its win margin shrinks. A close runner-up means an unrelated third skill (or no skill) can occasionally take the slot. Routing accuracy degrades across the whole constellation, not just the conflicted pair.
3. **Wrong-skill execution.** When the loser fires instead of the winner, the user gets a skill that does not know how to handle their request.
4. **No-skill fallback.** When the LLM cannot break the tie confidently, it sometimes fires neither skill and answers from general knowledge — invisible to the user, who assumes the skill ran.
5. **Compounding regression with constellation growth.** Each new sibling adds N new potential overlaps. A constellation that tolerates one overlap at 4 members may collapse at 8.

### 2.2 How to achieve orthogonality

Three layers of enforcement, applied in order:

1. **Description anti-collision** (primary). Each member's `<Verb, Object>` pair is unique across the constellation. Where verbs must be shared, objects diverge. The `Not for` slot names the closest sibling's territory and redirects.
2. **Routing disambiguation in SKILL.md.** Every member's Section 1 routing table includes a "what NOT to handle here" subsection listing which sibling owns which verb and the trigger phrase to redirect with.
3. **No umbrella + atomic siblings.** A skill claiming the same verb at a broader scope than its sibling creates an unresolvable tie. The constellation must avoid this: either the umbrella absorbs the sibling, or the umbrella narrows its claim.

### 2.3 Worked example — the verb `update`

`update` is the most overloaded verb in the HappySkills constellation. Two members own it, separated by **object**:

| Skill | Owns `update` for | Object that disambiguates | Trigger phrase |
|---|---|---|---|
| `happyskills` (core) | Installed-skill lifecycle | `installed skills` | "update my installed skills", "refresh skills" |
| `happyskills-design` | Skill-content authoring | `skill content` | "update this skill based on session learnings" |

Each skill's `Not for` clause points at the other to redirect ambiguous prompts. Verb is the same; object makes the routing orthogonal.

### 2.4 The Canonical-Command Escape Hatch

The load-bearing rule (§2) optimizes for clean routing, but description-level orthogonality is not always achievable. Some user-facing questions live on a seam between two members' natural verb territories — both members can plausibly attract the prompt, and no amount of `Use when` or `Not for` tightening fully separates them.

For these cases, **the framework permits a scoped softening**: if two members would both attract the same user question, **both members may route that question to the same canonical CLI command.** Same question → same command from multiple skills is safe. Same question → different commands is not.

**The rule:**

1. **Pick the canonical command.** Decide which CLI command is the single right answer to the overlapping user question.
2. **Both routing tables point at it.** Each member's Section 1 routing table includes a row for the overlapping question, routing to the canonical command — even if the command lives in another member's natural domain.
3. **Document the cross-skill routing in a `Disambiguation rules` entry.** Name the overlap explicitly and explain why this question routes here.
4. **Each member's SKILL.md carries enough output-shape detail to format the command's response.** A member that routes to a sibling-flavored command still has to present the result — it cannot assume the agent already knows the response format.

**When this applies:**

| Situation | Apply the escape hatch? |
|---|---|
| Two members attract the same user question, AND the same single CLI command correctly answers it from either side | **Yes** — both route to that command |
| Two members attract the same user question, BUT each has a *different* command with subtly different semantics (e.g., overwrite vs merge) | **No** — force disambiguation through stricter triggers and Negatives. Do not let the wrong skill quietly run a different command |
| One skill is the obvious owner; the other rarely attracts the question | **No** — fix the description on the rarely-attracting side. The escape hatch is for irreducible overlap, not for compensating sloppy descriptions |

**Worked example — `check` (registry update query):**

The user question "are my skills outdated?" attracts both `happyskills` core (which owns the keyword "outdated" via its `check` command) and `happyskills-sync` (whose `status` command also reports an `outdated` value). The canonical answer is `check`. Both core and sync route the question to `check`. Sync's routing table carries a row for "outdated / up to date / what's new" → `check`, and sync's SKILL.md documents `check`'s output shape so it can present the result without falling back to `status`.

**What this escape hatch is not:**

- **Not feature duplication.** Sync does not reimplement `check`'s logic. It points at the same CLI command core does.
- **Not skill-to-skill handoff at runtime.** The framework still does not support automatic skill chaining. The "handoff" is just both members independently knowing the right command.
- **Not a license to abandon orthogonality.** The load-bearing rule still applies to every `<verb, object>` pair where it can. The escape hatch is reserved for pairs where it provably cannot.

## 3. The Five-Slot Description Grammar

Every member of a skill constellation uses the same structural description grammar:

```
<Domain> — <Verb(s)> <Object>. Use when <Triggers>. Not for <Negative>.
```

| Slot | Role | What goes here |
|---|---|---|
| **Domain** | Scope declaration — narrows the routing surface to the constellation's territory. Acts as both a brand anchor and a topical hard-filter. | The constellation's product name (`HappySkills`, `Stripe`, `Tiny-Gemini`). One token; casing matches the constellation's convention (CamelCase brand or kebab-case). Followed by an em-dash. *Edge case: a satellite whose routing surface is genuinely broader than the constellation's territory may drop the Domain — see [skill-authoring.md § "When to drop the Domain"](skill-authoring.md).* |
| **Verb(s)** | Primary routing signal. | One primary verb, optionally paired with closely related verbs. Imperative mood. |
| **Object** | The other half of the routing signal — same verb, different object often means a different skill. | What the verb operates on, with specificity. Vague objects (`things`, `data`) cause routing collisions. |
| **Triggers** | Concrete user-intent phrases the LLM should recognize as belonging here. | 3–5 short phrases naming concrete user intents. Use the user's vocabulary. |
| **Negative** | Explicit redirection away from sibling skills. | One short clause naming the verbs/intents that belong to a sibling. Effectively required in a constellation. |

### 3.1 Composition recipe

Author descriptions in slot order — each slot constrains the next:

1. **Domain.** Write the constellation/product name — usually mechanical for constellation members. Match the constellation's casing (CamelCase like `HappySkills`, kebab-case like `tiny-gemini`). One token, em-dash. If you're authoring a satellite whose routing surface is genuinely broader than the constellation's territory (rare — the satellite legitimately serves multiple topical contexts beyond the constellation's scope), consider dropping the Domain. See [skill-authoring.md § "When to drop the Domain"](skill-authoring.md).
2. **Verb(s).** Pick the *one* primary verb that names the dominant action. If you need three verbs, you probably have two skills.
3. **Object.** Name what the verb acts on, with specificity. If two siblings share a verb, the object is what makes routing orthogonal.
4. **Triggers.** List concrete user phrases that should fire this skill. Test each: would a sibling's description plausibly also match? If yes, tighten the trigger or add a Negative.
5. **Negative.** Name the closest sibling's territory and redirect. Skip only if the skill has no near-neighbors in the constellation (rare).

### 3.2 Annotated example — the HappySkills core (234 chars)

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

### 3.3 Bad vs good

| | Description | Why |
|---|---|---|
| ❌ Bad | `HappySkills — Manage skills and workspaces. Use when working with HappySkills.` | Vague verb (`manage`), vague object (`skills and workspaces`), tautological trigger, no Negative. Will fire on prompts owned by every sibling. |
| ✅ Good | `HappySkills — Install and update AI agent skills. Use when adding a skill to a project, listing installed skills, refreshing or removing them, signing in, or configuring HappySkills. Not for searching the registry or asking questions.` | Specific verbs, concrete object, user-vocabulary triggers, Negative redirects to the concierge. |

## 4. When to Apply the Constellation Pattern

| Situation | Apply Constellation Pattern? |
|---|---|
| Single-purpose skill, < 250-char description, no near-neighbors | No. A single focused skill is fine. The five-slot grammar still applies. |
| Description over the 250-char soft cap | Yes. This is the canonical decomposition signal. |
| Description names ≥ 4 distinct primary verbs | Yes. Each verb cluster wants its own home. |
| Triggers span unrelated user-intent domains (e.g., publish + invite + design) | Yes. These are different products inside one skill. |
| User reports the skill failing to fire on supported capabilities | Likely yes. Description has lost semantic clarity to keyword stuffing. |
| User wants to add a major new capability and the description is already at cap | Yes. Adding more keywords will not work — extract a satellite. |
| Two existing skills share a namespace and have overlapping verbs | Yes for the orthogonality check. May or may not require restructuring depending on overlap severity. |

If any of these apply, run the **Constellation Decomposition Workflow** from `references/workflows.md`.

## 5. Orthogonality Test — Before You Publish

Cross-member routing collisions hide in three layers. The test walks all three.

### 5.1 The three layers of the orthogonality surface

| Layer | What lives there | Why it matters |
|---|---|---|
| **L1: Front matter** | `<Domain> — <Verb> <Object>. Use when ... Not for ...` from each member's `description` | The LLM's primary routing input. Collisions here cause direct misroutes at session start. |
| **L2: Section 1 routing tables** | Every trigger keyword each member claims in its SKILL.md routing table, plus the disambiguation-rule block | Once a skill is invoked, its routing table decides what runs. Collisions here cause intra-skill misroutes that look like routing bugs but are authoring bugs. |
| **L3: Command names + output vocabulary** | The literal command names each skill exposes, plus status values, response keys, and aggregate field names in their JSON output | Shared output vocabulary (two commands both emitting `status: "outdated"`, for instance) becomes a routing signal the LLM uses for *interpretation*. Two members with the same status word for related-but-different states route ambiguous prompts non-deterministically. |

A collision at any layer is a routing risk. A keyword-clean L1 says nothing about L2 or L3.

### 5.2 The test

For each pair of members in your proposed constellation:

1. **Extract collision tuples at each layer.**
   - **L1:** `<Verb, Object>` pairs + every concrete intent in `Use when`.
   - **L2:** every trigger keyword in Section 1's routing table, plus every keyword in the `Disambiguation rules` block.
   - **L3:** every command name, every literal status value emitted, every aggregate field name, every status word the SKILL.md teaches the agent to interpret (e.g., entries in a Status Values table).
2. **Cross-compare.** For each pair across two members at each layer, ask: would a user prompt for one plausibly match the other? Would the same word appearing in both members' L3 outputs lead the LLM to conflate the commands' meanings? If yes at any layer, you have an overlap.
3. **Resolve.** Pick one of:
   - (a) **Narrow the object.** `Update skills` → `Update installed skills` vs `Update skill content`.
   - (b) **Rename the overlapping vocabulary.** If two commands emit the same status value for different states, rename one side (e.g., `outdated` → `remote-ahead`).
   - (c) **Add `Not for` clauses to both members** naming each other.
   - (d) **Apply the Canonical-Command Escape Hatch (§2.4)** if the overlap is irreducible and both members can correctly route to the same canonical command.
   - (e) **Merge** the two members if the split was artificial.
4. **Sanity-check with prompts.** Write 5 prompts the user might say and trace which member should fire. If you cannot predict deterministically, the LLM cannot either.

### 5.3 Automation status

A future enhancement of the validator (`cli/src/validation/skill_md_rules.js`) may automate L1 and L2 overlap detection across all members declared in a `dependencies` map — literal keyword overlap is mechanically checkable. **L3 overlap is partially checkable**: literal status-value collisions across commands can be flagged, but *semantic* overlap (same meaning, different words) is hard to catch statically. Until automation lands, this is a manual review step that the agent must run during the Constellation Decomposition Workflow and during Audit when siblings exist.

## 6. The Limits of Static Validation

The orthogonality test in §5 catches **literal** collisions at all three layers — shared keywords, shared command names, shared status values. It does **not** reliably catch **semantic** collisions: cases where two members claim non-overlapping vocabulary that nonetheless points at the same underlying user question.

**Example.** Sync's description claims "checking if a skill is modified". Core's claims "outdated" and "are my skills up to date". No literal keyword overlap. But an LLM softmax over these two descriptions routes the prompt "are my skills out of date?" non-deterministically — "out of date" is semantically close to both "modified" (sync) and "outdated" (core). A keyword-level test passes; the routing still fails.

Three responses, in order of increasing weight:

1. **Tighten descriptions toward unambiguous wording.** Replace "checking if a skill is modified" with "checking if your edits to a skill diverge from the registry" — closer to sync's actual semantic. Specificity at the source reduces the LLM's ambiguity budget.
2. **Apply the Canonical-Command Escape Hatch (§2.4)** for irreducible cases — accept the routing imperfection and let both members converge on the same canonical command for the overlapping question.
3. **Add a Confirm-Intent preamble to high-risk members.** A short opening section in the SKILL.md routing logic that re-checks the user's request against the skill's own owned `<verb, object>` pairs before doing work. If the match is poor, the skill refuses to act and names the right trigger phrase for the right sibling. **Use sparingly** — every skill paying this tax on every invocation is wasted budget. Reserve it for members with one or more near-neighbor siblings where description-level disambiguation has provably been insufficient (i.e., observed failures in production).

The Confirm-Intent preamble is the runtime safety net for what static validation cannot reach. It is not a substitute for orthogonal design — it is the explicit acknowledgment that some collisions are structurally invisible to keyword tests and need to be caught with more context than the description budget can carry.

## 7. Anti-Patterns to Reject

| Anti-pattern | Why it fails | Fix |
|---|---|---|
| One member's description names a verb that another member's description also names, with the same object | Routing collision per §2.1 | Apply §2.2 — narrow object, add Negatives, or merge. If irreducible, apply §2.4 |
| Umbrella member claims the same verb as one of its satellites at a broader scope | Unresolvable tie | Either absorb the satellite or narrow the umbrella |
| Two members differ only by synonym or tense (`Publish` vs `Ship`) | Synonyms are not orthogonal — LLMs match across them natively | Merge, or split by genuinely different objects |
| Constellation with no Negative clauses | Every member is at risk of firing on a sibling's prompt | Add Negative slot to every member that has at least one near-neighbor |
| New satellite added without orthogonality test | Silent regression — the constellation may have routed fine until the addition | Run §5 before publishing the new member |
| Member description > 250 chars even after decomposition | The "satellite" is itself a mega-skill | Decompose further |
| Two commands in different constellation members emit the same status value, response key, or aggregate field name for related-but-different states | The shared output vocabulary becomes an L3 routing signal the LLM uses for interpretation. Ambiguous prompts route non-deterministically to whichever skill the model ranks higher | Rename one side's vocabulary so the two commands' output domains never intersect on a single word. Example: `status: "outdated"` (registry-update sense) and `status: "outdated"` (divergence sub-state sense) must use different words |
| L1 description is clean of L2/L3 overlap, but Section 1 routing table or command output vocabulary still collides with a sibling | L2/L3 collisions are invisible to a front-matter-only test but cause the same misroute downstream | Run the §5 orthogonality test at **all three layers** when authoring or auditing a constellation. L1 cleanliness is necessary but not sufficient |
| Two members both claim the same user question AND each runs a different command with different semantics (e.g., overwrite vs merge) | The escape hatch in §2.4 does **not** cover this case — same question routed to different commands gives wrong answers half the time | Force disambiguation through stricter triggers and Negatives. Do not adopt the escape hatch for non-canonical-command overlaps |

## 8. Case Study — The `check` / `status` Collision

The first production failure of the HappySkills constellation, and the source of every refinement in §§2.4, 5, 6, and the new anti-pattern rows in §7. Documented here so future authors do not repeat the mistake.

### 8.1 The failure

An agent in a user project (13 skills installed via `skills-lock.json`) was asked **"which skills are out of date?"**. The agent routed to `happyskills-sync` and ran `npx happyskills status --json`. Two things went wrong:

1. **Status returned only 5 of the 13 skills.** A `__root__` filter in `cli/src/commands/status.js` was hiding transitive dependencies — including one (`happyskills-help`) that was actually `diverged`. The agent told the user "5 skills, all clean or outdated" when reality was "13 skills, one diverged with local edits the user had not yet seen."
2. **The agent picked the wrong command.** The right command for the question was `check` (core's canonical update-check command), not `status` (sync's divergence inspector). Both return a `status: "outdated"` value, so the agent had no signal that it had chosen the wrong tool.

### 8.2 The root-cause walkthrough across all three layers

| Layer | Audit result | Verdict |
|---|---|---|
| **L1: Front matter** | Core: `Install and update AI agent skills`. Sync: `Sync local skills with the remote registry`. Different verbs, different objects, mutual `Not for` clauses. | **Clean.** A keyword-level test on descriptions passes. |
| **L2: Section 1 routing tables** | Core claims keyword `"outdated"` → `check`. Sync claims `"is my skill modified"` → `status`. No literal keyword overlap. | **Clean at the literal level.** Hidden **semantic** collision: "out of date" is semantically equidistant from both claimed phrases. |
| **L3: Command output vocabulary** | Core's `check` emits `status: "outdated"` (registry-ahead sense). Sync's `status` ALSO emits `status: "outdated"` (divergence sub-state). | **Colliding.** Same word, two different states across two skills. This was the trap. |

The framework as documented before this case study would have audited L1 only — and passed the constellation. The collisions live at L2 (semantic) and L3 (literal output vocabulary). Both were invisible to the original orthogonality test.

### 8.3 The fix (applied, asymmetric)

1. **`cli/src/commands/status.js`** — dropped the `__root__` filter. Status now returns all skills in the lock file, matching the help text *"Show divergence status for installed skills."* (Independent correctness fix.)
2. **`happyskills-sync/SKILL.md`** — added a routing row, a disambiguation rule, a new Section 1.5 documenting `check`'s output shape, and a constraint clarification. Sync now routes "outdated / up to date / what's new" → `check`, applying the Canonical-Command Escape Hatch (§2.4). Core was **not** modified — the failure was one-directional and core's existing redirects for status-flavored questions are already correct.
3. **This document** — extended the orthogonality test to three layers (§5), added the escape hatch (§2.4), the static-validation limits (§6), and new anti-pattern rows in §7 for output-vocabulary collisions.

### 8.4 The framework lessons

1. **L1 cleanliness is necessary but not sufficient.** The orthogonality test must walk routing tables and output vocabulary too.
2. **Output vocabulary is part of the routing surface.** Status values, response keys, aggregate field names — all are LLM-visible interpretive signals that can collide across skills even when descriptions do not.
3. **Some collisions are irreducible.** When the user's question is semantically equidistant from two members' natural territories, the right move is not to force orthogonality — it is to admit the overlap and route both members to the same canonical command (§2.4).
4. **Fix asymmetric failures asymmetrically.** Do not pre-patch the unobserved direction. Each side of a sibling pair earns disambiguation content by demonstrating a routing failure first; speculative two-sided fixes double the maintenance with no evidence of benefit.
5. **Skills are routing/UX layers; CLI commands are flat primitives.** A skill may recommend any command, including one in a sibling's natural domain, when that command is the canonical answer. The Constellation Pattern governs *who claims user intent*, not *who can invoke which CLI command*.

## 9. Hand-off

- For the full procedural workflow that uses this reference (the 8-step Constellation Decomposition Workflow), see `references/workflows.md`.
- For description format mechanics (validator-forbidden characters, em-dash vs colon, length budgets, anti-patterns at the single-skill level), see `references/skill-authoring.md`.
- For HappySkills-specific conventions (skill.json shape, dependencies, naming, keywords), see `references/happyskills-conventions.md`.
- For the canonical/citation-grade explanation of why the Constellation Pattern works (academic references, the full failure-mode analysis, the reference implementation), see `docs/cli-skill.md` in the HappySkills source repo (not bundled with this skill).
