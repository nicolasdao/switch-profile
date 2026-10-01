---
name: decision-brief
description: Decision brief — recast my last answer into a scannable brief I can act on in seconds. Use when the user says brief me, so what, what is the call, or the short version. Not for confusion — an unclear mechanism needs re-explaining, not compressing.
argument-hint: "[optional steer, e.g. for a non-technical exec, or just the go/no-go]"
---

# Decision Brief

Recast **your own immediately-preceding answer** into something the reader can act on in seconds —
without losing anything that would change their mind.

> Successor to `reframe-last-answer` (still installed, no longer developed). Same engine, far harder
> output discipline.

## The engine — one filter, one inversion

**Filter.** Ask every sentence: *does this change the decision?*

- **Yes** → keep. Verdicts, caveats, risks, trade-offs, costs, "only partial".
- **No** → cut, or replace with a pointer. Investigation, evidence trail, methodology, enumeration.

**Inversion.** A thorough answer runs in *discovery* order — looked here, found this, therefore that.
A decision needs the reverse. The build-up is **deleted**, not moved down: it was scaffolding for
reaching the conclusion, not for acting on it.

## The non-negotiable rule

> **Lossless on decisions. Lossy on process.**

This is **not** a summariser. A summariser cuts by *length* and loses the caveat in paragraph nine.
This cuts by *decision-relevance* — a two-word caveat survives while three paragraphs of evidence go.

### Never drop a hedge to save words

Compression removes the shortest words first — and those are the qualifiers, which carry the decision:

| Full | Stripped | Different decision |
|---|---|---|
| probably fixed | fixed | **yes** |
| no evidence of a breach | no breach | **yes** |
| fix is partial | fixed | **yes** |

**Cut the whole sentence, or keep the qualifier. Never keep the claim and drop the doubt.**

Grammar is not where the padding lives. Process narration is. Never sacrifice grammar for brevity —
it buys almost nothing and costs precision.

## The compression arsenal

Bullets are one tool. Reach for the right one.

### 1. Front-load the operative word

The reader's eye lands on the first word of a line. Spend it.

- ✅ **Blocked** — waiting on the signed DTN contract.
- ❌ We are currently waiting on the signed DTN contract, which means this is blocked.

### 2. Two-column contrast — for the pivotal distinction

Almost every finding turns on **one** contrast. Set the two halves against each other and the reader
grasps it without a paragraph.

```
recorded    "zero water applied"
actual      "nobody told us anything"
```

### 3. Delta notation

`2,133 → 1` · `913 → 541 + 414` · `5 min → 60 min`

Before-and-after in a handful of characters. Beats any sentence describing a change.

### 4. Parenthetical provenance

`(measured)` · `(inferred)` · `(unverified)` · `(vendor's claim)`

Two words that tell the reader how much weight to put on a number. Almost free, and in a decision
brief it is often the most important thing on the line.

### 5. Numbers, not adjectives

`12 of 59` beats "a minority". `3.5× faster` beats "significantly faster". Shorter *and* more
decidable.

### 6. Named quantities, not pronouns

"the 47 refusing sites" beats "they". Costs three words, saves the reader scrolling up to find the
antecedent. Net win.

### 7. Inline gloss with an em-dash

Define a term without spending a sentence on it: *the cursor — the last day we successfully wrote —
was stuck.*

### 8. Tables for options, with a verdict line underneath

A table of 2+ options compared on the same axes is scanned by column, far faster than prose. **But a
table never concludes** — always add one line under it stating the pick, or the reader has to derive
it.

### 9. Strike-through for a retraction

~~PivoTrac is dead~~ → 12 of 59 sites serve real data. Shows the correction without a paragraph
explaining that there was one.

### 10. A controlled glyph set — used sparingly

`✅` done · `⚠️` caution · `🔴` broken · `⛔` deliberately not doing this.

Fixed vocabulary only. **Never the sole carrier of meaning** — the word must still be there for
anyone copying the text into a ticket or an email.

## Structural rules

- **Open with the call**, bold, one line. No preamble, ever.
- **Bullets** for parallel, independent items. **Prose** for the verdict and any causal chain.
- **Cap a bullet at 2 lines.** Longer is a paragraph wearing a dot — split it or cut it.
- **No nested bullets.** A sub-bullet means the structure is wrong; flatten or make it a table.
- **Bold at most one phrase per bullet.** More bold, less signal.
- **Robustness in one word:** `solid` · `partial` · `band-aid` · `unverified`.
- **No closing offer.** No "let me know if". End on the decision.

> ⚠️ **Bullets encode "these are parallel and independent."** Bulleting `A → therefore B → therefore
> C` shatters the logic into three disconnected claims. If the items depend on each other, write the
> sentence.

## Default shape — adapt, never force

```
**<The call, one line.>**

**Why**      2-4 bullets
**Cost**     bullets, with a robustness word where it applies
**Decide**   what needs them — or "nothing, FYI"
```

Other shapes that work: a **table of options** plus a one-line pick · **findings** as what-matters /
what-is-uncertain / what-it-implies · **risk** as bottom-line / what-could-bite / what-to-do.

Choose by asking: *what must this person grasp to act?* Build backwards from that.

## Boundary — when this is the wrong skill

**If the reader is confused rather than deciding, do not use this.** A decision brief handed to
someone who does not understand the mechanism leaves them exactly as stuck — there is no decision for
the filter to keep and nothing to invert. They need it **re-explained**: a concrete metaphor, the
jargon stripped, the pivotal contrast in plain speech. That is the opposite operation.

Say so in one line and explain it properly instead.

## Behaviour

Produce the brief directly. No permission, no meta-commentary, no "here is the reframed version". It
**replaces** the wall of text; it does not annotate it.

- Last answer already brief and decision-ready → say so in one line rather than padding it.
- No prior substantive answer → ask which one they mean. Do not invent one.
- Honour any steer in the arguments (audience, the one decision they care about, length).

## Self-check

- Could they decide from this alone?
- Did every decision-changing caveat survive, including the hedges?
- Is any bullet over 2 lines, or nested?
- Did I bullet something causal that needed a sentence?
- Does every table have a verdict line under it?
- Did I cut process, not substance?
