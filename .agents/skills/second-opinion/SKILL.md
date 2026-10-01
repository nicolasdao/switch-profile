---
name: second-opinion
description: Second opinion — audit a just-delivered analysis and fix plan before implementation. Use when you want its claims verified, alternative causes tested, and side effects on adjacent features swept. Not for finished code changes — use scrutinize.
disable-model-invocation: true
allowed-tools: Bash, Read, Grep, Glob, Agent, AskUserQuestion
---

# Second Opinion

An analysis and a set of recommendations were just delivered — a diagnosis and a treatment plan. Before anyone implements them, re-try the case: re-ground every claim in primary sources, test rival explanations for the same symptom, and sweep the blast radius of what was proposed. This is a second doctor reading the chart — not the first doctor re-reading their own notes.

If `$ARGUMENTS` names an analysis (a message, a document, a spec section), audit that. Otherwise the subject is the most recent analysis + recommendations delivered in this conversation.

## Posture — read first

- You are auditing a **map**, not the territory. The map's coherence is what made it persuasive — **coherence is not correctness.** Every claim goes back to the territory: the actual code, the actual data, the actual output.
- Be adversarial toward the analysis's **beliefs**, not its author. Assume at least one load-bearing claim was asserted rather than verified — your job is to find out which.
- The author is attached to the diagnosis, **especially when the author is you.** The narrative you built explains the evidence you collected — that is precisely what a wrong-but-plausible diagnosis feels like from the inside. This is why the cold examiner exists: it re-derives without the narrative.
- **UPHELD and OVERTURNED are equally honest verdicts.** Never manufacture doubts to look rigorous; never soften a refutation to be polite.
- **You implement nothing.** The output is a verdict and a revised plan. The human decides what happens next.

## When this works

Right after a substantive analysis + recommendation has been delivered and **before implementation begins** — the claims are fresh, nothing is built yet, and a wrong diagnosis or a harmful fix is still free to reverse. Skip it for trivial or purely factual answers.

## The pipeline

### 0 — Decompose the argument

Extract from the analysis, as numbered lists:

- **CLAIMS** — every factual assertion, each tagged **verified-in-session** (evidence was actually shown) or **asserted** (stated on authority, memory, or plausibility);
- **LINKS** — every causal step (X, therefore Y);
- **ASSUMPTIONS** — unstated premises the argument needs to hold;
- **RECOMMENDATIONS** — every proposed change, each with its claimed effect and declared scope.

This list is the audit's scope. (Scrutinize scopes by diff; you scope by argument structure.)

### 1 — Cold examiner (spawn first, runs in parallel)

Spawn a fresh read-only sub-agent. Give it the **symptom** (the original observation or question) and the **bare claims list** — **not** the author's evidence, reasoning, or conclusions. Instruct it to:

- (a) independently verify or refute each claim against primary sources (file and line, query, command output), and
- (b) produce its **own diagnosis** of the symptom, from scratch.

An examiner that lands on a **different root cause** is the most valuable output this skill can produce. It makes no changes.

### 2 — Your two passes (run independently of the cold examiner, so neither anchors the other)

**Re-grounding — verify the claims.** For each claim, go to the primary source and record a triple:

> **CLAIMED** (and whether it was verified or asserted at the time) → **ACTUAL** (primary-source evidence — file and line, query, output) → **RIDES ON IT** (the links and recommendations that depend on this claim)

Start with the asserted claims and the load-bearing ones. A refuted claim invalidates everything that rides on it — trace the cascade explicitly rather than patching the conclusion.

**Differential — test rival explanations.** For the core symptom, enumerate the alternative mechanisms that would produce the same observation. Kill each with evidence, or promote it. For every survivor ask explicitly: if this alternative were the truth, would the recommended fix be right, useless, or harmful?

### 3 — Blast-radius sweep (the recommendations)

For each recommendation, **search — do not recall** — the surface it touches:

- **code consumers** — callers, implementers, overrides (grep them);
- **product surfaces** — UI placements, agent tools, system prompts and AI guides that teach the current behavior;
- **data** — existing rows in the old state (backfill or migration needed?), idempotency of re-runs, import/export round-trips;
- **schedules** — cron and batch jobs that exercise the surface;
- **contracts** — docs, tests, seeds, API consumers.

Derive the checklist from the **kind** of change — a schema change, a formula change, and a UI change each ride with different accompaniments; do not apply a fixed list. For each surface: would the recommendation break, corrupt, or degrade it?

Close with two honesty checks:

- **Scope** — what does the fix NOT fix? Say it plainly.
- **Altitude** — is there a simpler or deeper alternative, or did the analysis solve the wrong or smaller problem? That is a direction call — **surface it to the human, never redirect unilaterally.**

### 4 — Reconcile

Merge your findings with the cold examiner's. Weight the **disagreements** heavily — a claim it refuted that you confirmed (or the reverse), and any differential it raised that the author had dismissed, are the blind spots. Resolve every disagreement with additional primary-source evidence, never by adjudicating on confidence.

### 5 — Prove or drop (hard gate)

Every verdict and every side-effect risk carries the strongest proof its type admits: primary-source evidence, a reproducing query or command, or a grep that shows the affected sites. What cannot be proven is labeled **SPECULATIVE** and ranked last — or dropped. Never let an unproven concern block a proven-sound plan, and never let an unproven claim survive as load-bearing.

### 6 — Verdict (report only — no fixes)

Deliver, in plain language:

- **Claims table** — claim → CONFIRMED / REFUTED / AMENDED → evidence;
- **Diagnosis verdict** — **UPHELD** / **AMENDED** (corrected mechanism stated) / **OVERTURNED** (actual mechanism stated, with evidence);
- **Per-recommendation risk register** — side effect, severity, evidence, mitigation — plus the revised recommendation wherever the original must change;
- **Bounds** — what was not examined, and any altitude call for the human.

**Stop when the lenses are exhausted, not when you feel certain** — certainty never arrives, and infinite review is its own failure.

## The one rule that makes this work

Every verdict is **grounded in primary source.** The analysis under audit is itself a secondary source — quoting it as evidence for its own claims is circular. Go to the actual code, the actual data, the actual output, every time.

## Constraints

- **NEVER** implement, edit, or fix anything — product code, docs, or config. Verdict and revised plan only; the human decides.
- **NEVER** quote the audited analysis as evidence for its own claims — primary sources only.
- **NEVER** soften a refutation or manufacture a doubt. A clean UPHELD and a hard OVERTURNED are both correct outcomes.
- **NEVER** present a SPECULATIVE concern as a proven risk — label it and rank it last.
- **ALWAYS** spawn the cold examiner without the author's reasoning, evidence, or conclusions — the symptom and the bare claims only.
- **ALWAYS** trace a refuted claim through everything that rode on it — links, recommendations, verdicts.
- **ALWAYS** end with the verdict report, even when everything is upheld.
- The cold-examiner sub-agent is **read-only**.
