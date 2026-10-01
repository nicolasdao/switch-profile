---
name: project-memory
description: ProjectMemory — Set up and query persistent project memory for AI coding agents. Use when adding project memory to a codebase or looking up project info. Not for writing docs (init-doc, update-doc, refactor-doc) or session recall (init-context).
allowed-tools: Read, Grep, Glob, Bash
argument-hint: "[question, topic, or set-up/inspect/status]"
---

# Project Memory

**Perpetual, project-scoped memory for AI coding agents.** Project Memory is the entry point and orchestrator for a constellation of skills that gives Claude Code, Cursor, Codex, and other AI agents a persistent, current, project-bound long-term memory — defeating LLM amnesia, context rot, and hallucination at the project scope.

This skill is the **core** of a constellation. It does not write documentation itself — it sets up, orchestrates, routes, inspects, and queries. The actual work of writing, restructuring, maintaining, and recalling documentation is owned by five satellite skills (see [The Constellation](#the-constellation) below).

---

## North Star

This is the constellation's root purpose — the section every other one below elaborates, and the lens every design decision must serve. *(When asked "what is the North Star / the mission?", answer from here.)*

### Ultimate mission

Give a codebase a ***great*** memory of itself — durable, true, meaningful, and lean — built **for the agent that operates on it**. Any AI agent should be able to load it cold and trust it without re-verifying, then work on a project it has never "seen" with **absolute efficiency, effectiveness, and accuracy**. The human is the **intent owner** — they set direction and hold authority — but are *not* required to understand the implementation; the agent is their interface to it (ask-and-clarify, on demand).

A great memory works at two altitudes:

- **The floor — never lose the thread.** Understanding never resets; it *compounds* across every session, agent, and year, defeating amnesia, rot, and hallucination. *(Compounding means accumulating **signal faster than noise** — which requires forgetting the obsolete on purpose, not just adding.)*
- **The ceiling — turn clarity into leverage.** *Because* the memory is lean and legible, it returns the agent's scarcest resource — **attention** — to the real problem and makes the whole structure visible at once. So it doesn't only prevent mistakes; it **surfaces opportunities** the noise would bury: the latent refactor, the hidden design flaw, the feature the mission implies but no one built, the better way to re-conceive what exists.

The floor earns the ceiling — you can only trust an opportunity surfaced by a memory you can trust. The deepest purpose sits at the top: not remembering the past but **foresight** — clarifying the present clearly enough to *see, and build, a better future.*

The inversion that makes all of this possible: **the memory lives in the project, not the agent.** Agents are stateless, interchangeable operators; the project is the durable substrate that remembers for them — and, done well, learns to *see*.

### The strategy — ten tenets

Tenets **1–7 build the floor** (a memory worth trusting); **8 is the bridge** (trust → foresight); **9–10 keep it great and keep it used** over the project's whole life.

1. **Memory is living documentation in the repo, agent-first** — plain-text and versioned, not an opaque database.
2. **Bound to the code and continuously reconciled** — it tracks ground truth, never a fossilized snapshot.
3. **Deterministic for the mechanical, the LLM only for irreducible judgment; derive, never duplicate.**
4. **Capture the meaning code can't express; never fabricate** — prefer honest absence to plausible invention.
5. **Spend context like it's scarce** — index first, load least, load precise.
6. **Structure is a maintained, re-architectable artifact** — re-derive the shape from source when it ages; never a one-time decision.
7. **Operate under the human's intent and authority** — the human owns the *why* and approves consequential, irreversible change; the agent owns the *how* and is the human's interface to understanding. Change only provably and reversibly.
8. **Optimize for legibility and connection, not just capture** — a memory you can *see across and reason over whole*, because opportunities live in the connections, not the isolated facts. *(The bridge from floor to ceiling.)*
9. **Forget well — curate as deliberately as you capture** — prune the obsolete (dead structure, dangling docs, reversed decisions) so signal isn't drowned. A memory that only grows becomes the fog it was meant to dispel.
10. **Be the path of least resistance** — *cheaper to trust than to re-derive, cheaper to maintain than to let rot.* A memory that isn't used is worse than none; usage is the test, friction is the enemy.

### Use it as the lens

A change is on the North Star only if it makes the memory more **trustworthy** (durable/true/meaningful/safe), more **reasoning-fit** (lean/legible/connected), or more **alive** (used/current/pruned) — and helps the agent's understanding *compound into foresight*. Anything that crosses a tenet's bright line — fabrication, hand-edited derived artifacts, drift from code, ungated mutation, opaque storage, unbounded growth, or friction that drives the memory toward disuse — is off the North Star, however clever.

---

## Identity & Positioning

### What Project Memory is

A constellation of six skills (`project-memory`, `init-doc`, `update-doc`, `refactor-doc`, `init-context`, `init-mission`) that gives AI coding agents perpetual project memory through **living documentation** that the agent maintains and recalls itself. The skills enforce a structural contract (README hub + `docs/` topic files + hub+domain gotchas + linked TOCs + size guardrails) so that the docs are *machine-readable, machine-maintained, and machine-recallable* — not just human-readable artifacts.

The brand promise:

> **Install once. Run recall at session start, maintain at session end. Your AI agent will never make up a function name or forget what you decided yesterday.**

### What Project Memory is not

It is not a personal knowledge base. It is not a research notebook. It is not a wiki you browse. It is **project-scoped working memory for one codebase**, optimized for engineering use — not curiosity, not multi-topic exploration.

### How it differs from Karpathy's LLM Wiki

Andrej Karpathy popularized the "LLM Wiki" concept in early 2026 — a personal knowledge base spanning many research topics, built and maintained by an LLM, stored as markdown the LLM can recall. Project Memory borrows the *idea* of LLM-readable, LLM-maintained documentation, but applies it to a fundamentally different scope.

| Karpathy's LLM Wiki | Project Memory |
|---|---|
| Personal knowledge base | Project-scoped memory for one codebase |
| Spans many research topics | One project, deeply known |
| Obsidian-flavored, browse-oriented | Filesystem-native, task-driven |
| User maintains the wiki | Agent maintains the docs (via `update-doc`) |
| For research, curiosity, multi-topic synthesis | For engineering, production code, one codebase |
| Optimized for cross-topic linking | Optimized for single-concern coherence (750-line cap per file) |

These are complementary patterns, not competitors. A serious engineer might use both: an LLM Wiki for cross-project research notes; Project Memory for the codebase they ship for a living.

---

## The Six Failure Modes (and the Mechanisms That Defeat Them)

The reason Project Memory exists is to defeat six concrete failure modes that plague AI coding agents working on real codebases. Each failure mode maps to a specific satellite or structural invariant:

| Failure Mode | What goes wrong | Defeated by |
|---|---|---|
| **Session amnesia** | The agent forgets your project's structure, conventions, and decisions between sessions. Re-asks questions it answered yesterday. | `init-context` loads README + mandatory files (`docs/mission.md` + `docs/gotchas.md`) + question-relevant topic docs at every session start |
| **Context rot** | In long sessions, the agent drifts from established patterns as the conversation gets longer. Forgets what was decided 20 turns ago. | Single-concern docs (750-line cap per file) keep relevant context dense and re-loadable on demand |
| **Hallucination from absent context** | The agent invents function names, file paths, conventions, or API signatures because the relevant doc was never loaded. | Recursive doc traversal in `init-context` grounds the agent in real project structure; core's Query procedure cites sources |
| **Stale documentation** | Docs decay because no one updates them. By month 3 they describe code that no longer exists. | `update-doc` is run at session end (workflow contract); its sub-agent diagnostic detects stale numeric claims, dead file references, drifted TOCs |
| **Lost institutional knowledge** | Production lessons, deployment quirks, framework idiosyncrasies — captured in incidents but never written down. Next engineer repeats the mistake. | `docs/gotchas/` hub+domain format — every subsystem gets a domain file; `update-doc` adds new gotchas as they emerge |
| **Inconsistent decisions across sessions** | Different sessions make different calls on similar tradeoffs. No through-line. | `docs/mission.md` (created by `init-mission`) provides a stable decision-making compass — vision, values, non-goals, users, UX — that `init-context` always loads |

These six failure modes are the **lens** through which Project Memory operates. If a request does not implicate one of these failures, it is probably not a Project Memory concern. (This is the *symptom-level* view of the deeper, principle-level lens in [§ North Star](#north-star) — the failure modes are what goes wrong; the North Star is what we are *for*.)

---

## The Constellation

Project Memory ships as one core skill plus five satellite skills, each owning one orthogonal verb. The core (`project-memory`) does no writing — it orchestrates, routes, inspects, and queries. The satellites do the actual work.

### Core skill

- **`nicolasdao/project-memory`** — this skill. Entry point, identity, workflow contract, routing, query, inspect.

### Bootstrap satellites (one-time setup)

- **`nicolasdao/init-doc`** — **Bootstrap** verb. Generates the README hub + `docs/` folder from source code analysis. Used when a project has no docs, has legacy docs to replace, or needs a fresh documentation baseline. Invokes `init-mission` transitively. Since **1.10.0** it also runs **session-native** — when the *same* session created the project, it documents from the session rather than re-scanning, which is the only way the reasoning behind the build (rejected alternatives, errors hit) survives the session closing.

- **`nicolasdao/init-mission`** — **Compass** verb. Interviews the user to produce `docs/mission.md` — vision, values, non-goals, users, UX compass. Loaded in every session by `init-context` as the decision-making lens. Transitively used by `init-doc`.

### Maintenance satellites (ongoing lifecycle)

- **`nicolasdao/update-doc`** — **Maintain** verb. Syncs documentation to code changes after a coding session. Sub-agent diagnostic detects drift; deterministic gotchas hub regeneration; single-concern guardrails enforced.

- **`nicolasdao/refactor-doc`** — **Refactor** verb. Restructures existing documentation without source code analysis — splits oversized files, converts monolithic gotchas to hub+domain, strips legacy TOCs, repairs cross-links. Triggered when docs grow beyond the structural contract.

### Session satellite (every session start)

- **`nicolasdao/init-context`** — **Recall** verb. Loads README + mandatory files (`docs/mission.md`, `docs/gotchas.md`) + question-relevant topic docs into the agent's working context. The first thing run at every session start. Defeats LLM amnesia.

---

## The Workflow Contract

Project Memory imposes a non-negotiable lifecycle that every session must follow:

```
┌──────────────────┐        ┌─────────────────┐        ┌──────────────────┐
│ Session start    │  ───►  │ Work (any task) │  ───►  │ Session end      │
│ Run /init-context│        │                 │        │ Run /update-doc  │
└──────────────────┘        └─────────────────┘        └──────────────────┘
         ▲                                                       │
         └───────────────────────────────────────────────────────┘
                            (loops every session)
```

### Why the contract is non-negotiable

The contract is the load-bearing piece of the whole system. Each side is required:

- **Recall at start (`init-context`)**: without this, the agent operates blind. It has no project mission, no gotchas, no conventions — exactly the conditions that cause amnesia and hallucination.
- **Maintain at end (`update-doc`)**: without this, the docs decay. By session 10, the documentation describes a project that no longer exists. The contract is what makes the docs *living*, not artifacts.

The system fails silently if either side is skipped. The user takes responsibility for the discipline — there is no automated enforcement, by design (a human in the loop is part of the project's philosophy).

### When recall is needed mid-session

As work moves into code that was not covered by the initial recall, `init-context`'s "Ongoing progressive documentation loading" rule (its Step 8, **≥ 1.10.0**) applies: immediately before the first `Edit`/`Write` to any file, the agent looks that path up against the docs' `source` globs and reads any match before proceeding, without asking permission. Earlier versions triggered on the agent *noticing* a topic shift; that was replaced because it fired unreliably.

---

## Routing Table

When a user invokes `/project-memory` (or speaks an intent the core matches), use this table to route to the right satellite or core procedure:

| User intent / phrasing | Route to | Reason |
|---|---|---|
| *"set up project memory"* / *"add project memory to this codebase"* / *"give my AI agent persistent memory"* | `/init-doc` (transitively invokes `/init-mission`) | Bootstrap — generate README + docs/ from source |
| *"document what we just built"* / *"write the docs before we close this session"* / *"capture what we did while building this"* — where **this session created the project** | `/init-doc` (session-native mode) | Bootstrap from the session — the build's reasoning is in context and nowhere on disk. Route here even when a scaffolder already left a `README.md` |
| *"create a mission document"* / *"add a decision-making compass"* / *"capture project vision"* | `/init-mission` | Compass-only flow when docs already exist |
| *"load context"* / *"what does this project do?"* / starting any new work session | `/init-context` | Recall — load docs into working context |
| *"update docs"* / *"remember what I did this session"* / *"sync docs to code"* / end-of-session | `/update-doc` | Maintain — sync docs to code changes |
| *"my docs are messy"* / *"this docs file is too big"* / *"convert monolithic gotchas to hub plus domain"* / *"TOCs are out of sync"* | `/refactor-doc` | Restructure existing docs without source read |
| *"where is function X defined?"* / *"what is our convention for Y?"* / *"which file owns Z?"* / *"find the doc that covers W"* | Core's Query procedure ([Section: Query Procedure](#query-procedure)) | Named-entity lookup with citations. For broad "how does X work" recall, prefer `/init-context`. |
| *"is my project memory set up correctly?"* / *"check the state of docs"* / *"are my docs fresh?"* / *"has my doc structure gone stale / does the graph need re-architecting?"* | Core's Inspect procedure ([Section: Inspect Procedure](#inspect-procedure)) | State check (incl. structural-drift detection) |
| *"what is project memory?"* / *"how does this system work?"* / *"what is the North Star / the mission?"* / *"explain the workflow"* | Core's body (this file) — esp. [§ North Star](#north-star) | Education / identity |
| *"I do not know which doc skill to use"* | Core's routing — match user phrasing to this table | Disambiguation |

**Routing principle:** if the intent is a *direct* satellite action (bootstrap, recall, maintain, refactor, compass), invoke the satellite directly. The core handles *ambiguous*, *meta*, *query*, and *inspect* intents.

---

## Set-Up Procedure

When a user wants to set up Project Memory for a project that has no documentation yet (or has docs the user wants to replace):

1. **Determine the project root** via `git rev-parse --show-toplevel`. If not a git repo, use the current working directory and warn the user.
2. **Check current state**: look for `README.md` at the root, `docs/` directory, `docs/mission.md`, `docs/gotchas.md`, `docs/gotchas/`, and `doc-manifest.json`. Report what exists.
3. **Recommend the right entry point**:
   - **This session created the project** → recommend `/init-doc`, which runs **session-native**. This branch takes precedence over every state check below, because they misroute here: a scaffolder routinely leaves a `README.md` behind, which matches the "README exists" branch and would send a birth session to `/init-mission` — losing the build history the session is holding. init-doc still checks disk for existing docs itself and backs them up before replacing anything.
   - **No `README.md`, no `docs/`** → recommend `/init-doc` for full bootstrap. Inform the user that init-doc will optionally invoke `/init-mission` mid-flow for the mission document.
   - **`README.md` exists but no `docs/mission.md`** → recommend `/init-mission` to add the decision-making compass.
   - **Both exist but `docs/gotchas/` is monolithic and over 750 lines** → recommend `/refactor-doc` to convert to hub+domain.
   - **Structure exists but `doc-manifest.json` is missing** (a legacy corpus predating the manifest, or docs missing frontmatter) → recommend `/refactor-doc`, which detects the missing manifest as a modernization gap and generates it (backfilling any missing frontmatter along the way) even when no structural restructuring is needed. See [../init-doc/references/standards.md § Documentation Manifest](../init-doc/references/standards.md#documentation-manifest).
   - **All structural elements exist, including `doc-manifest.json`** → recommend `/init-context` to load existing docs into context and confirm the system is working.
4. **Invoke the recommended satellite** if the user confirms, or explain the workflow if the user is exploring.

---

## Query Procedure

When a user asks a specific question that should be answered from existing project documentation (and not from the agent's training knowledge or general reasoning), follow this **lazy progressive disclosure** procedure. The goal is to answer the question with **minimum context load and zero hallucination**, citing the exact files the answer came from.

### Procedure

1. **Determine the project root** via `git rev-parse --show-toplevel` (with CWD fallback and warning if not git).
2. **Load the index — `doc-manifest.json`.** Read the manifest if it exists: it is the derived machine index and Query's lookup table — every doc's `description`, `tags`, `source`, `group`, headings, and cross-links in one place (see [§ Documentation Manifest](../init-doc/references/standards.md#documentation-manifest)). Reason over it to pick the answer's source doc(s) without opening anything. If the manifest is **absent**, fall back to reading `README.md` only and using its Documentation links as the index. Either way, do not load any `docs/` body yet.
3. **Find candidate docs in the index.** From the manifest's `nodes` (or, in fallback, the README's links), select the docs whose subject matches the question.
4. **Score relevance**, reasoning over the manifest records (or, in fallback, reading candidate frontmatter headers in preference to README link text):
   - **If the question names a file, directory, or code area** — e.g. *"which doc covers `src/auth`?"*, *"where do we handle billing?"* — match that path or area against each node's `source` globs. The doc whose `source` covers it is the owner: the most precise possible hit, and the **primary** signal for "which file/doc owns X" questions (see [§ `source` semantics](../init-doc/references/standards.md#source-semantics)). `source` globs are file/directory patterns, so this works on a path or a named area — **not** on a bare symbol. (In a monorepo, the node's `group` further narrows which sub-project owns it.)
   - **If the question names a bare code symbol** (a function or class name with no path, e.g. *"where is `validateToken` defined?"*) — you cannot glob-match a symbol against `source`. Score by `description`/`tags` to find the doc whose subject most likely contains it; the exact location then comes from that doc's body (or, if the docs do not pin it, a code search).
   - **Otherwise** score by the node's `description`/`tags` (semantic match to the question topic), falling back to README link text for docs with no frontmatter.

   Pick the highest-relevance doc (or top 2 if equally relevant).
5. **Read only the selected linked files.** Do not load files that are not relevant to this specific question.
6. **If the answer is in the selected files** — synthesize the answer and **cite the file paths** (e.g., *"per `docs/api.md` § Authentication, JWTs are validated in `src/auth/service.ts:42`"*). Stop.
7. **If the answer is not in the selected files** — follow one level of cross-links from the read files only if the next file is clearly relevant. **Stop at depth 2 maximum** — do not traverse the whole graph. If the answer is still not found, say so explicitly:

   > *"I could not find an answer to this question in the project documentation. The closest files are [list]. Would you like me to invoke `/init-context` for a broader recall, or `/update-doc` to capture this knowledge once you have an answer?"*

### Anti-hallucination rules for Query

- **Cite every claim.** Every answer must reference the file path (and ideally section anchor) it came from. Never paraphrase from the agent's training knowledge as if it came from the project docs.
- **Honest absence.** If the docs do not cover the topic, say so. Do not fabricate a plausible answer based on what similar projects might do.
- **Lazy loading.** Never load more than ~3-5 doc files for a single query. If the question requires more, escalate to `/init-context` instead.
- **No write operations.** Query is read-only. If the user question implies a doc update, recommend `/update-doc` after answering.

### Why Query is different from `init-context`

| | Core Query | init-context Recall |
|---|---|---|
| **When** | Mid-session, in response to a specific question | At session start; then again automatically before the first edit to any file (init-context Step 8) |
| **Scope** | Targeted — answer one question | Broad — prime the agent for working in an area |
| **Loading style** | Lazy — minimum needed (≤ 3-5 files) | Eager — README + mandatory (mission/gotchas) + relevant topic docs |
| **Output** | An answer with citations | An answer with citations, preceded by any relevant gotcha warnings |
| **Mandatory files** | None — only what answers the question | `docs/mission.md` + `docs/gotchas.md` always |

The two operations are **orthogonal**. Query is the precision instrument; init-context is the bulk loader.

---

## Inspect Procedure

When a user wants to know the state of Project Memory in their project (*"is this set up?", "are my docs fresh?", "what is missing?"*), follow this procedure:

1. **Determine the project root** (`git rev-parse --show-toplevel`).
2. **Check structural completeness** — for each expected file, report present/absent:
   - `README.md` at the project root
   - `docs/` directory
   - `docs/mission.md`
   - `docs/gotchas.md` (and `docs/gotchas/` directory)
   - Any `docs/<topic>.md` files
3. **Check format compliance** (light scan only):
   - Is `docs/gotchas/` hub+domain or monolithic?
   - Are the documentation file sizes within guardrails (≤ 750 lines for README and topic files, ≤ 50 lines for the gotchas hub)?
4. **Check freshness signals**:
   - **Per-doc, via `source` (docs that declare it)** — for each doc that declares `source` globs (per [../init-doc/references/standards.md § Frontmatter](../init-doc/references/standards.md#frontmatter)), compare `git log -1` on the doc against `git log -1` on the files its `source` globs **resolve to**. If the documented code changed after the doc was last touched, flag that doc as a stale candidate. This *targets* the specific doc rather than the whole `docs/` tree, but the timestamp comparison is still a heuristic — a cosmetic doc edit (a TOC or cross-link fix) refreshes the doc's timestamp without touching its prose, so treat the result as a flag to review, not proof. Also confirm each glob still resolves (a glob that resolves to nothing means the documented code was moved or deleted). *Resolve* is defined in [§ `source` semantics](../init-doc/references/standards.md#source-semantics).
   - **Coarse (docs without `source`)** — when was each documented file last modified vs. recent code changes (via `git log` on source vs. `git log` on `docs/`)? If docs have not been touched in a while but source has, flag potential staleness.
5. **Check manifest freshness** — run the generator in `--check` mode (it writes nothing):

   ```bash
   python3 "${CLAUDE_SKILL_DIR}/../init-doc/scripts/build-doc-manifest.py" --root <project_root> --check
   ```

   (The generator is bundled in the sibling `init-doc` skill — a declared dependency; `${CLAUDE_SKILL_DIR}` resolves to this skill's installed directory at runtime and `../init-doc/` reaches its sibling, the same layout this skill already uses for `../init-doc/references/standards.md`. Never invoke it by a project-relative path.) Interpret the exit code precisely — it is a three-way signal, not pass/fail (see [../init-doc/references/standards.md § `--check` mode](../init-doc/references/standards.md#--check-mode)):
   - **Exit 0** — the committed `doc-manifest.json` and README managed block are in sync with a fresh scan.
   - **Exit 1** — **stale**: a producer skill (`init-doc` / `update-doc` / `refactor-doc`) changed docs without regenerating the manifest. Report the drift and recommend re-running a producer (typically `/update-doc`) to regenerate.
   - **Exit 2** — **structural, not stale**: there is no `README.md`, or the README has no `## Documentation` section to host the managed block. Do **not** report this as "stale" — regenerating will not fix it. Recommend `/refactor-doc` (which adds the Documentation section) or `/init-doc`, then re-run `--check`.

   This is the committed-manifest + Inspect-diff freshness mechanism — there is no background hook. If Python is unavailable or the script is missing, report **"manifest freshness unverified (generator unavailable)"** rather than asserting it is fresh.
6. **Check structural drift — has the graph gone *archaic*?** This is distinct from step 5: step 5 asks *"is the manifest stale (un-regenerated)?"*; this asks *"is the documentation's domain structure still a good fit for the code?"* — the slow drift a long-lived project accumulates. Run the generator's drift mode (write-free):

   ```bash
   python3 "${CLAUDE_SKILL_DIR}/../init-doc/scripts/build-doc-manifest.py" --root <project_root> --drift
   ```

   It prints the deterministic, mechanical signals as JSON:
   - **`dangling_docs`** — docs whose documented code is entirely gone (structure lagging behind deletions/moves).
   - **`groups_without_docs`** (monorepo) — declared sub-projects that no doc maps to (undocumented at the sub-project scale).
   - **`cross_group_docs`** (monorepo) — docs whose `source` straddles *sibling* sub-projects (sprawl — candidate splits).

   Then add the **judgment the script can't do**: glance at the source's top-level layout (`ls`/Glob on the main source roots) and compare it to the domains the docs actually cover — are there sizeable code areas no doc's `source` maps to? (This single-project "uncovered area" sense is inherently fuzzy, so it is your judgment, not a script output.)

   **Interpret advisorily.** A few signals are normal and healthy. **Accumulating, structural** drift — several undocumented sub-projects, many dangling docs, multiple sprawled docs, or whole source areas uncovered — means the doc graph's decomposition has aged against the code. When it crosses that bar, recommend **`/refactor-doc` in re-architect mode**, which re-derives the structure from current source while preserving every word (see [../init-doc/references/standards.md § Documentation Manifest](../init-doc/references/standards.md#documentation-manifest)). This is a *re-architecture* recommendation, not the *regenerate* one from step 5 — name which you mean. If `--drift` cannot run (no Python), report drift as **unassessed** rather than asserting the graph is current.
7. **Check for an orphaned backup** — look for `.project-memory-backup/` at the project root. A writer skill (`init-doc` / `refactor-doc`) takes this backup before a destructive mutation and **deletes it on clean convergence** (see [../init-doc/references/doc-review.md § Part D](../init-doc/references/doc-review.md#part-d--cleanup)). So if it is present, the last mutation either is still in progress or **aborted / did not converge** — meaning a documentation rewrite was never verified clean. Flag it for the user with the path, and recommend they re-run the originating skill (which will detect the stale backup and prompt) or remove it once they have confirmed the current docs are correct.
8. **Report**: a structured summary with a status indicator per element (present / stale / missing / drifted) and recommended next actions (e.g., *"Mission is missing — run `/init-mission`. Gotchas is monolithic at 820 lines — run `/refactor-doc` to split. `doc-manifest.json` is stale (drifted from a fresh scan) — run `/update-doc` to regenerate. Structural drift: 2 sub-projects undocumented and 4 dangling docs — the graph has aged against the code; run `/refactor-doc` in re-architect mode. An orphaned `.project-memory-backup/` is present — the last rewrite never converged; review and re-run or remove it."*).

Inspect is read-only. It never modifies the project's docs.

---

## Anti-Patterns

These behaviors break the system and should be avoided:

| Anti-Pattern | Why it fails | What to do instead |
|---|---|---|
| **Skipping `init-context` at session start** | Agent operates blind — no mission, no gotchas, no conventions loaded. Amnesia and hallucination guaranteed. | Always start a session with `/init-context [topic or question]`. |
| **Skipping `update-doc` at session end** | Docs decay silently. By session 10, the documentation is a fossil of an old project state. | Always close a coding session with `/update-doc`. |
| **Bypassing the satellites — editing docs/ directly without a skill** | Misses the structural contract (README doc-index + TOC regeneration, cross-link integrity, gotchas hub sync). Easy to drift. | Use `/init-doc`, `/update-doc`, or `/refactor-doc` depending on intent. |
| **Letting docs/gotchas.md grow unbounded** | A 900-line monolithic gotchas file defeats progressive disclosure — `init-context` either loads all of it (token waste) or skips it (lost gotchas). | Convert to hub+domain via `/refactor-doc`. |
| **Treating docs/manual/ as a Project Memory area** | `docs/manual/` is human-authored content excluded from the satellites by convention. | Project Memory writes only `docs/*.md` outside `manual/`. |
| **Using the core for direct satellite work** | The core does not write docs. Routing through the core for a bootstrap or update is overhead — invoke the satellite directly. | Invoke `/init-doc`, `/update-doc`, etc. directly when intent is unambiguous. |
| **Citing the agent training data as project documentation** | Hallucination. The whole point of Project Memory is grounded knowledge. | Always cite a file path. If the docs do not cover it, say so. |

---

## Constraints

- **NEVER write or modify documentation files directly** — this is the core skill; writing is delegated to satellites (`init-doc`, `update-doc`, `refactor-doc`, `init-mission`).
- **NEVER hallucinate project facts** — if Query cannot find an answer in the docs, say so explicitly. Do not paraphrase training knowledge as if it came from the project.
- **NEVER skip citations in Query** — every claim must reference a file path the answer came from.
- **NEVER modify protected files** — `CLAUDE.md`, `MEMORY.md`, `.claude/`, `specs/`, `docs/manual/` are all off-limits. (See [../init-doc/references/standards.md § Protected Files](../init-doc/references/standards.md#protected-files).)
- **NEVER traverse more than depth 2 in Query** — escalate to `/init-context` if the question needs broader recall.
- **ALWAYS determine the project root via `git rev-parse --show-toplevel`** before any file operations. (See [../init-doc/references/standards.md § Project Root Determination](../init-doc/references/standards.md#project-root-determination).)
- **ALWAYS use the standards in [../init-doc/references/standards.md](../init-doc/references/standards.md)** when reasoning about file structure, size guardrails, TOC rules, cross-linking, or protected paths — it is the single source of truth shared by every skill in the constellation.

---

## Glossary

Definitions of terms used throughout Project Memory, surfaced here for both reader clarity and embedding-search discoverability.

- **LLM amnesia** — the failure mode where an AI agent forgets a project structure, conventions, and decisions between sessions. The primary problem Project Memory solves.
- **Context rot** — the degradation of an LLM adherence to established patterns over a long session, as the conversation context grows and earlier decisions drift out of focus. Documented in the Chroma 2025 Context Rot study across 18 frontier models.
- **Context engineering** — the discipline of structuring an LLM agent working memory through filesystem-and-metadata-driven loading, progressive disclosure, and minimal-context-at-startup. The 2025–2026 frame for what Project Memory does.
- **Progressive disclosure** — a loading discipline where information is revealed in tiers based on need, rather than dumped all at once. The Project Memory Query procedure is a lazy version; `init-context` recall is an eager-but-selective version.
- **Hub plus domain** — the gotchas architecture used by Project Memory: a thin `docs/gotchas.md` navigational hub (≤ 50 lines) plus per-subsystem `docs/gotchas/<domain>.md` files (e.g., `database.md`, `deployment.md`, `frontend.md`).
- **Single-concern coherence** — the structural rule that every documentation file covers one topic. Enforced by the 750-line soft guardrail on README and `docs/*.md`.
- **Workflow contract** — the non-negotiable lifecycle: recall at session start (`init-context`) → work → maintain at session end (`update-doc`). The discipline that makes the docs *living*.
- **Decision-making compass** — `docs/mission.md` (created by `init-mission`). The stable, project-level reference for vision, values, non-goals, users, and UX, loaded by `init-context` in every session.
- **Living documentation** — documentation that is current because it is maintained on every session, not docs that decay between major releases.
- **Karpathy LLM Wiki** — Andrej Karpathy early-2026 popularization of LLM-authored, LLM-recalled personal knowledge bases. Project Memory is the project-scoped peer of this concept.
- **AGENTS.md / llms.txt** — adjacent emerging standards for agent-facing documentation. The Project Memory `README.md` + `docs/` structure plays the same role at project scope.
