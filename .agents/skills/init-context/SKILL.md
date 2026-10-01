---
name: init-context
description: ProjectMemory — Load project docs into context at session start. Use when starting work on a project, asking how something works, or before any task in a documented area. Not for modifying or generating docs (update-doc / init-doc).
allowed-tools: Read, Grep, Glob, Bash
argument-hint: optional question or topic
---

You are being asked to load context about this project to help answer a specific question or explore a particular topic.

**IMPORTANT:**
**1. During the documentation loading phase (Steps 1–6), you are ONLY gathering information. DO NOT modify any files or make any changes during this phase.**
**2. Two files under `docs/` MUST be loaded regardless of the topic or question, if they exist:**
**   - `docs/gotchas.md` — critical project-specific pitfalls and edge cases (see [Step 3: Mandatory File Loading](#step-3-mandatory-file-loading) for hub+domain handling)**
**   - `docs/mission.md` — project vision, values, and decision-making compass**
**   These files contain foundational context that is always relevant. Step 3 below names them explicitly so they cannot be skipped.**

## Your Task

The user has provided this question or topic:
```
$ARGUMENTS
```

## Process: Recursive Documentation Discovery

Follow this iterative process to build up context:

### Step 1: Determine the project root

Before reading any documentation, determine the project root. All paths in this skill are relative to that root.

1. Run `git rev-parse --show-toplevel`. If it succeeds, use that path as the project root.
2. If the project is not a git repository (`git rev-parse` fails), assume the current working directory is the project root, and surface a one-line warning:
   > *"Not in a git repository — assuming the current directory is the project root. If this is incorrect, please re-invoke from the correct directory."*

This matches the procedure documented in the writer skills (init-doc, update-doc, init-mission) so all four skills agree on what "project root" means.

### Step 2: Read the README.md

Read the `README.md` file at the project root (if it exists). This is your entry point. Use it to understand:
1. What this project does
2. Its main features and capabilities
3. Links to other documentation files (the doc graph you will traverse in Steps 4–6)

If no `README.md` exists at the project root, proceed to Step 3 but flag it in the Step 7 doc-health line — the project is missing its documentation hub and the user may want to run `/init-doc`.

**Then load the retrieval index.** Run:

```
python3 "${CLAUDE_SKILL_DIR}/scripts/manifest-query.py" --root <project_root> --index
```

`${CLAUDE_SKILL_DIR}` resolves to this skill's installed directory at runtime — the script lives there, not in the user's project. Always pass `--root` with the project root you established in Step 1; without it the script re-derives the root itself and can disagree with the skill in a non-git checkout or a subdirectory invocation. This matches how every sibling skill invokes its script.

This reads the committed `doc-manifest.json` (at the project root) and prints the **lean index** — every doc's `path`, `description`, `tags`, `source` globs and cross-links, plus the gotchas format and, in a monorepo, the groups block. It omits only the fields recall never reads, which makes it roughly **a quarter the size** of the raw manifest with no loss of triage signal. Do **not** read `doc-manifest.json` directly when the script is available; the raw file is mostly per-doc heading dumps that exist for the maintenance skills, and loading them burns context this skill exists to conserve.

The index is the **index, not content**: loading it does not replace the mandatory *content* reads in Step 3 (`docs/mission.md`, the gotchas hub) — those are still read in full. It is what makes triage (Step 4) a single reasoning pass instead of a header-peek-per-file traversal. (Schema: [../init-doc/references/standards.md § Documentation Manifest](../init-doc/references/standards.md#documentation-manifest).)

**If the script cannot run** (no `python3`, script missing), read `doc-manifest.json` directly instead — same information, larger. Note it in the Step 7 doc-health line. If there is no manifest at all, fall back to the README-link triage in Step 4.

- **Trust it as-is.** The manifest is kept fresh by the producer skills and `project-memory` Inspect; do **not** re-scan the corpus to re-verify it — re-scanning would defeat its purpose. Freshness is their job, not recall's.
- **Stale-pointer caution.** If the manifest lists a node whose file does not exist on disk, do not silently trust it: flag the discrepancy in the Step 7 doc-health line and fall back to direct inspection for that entry only.
- **Low-confidence metadata.** Some nodes flag that their own header is unreliable — `parse_error` (frontmatter unparseable, so `description`/`tags` may be wrong or empty), `has_frontmatter: false` (no header at all — score by `headings`, not the null `description`), or `dangling: true` (the doc's `source` no longer resolves, so its code→doc map is stale). Don't rank these on `description`/`tags` alone: fall back to `headings`, and when one still looks relevant, open the file rather than trust the header. Surface any `dangling` doc you relied on in the Step 7 doc-health line.

### Step 3: Mandatory File Loading

Two files are loaded unconditionally before any topic-driven traversal, because they carry foundational context that applies regardless of the question:

#### 3a. Mission

If `docs/mission.md` exists, read it in full. This is the project's decision-making compass — vision, values, non-goals, users, UX compass. It should inform every subsequent decision in the conversation, even ones not obviously connected to "business context."

If `docs/mission.md` does not exist, flag it in the Step 7 doc-health line (the user can run `/init-mission` later) and move on.

#### 3b. Gotchas

Gotchas are project-specific pitfalls — things that WILL bite you if ignored. They must be loaded early and treated as high-priority warnings, not background documentation.

**Detection.** Determine which gotchas format this project uses:

**If the index was loaded (Step 2), read the format from its header** — `diagnostics.gotchas.format` is `hub+domain`, `monolithic`, or `missing`, computed deterministically. Trust it; do not re-scan. Fall back to the Glob detection below **only** when there was no index at all, or when the value is `unknown` (a legacy manifest with no diagnostics block):

1. **Check for `docs/gotchas/` directory** using Glob: `docs/gotchas/*.md`
2. **Check for `docs/gotchas.md`**

**Format A — Hub + Domain files** (the `docs/gotchas/` directory exists):

1. **Read the hub file** (`docs/gotchas.md`). This is a small index (~30–50 lines) listing all gotcha domains with descriptions and links to `docs/gotchas/<domain>.md` files. Always read it in full.
2. **Select relevant domain files**. From the hub, identify which `docs/gotchas/<domain>.md` files are relevant to the user's question/topic. Use the same frontmatter-first triage as Step 4 — gotchas domain files declare `source` for their subsystem, so when the user's work touches that subsystem's code, the `source` match flags the domain file to load (the strongest signal). Read only the relevant domain file(s).
3. **Leave the rest unloaded — silently.** Do not list the domain files you skipped in your output; [Step 8](#step-8-ongoing-progressive-documentation-loading) picks them up if the conversation moves into their subsystem. How it finds them depends on the branch you took above:
   - **With a manifest** — they are nodes in it. Match by `source` where they declare it; a source-blind producer (`refactor-doc` in structural mode) may leave `source` absent, in which case fall back to their `description`/`tags`.
   - **Without a manifest** (you reached Format A via the Glob fallback) — nothing on disk records which domains you skipped, so re-glob `docs/gotchas/*.md` and re-read the hub when work moves to a new area. Do not rely on having remembered them.

**Format B — Monolithic file** (no `docs/gotchas/` directory, only `docs/gotchas.md`):

Read `docs/gotchas.md` in full. This is the legacy format — the entire file is loaded regardless of size.

**Attention framing**: When you encounter gotchas content (from either format), treat each gotcha as a warning. These are not reference documentation — they are lessons learned from production incidents. Present them prominently under their own heading (Step 7, part 2), never buried inside the answer.

### Step 4: Triage candidate docs from the manifest

**When the index was loaded (Step 2), triage from it — a single reasoning pass over the whole corpus, not a header-peek per file.** Every row carries what the frontmatter header would tell you (`description`, `tags`, `source`) plus `links_to` and, in a monorepo, its `group` — so you can score every doc at once without opening any of them. `headings` rides along only for rows carrying a `!` flag, where the header is unreliable and headings are the only signal left; for every other row `description`/`tags` outrank it, so it is omitted deliberately. **Do not go read `doc-manifest.json` to recover them** — that re-read is exactly what Step 2 avoids.

**(Monorepo) Scope by group first.** If the manifest has a `groups` block, decide which group(s) the user's question/topic belongs to — by the code area it names (match against each group's `roots`) or by sub-project name — and **restrict triage to nodes in those group(s)** before per-doc scoring. This prunes unrelated sub-projects up front. Widen to other groups only if the in-group docs don't answer the topic. **Exception — cross-cutting concerns:** when the question is about a theme that deliberately spans sub-projects (e.g. `auth`, `security`, `logging`), don't let group-scoping prune it — also scan **all** groups for nodes whose `tags` match the theme. `tags` is the cross-cutting axis that `group`/`source` intentionally don't capture (see [../init-doc/references/standards.md § Groups](../init-doc/references/standards.md#groups)).

**Score each candidate node in this priority order — do not skip signal 1:**

1. **`source` match — the strongest signal, check it first.** Look at what the user's question/topic is actually about: does it name a file, directory, or code area, either explicitly (`src/billing/charge.ts`) or by concept ("billing", "the auth service", "the deploy pipeline")? If a node's `source` globs cover that area, it is almost certainly one to load — `source` is the precise code→doc map (see [../init-doc/references/standards.md § `source` semantics](../init-doc/references/standards.md#source-semantics)), so a `source` hit is a near-certain match, not a guess. This is exactly why `source` exists; lead with it.
2. **`description` / `tags`.** Semantic match between the node's summary/labels and the question/topic.
3. **`headings` or README link text.** Fallback only for nodes that carry no frontmatter — link text can drift, so the frontmatter signals above override it when present.

A node that scores relevant on any signal goes on the reading list. When `source` or `description`/`tags` disagree with the README link text, trust the manifest — it is derived from the docs and kept current by the writer skills.

**Fallback when there is no manifest.** If Step 2 found no `doc-manifest.json`, triage the legacy way: from the README, identify links to `docs/` files and read **only** each candidate's frontmatter header (the leading `---` block, not the body), scoring by the same 1‑2‑3 priority. Flag the missing manifest in the Step 7 doc-health line.

**Track what you've read:**
- Keep a mental list of all files you've already read to avoid infinite loops. `docs/mission.md` and the gotchas files loaded in Step 3 already count as read — don't re-load them.
- If a link points to a file you've already read, skip it.

### Step 5: Read relevant linked documentation

Read each relevant documentation file you identified. As you read each file:
1. Extract key information related to the user's question/topic
2. Look for MORE links to other documentation files within this document
3. Evaluate those new links for relevance (same criteria as Step 4)
4. Add relevant unread files to your reading list

### Step 6: Repeat recursively

**With a manifest, recursion is a fallback, not the primary path.** Manifest triage (Step 4) already saw the whole corpus at once, so your reading list is complete up front — you do not need to traverse the cross-link graph to *discover* relevant docs. Use the manifest's per-node `links_to` only to confirm you haven't missed a closely related doc, and add one if its node scores relevant. (When there is no manifest, cross-link traversal is the primary discovery mechanism — follow it fully.)

Continue the process:
- Read next relevant documentation file from your list
- Extract information and find new links (or, with a manifest, consult the node's `links_to`)
- Evaluate new links for relevance
- Read those relevant docs
- Keep going until you've exhausted all relevant documentation paths

**Important safeguards:**
- Never read the same file twice (check your tracking list)
- Stop when no new relevant documentation links are found
- Don't follow links that are clearly not relevant to the question/topic
- Limit to documentation files in the project (don't follow external URLs)
- Do not traverse into `docs/manual/` — that directory is human-authored content excluded from automated loading by framework convention

### Step 7: Respond

Your output has **at most four parts, in this order, and nothing else**. The first three are each conditional — omit any that does not apply, and in the common case you will omit the first. The answer always comes last, so it is the last thing on the user's screen.

**1. Doc health** — one line, **only** when something is actually broken.

Emit this only if a step above hit an anomaly: not a git repository (Step 1), no `README.md`, no `doc-manifest.json`, a manifest node whose file is missing, a `dangling` doc you relied on, or no `docs/mission.md`. This line is the *only* place such warnings appear — no step above emits its own. State the anomaly and the fix in a single line (e.g. *"No doc-manifest.json — triaged from README links; run `/init-doc` to generate one."*). When the docs are healthy, this part does not appear at all.

**2. Gotchas that bear on this** — omit the section entirely if none do.

Only the gotchas that actually touch the question, not everything you loaded. One line each, stated as a warning, under their own heading — never folded into the answer. These are lessons from production incidents, not reference material.

**3. Mission lens** — one line; omit if the mission does not bear on the question.

The single value or non-goal from `docs/mission.md` that should steer this work.

**4. The answer** — the bulk of the response, always last.

**Ground it in the corpus.** Name the doc a substantive claim rests on, inline and in passing (*"per `docs/deployment.md`…"*) — never as a trailing list of sources. If the answer is not in the documentation you loaded, say so plainly instead of filling the gap from general knowledge. This replaces the traceability the removed file list used to provide, at a fraction of the cost: an ungrounded answer that *looks* grounded is the exact failure this skill exists to prevent.

**Always end with a direct response to the prompt. This is unconditional — do not classify the prompt to decide whether to answer it.** What "answer" means simply follows the prompt's shape:

| The prompt was… | The last section is… |
|---|---|
| A question | The answer, grounded in what you just loaded |
| A topic or bare area name | A short orientation on that area: what it is, how it is structured, where the risk sits |
| An action request ("add endpoint X") | What you would do and why — **not done**. End with: *"Say go and I'll implement it."* |
| Empty | A short orientation on the project as a whole |

**Do not emit any of the following.** Each one wastes output tokens and buries the answer:

- **A list of files you read**, or why each was relevant. That is the skill's internals. The files are already in your context; narrating them tells the user nothing they can act on.
- **A "Documentation not yet loaded" index**, or a progressive-discovery reminder for unloaded gotcha domains. This is machine state, not user-facing information, and it does not belong in the output channel. You do not need it: [Step 8](#step-8-ongoing-progressive-documentation-loading) looks docs up by file path on demand, so there is no read-set to record.
- **A "Context loaded" confirmation**, or any *content-free* sign-off such as "ready for your next instruction". The answer is the last thing on screen; an empty closing line after it only hides it. (The action-request hand-off — *"Say go and I'll implement it."* — is not a sign-off. It is the operative last line of that answer, and it stays.)

### Step 8: Ongoing progressive documentation loading

**This step applies for the entire conversation, not just this turn.** It is what lets the initial load stay small: you do not have to load everything now, because you will load the rest exactly when it becomes relevant.

**The trigger is an action you take, never a judgment you make.**

> **Before your first `Edit` or `Write` to any file this session, run:**
> ```
> python3 "${CLAUDE_SKILL_DIR}/scripts/manifest-query.py" --root <project_root> --affects <path>
> ```
> **Read every doc it names that you have not already read. Then make the change.**

**Why an action and not a judgment.** Earlier versions of this skill asked you to notice when the conversation had moved to a new area, and *then* check. That fails silently and by construction: not having noticed something is self-concealing — the very state you would need to detect is the state that prevents you detecting it. Editing a file is different. It is something you are unambiguously about to do, so the trigger cannot be missed, and the answer comes from a command rather than from recall.

**Why `Edit`/`Write` and not `Read`.** In a typical corpus roughly half of all source files are covered by some doc, so firing on every file you open would flood the context with documentation — the exact waste this skill exists to prevent. Firing on the first *modification* is rare, and lands precisely where being wrong is expensive.

**You do not need to track what you have already read.** The lookup answers "what documents this file?", not "what have you missed?". If it names a doc you have read, skip it; if you have forgotten, re-reading costs one cheap read. There is no ledger to maintain and no complement to compute — that is why nothing about the read-set appears in your Step 7 output.

**Load on demand outside edits too.** The same lookup applies whenever work turns toward unfamiliar code — the user names a path, you grep into a subsystem you have not touched, or a stack trace points somewhere new. Run it on that path.

**Do not ask permission to load a doc.** Read it and carry on; this is expected behavior, not a decision for the user.

**Make a miss visible.** If the lookup names a doc and you proceed *without* reading it, say so in one line. A skipped load that nobody sees never gets corrected.

**When unsure, load it.** Reading one unnecessary doc is cheap. Missing a gotcha is not.

**Degraded paths.**
- **Script unavailable** (no `python3`, script missing) — match the path yourself against the `source` globs in the index you loaded in Step 2. Same rule, done by hand.
- **No manifest at all** — re-read the project `README.md`, and for the area you are about to touch, peek the frontmatter of the `docs/` files it links. Less precise and it costs a re-read, but **do not skip this step because the manifest is missing**: a project with no manifest is more likely, not less, to hold documentation you have not seen.

### Step 9: Never act — no exceptions

This turn is read-only end to end — Steps 1–6 gather, Step 7 responds, and neither writes anything. Reaching the end of Step 7 means you have *answered* the prompt, not started work on it. **Stop there.** This is unconditional.

**It applies regardless of how the prompt is phrased.** Even if the prompt looks like a clear, unambiguous action request ("add endpoint X", "fix bug Y", "run command Z and check output"), you MUST NOT implement it in the same turn as the context load. Describe what you would do (Step 7, part 4) and wait for the user to say go.

**Concretely:** use only read-only tools — the same ones Steps 1–6 require (Read, Grep, Glob, and read-only commands such as the `git rev-parse` in Step 1). Do not edit, create, or delete files. Do not run any command that changes state.

**Why this is non-negotiable:**
- Confident-sounding action prompts are exactly where unloaded gotchas cause the most damage. The more concrete the task, the stronger your prior that "I don't need the docs" — and that prior is usually wrong.
- **Never let a judgment about the prompt change what you load, and never let one license action.** A rule of the form "*if* this is an action request, skip ahead and implement" is the specific failure mode this step exists to defeat. Deciding up front that you will implement contaminates the load behind it: you triage toward the plan you already hold, read fewer docs, and skip gotchas that do not fit it.

  To be precise, since Step 7 does read the prompt's shape: the prohibited branch is one that runs **before or during the load**, or whose arms differ in **whether you act**. Step 7's table is neither — it runs after the load is complete, it changes only the *shape* of a response that is produced unconditionally, and every one of its rows stops short of acting. **Answering is safe because it is downstream of the load; acting is not.** That distinction is the whole design — if you are editing this skill, preserve it rather than resolving the apparent tension by loosening this rule.
- A single extra turn is cheap. Skipping context to look responsive is not.

---

## Example Process Flow

```
User question: "How does the deployment pipeline work?"

1  Root      → git rev-parse --show-toplevel → /Users/dev/myproject

2  Index     → Read README.md.
              → python3 "${CLAUDE_SKILL_DIR}/scripts/manifest-query.py" --root . --index
                One lean record set: path :: description :: tags :: source :: links,
                plus "gotchas format: hub+domain". Trust it; do not re-scan.

3  Mandatory → docs/mission.md in full ("reliable infra over fast iteration").
              → docs/gotchas.md hub in full. Format came from the index, no re-globbing.
                gotchas/deployment.md source [deploy/**, .github/workflows/**] → match → read.
                gotchas/database.md [db/**], gotchas/frontend.md [web/**] → no match →
                leave unloaded, silently. Step 8 will find them by path if needed.

4  Triage    → Score every index row at once: source → description/tags → headings.
                docs/deployment.md   [deploy/**, .github/workflows/**]  → source match ✓
                docs/architecture.md "...incl. the deploy pipeline"      → description ✓
                docs/api.md [src/api/**], docs/data-model.md [db/**]     → no match ✗

5-6 Read      → docs/deployment.md, docs/architecture.md. Check their links_to;
                nothing new scores relevant, so stop.

7  Respond   → Doc health: omitted, nothing was broken.
              → Deployment gotchas, as warnings.
              → Mission lens, one line.
              → THE ANSWER — the bulk of the response, and the last thing on screen.
                Nothing after it: no file list, no unloaded-docs index, no sign-off.

9  Never act → It was a question, so answering completes the turn. Had it been
                "add a deploy step for X", the turn would end with the plan and
                "Say go and I'll implement it." — never the edit.

--- Later in the session, Step 8 fires -------------------------------------------

   User: "Add a table to db/schema.sql"
   → About to Edit a file → run the lookup FIRST, before touching it:

       python3 "${CLAUDE_SKILL_DIR}/scripts/manifest-query.py" --root . --affects db/schema.sql

       db/schema.sql -> docs/data-model.md, docs/gotchas/database.md
       READ THESE: docs/data-model.md, docs/gotchas/database.md

   → Read both, then edit. Note what did NOT happen: no "have I changed topic?"
     judgment, no recall of what was loaded hours ago, no ledger. The edit itself
     was the trigger, and a command gave the answer.
```

Remember: Steps 1–6 are a context-loading phase — no modifications during documentation discovery. Step 7 always ends with a direct answer to the prompt and nothing after it. Step 8 keeps loading docs for the rest of the session, triggered by the files you are about to change rather than by noticing a topic shift. Step 9 never acts on the prompt, regardless of how it was phrased.
