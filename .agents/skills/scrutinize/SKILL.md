---
name: scrutinize
description: Scrutinize and fix your own just-finished work in the same session. Use when you made a substantial change and want a pass before committing, to catch what you forgot or got wrong, then fix it with proof. Not for code you did not write.
disable-model-invocation: true
allowed-tools: Bash, Read, Grep, Glob, Edit, Write, Agent, AskUserQuestion
---

# Scrutinize

Re-examine the work you just finished, prove what is actually wrong, and fix it — using the knowledge you have **now**, at the end, that you lacked when you made the early decisions. This is a second pass with new information, not a re-run of the same thinking.

If `$ARGUMENTS` names a focus or paths, scope the review to that. Otherwise the scope is everything you changed this session.

## Posture — read first

- This is **setting yourself up for success, not catching yourself out.** You just finished; you now hold more context and focus than at any single decision point. Spend that surplus.
- Be adversarial toward your own **beliefs**, not your competence. Assume at least one early decision rode on an assumption that turned out wrong.
- Your accumulated context is **fuel for the facts you learned, but fog for your objectivity** — by now you are attached to your own solution. Harvest what the work taught you, but distrust how it made you feel about what you built. This is exactly why the cold reader exists — it holds the facts without the attachment.
- **"Clean" is a valid, honest result.** Never manufacture findings to look thorough — that is rubber-stamping inverted. A finding counts only once you can **prove** it (Step 4).
- You **do not commit, push, or release.** You surface and fix; the human commits.

## When this works

Same session, right after a **substantial** change. Your live reasoning trail — what you assumed, looked up, and decided while working — is the fuel, so the harvest in Step 2 is far weaker on a cold diff. Skip this for trivial edits.

## The pipeline

### 0 — Scope
Run `git status --short`, `git diff`, and `git diff --staged`. List the files you touched and restate the original ask in one line. That set is what is under review. If `$ARGUMENTS` narrows the focus, honor it.

### 1 — Cold reader (spawn first, let it run in parallel)
Spawn a fresh sub-agent (general-purpose, read-only). Give it the **original ask**, the **diff**, and read access to the codebase — but **not** your reasoning or your justifications for why the solution is right. Instruct it to independently find (a) gaps and omissions and (b) decisions that rest on a wrong assumption, each **grounded in primary-source evidence (file:line)**, and to make **no changes**. It has the artifact without your attachment — that is the entire point of using it.

### 2 — Your two passes (run independently of the cold reader, so neither anchors the other)

**Simple pass — find the gaps.** Re-read the diff as a *reader*, not the writer — what is on the page, not what you meant. Look for:
- omissions and incompleteness versus the literal ask;
- **missing accompaniments** — for a change *like this one*, what usually rides along (a test, a doc, a changelog entry, a migration, an updated caller)? Derive this from the *kind* of change, not a fixed checklist;
- **seam breaks** — where your change meets unchanged code (callers, consumers, the other half of a rename);
- leftovers — debug output, TODOs, scaffolding, temp files.

**Harvest — find the wrong beliefs.** Do not summarize what you learned; find where your map was wrong. Mine these veins:
- **reversals** — moments a result surprised you or you backtracked;
- **inherited claims** — anything you took from a doc, a comment, your memory, or "I think" without checking primary source at the time;
- **generalizations** — every blanket rule you asserted (confirmed at every site, or extrapolated from one?);
- **late-vs-early** — what you knew by the end but committed to before knowing it;
- **your own "because" clauses** — each load-bearing rationale you stated, re-verified against source.

Write each harvest finding as a triple:
> **ASSUMED** (and where it came from) → **TRUE** (with primary-source evidence, file:line) → **RODE ON IT** (the decisions/files that depended on it)

Drop anything you cannot ground in evidence. Rank by how much rode on it. Feed the harvest the **union** of your accumulated learning and the simple-pass findings — a forgotten caller is often the symptom of an assumed-single-caller.

**One altitude higher — did the work reveal the wrong problem?** The deepest finding is not a wrong assumption inside the solution but a wrong *problem*. Building the thing often exposes that what you set out to fix was the wrong, smaller, or merely symptomatic version of the real issue. Ask it explicitly: now that it exists, is this still the problem worth solving, or did the work surface a bigger or different one? That reframe is the highest-value thing this pass can find — and it is not yours to fix: it is a direction call, so **surface it to the human, never act on it unilaterally.**

### 3 — Reconcile
Merge your findings with the cold reader's. Weight the **disagreements** heavily — anything it flagged that you did not, or you flagged that it did not, is a blind spot.

### 4 — Prove (mandatory gate before any fix)
For each candidate, produce the strongest proof its type admits:
- behavioral bug → a **failing unit test** that reproduces it (gold standard);
- doc or claim inaccuracy → **primary-source evidence** (the code or data that contradicts it);
- completeness gap → a **grep or command** that shows the missing site.

The proof is also a **false-positive filter**: if you cannot make the test fail, or cannot ground the claim in source, it was not real — **drop it, do not fix it.** When the finding is a recurring *class*, promote the proof into a **durable guard** (a permanent test), not a one-shot check.

### 5 — Fix
- **Auto-apply** the fixes that are proven and that you can confirm test green.
- **Surface** the uncertain or risky ones — wide blast radius, behavior changes, anything you could not fully prove — and ask the human via AskUserQuestion before touching them.

### 6 — Confirm (two greens, both required)
- the **targeted test passes** (the fix works), and
- the **full relevant battery passes** (no regression).

A fix can pass its own test and break three others — run the broad suite, not just the one file.

### 7 — Bound and report
Light-check the fixes themselves (a leftover, a broken seam?) — not a full re-harvest. **Stop when the new lenses are exhausted, not when you feel certain** — certainty never arrives, and infinite review is its own failure. Then report, in plain language:
- what you **proved and fixed**, each with its evidence and the confirming test;
- what you **surfaced** for the human to decide;
- what came back **genuinely clean**.

## The one rule that makes this work

Every finding is **grounded in primary source** and **proven before it is fixed.** Memory, comments, and secondary docs are where the bugs came from — go to the actual code, the actual data, the actual output. That single discipline catches what a re-read of your own reasoning never will.

## Constraints

- **NEVER** commit, push, tag, or release. Surface and fix only.
- **NEVER** fix a finding you could not prove — Step 4 is a hard gate. Unprovable means drop it.
- **NEVER** manufacture findings to look thorough. Reporting "clean, here is the evidence" is a correct outcome.
- **ALWAYS** ground every finding in primary source (file:line or command output), not memory or secondary docs.
- **ALWAYS** run the broad test battery after fixing, not just the targeted test.
- **ALWAYS** ask before applying an uncertain or wide-blast-radius fix.
- **PREFER** promoting a recurring-class proof into a durable test over a one-shot check.
- The cold-reader sub-agent is **read-only** — it reviews, you fix.
