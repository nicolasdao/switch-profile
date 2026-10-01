---
name: unconfuse
description: Unconfuse — re-explain my last answer so it lands, then strip it to the shortest version that still clicks. Use when the user says I am confused, I do not follow, or explain it like I am five. Not for readers who need to decide — use decision-brief.
argument-hint: "[optional steer, e.g. I still do not get the auth part, or keep it under 100 words]"
---

# Unconfuse

Re-explain **your own previous answer** to someone who is smart but does not share your context —
then cut it to the shortest version that still lands.

## Why the first attempt failed

You explained **the system's structure**. They asked about **their confusion**. Those are different
documents, and piling on more detail makes the gap worse.

## Two passes, and pass 2 is the one usually skipped

**Pass 1 — make it click.** Diagnose, kill the misconception, find the contrast.
**Pass 2 — strip it.** Delete everything not carrying the click, including your own good writing.

A version that lands but rambles has failed. **Length is itself an obstacle to understanding.**

## Pass 1 — make it click

### Step 1. Diagnose the confusion — do this before writing anything

Their wording leaks the type. Match it, then apply that repair only.

| Type | Tell | Repair |
|---|---|---|
| **Wrong mental model** | *"I didn't know we had two…"* | Name and kill the false belief in line one |
| **Missing prerequisite** | *"What's a cursor?"* | Define the one term, then continue |
| **Lost in the chain** | Follows each step, not the whole | Give the shape first, then the steps |
| **Drowning in detail** | *"This is a lot"* | Pick the one thing that matters, drop the rest |
| **Doesn't see the stake** | Understands it, shrugs | Lead with what it costs |

Cannot identify a type? **Ask which part lost them.** Do not re-explain everything louder.

### Step 2. Find the collapsed distinction

Nearly every confusing finding is **two different things treated as one**: zero vs no-data · absent
vs empty · stale vs cached · retried vs duplicated.

State both sides as a two-line contrast:

```
"the irrigator put down zero water"   ← recorded
"nobody told us anything"             ← actual
```

**If you can write that pair, you are done thinking.** If you cannot, you have not found the finding.

### Step 3. One metaphor — only if a safe one exists

Test it before using it:

- **Maps faithfully?** If it misleads when pushed on, it teaches something false. Discard it.
- **From their world?** Envelopes, people, post, keys. Never from the domain being explained.
- **Survives the whole explanation?** One sustained beats four sprinkled.

**A forced metaphor is worse than none.** No safe metaphor → skip it and rely on the contrast.

### Step 4. Consequence as a person doing a thing

Not *"data quality was compromised"* → **"farmers saw flat-zero charts for years."**

### Step 5. Pre-empt the next question

Usually *"so why don't we just fix it?"* or *"how did nobody notice?"*

## Pass 2 — strip it

Now delete. These are the usual culprits, in the order they appear:

| Cut | Example |
|---|---|
| **Dramatic build-up** | *"here's the strange part…"*, *"they answer politely…"* |
| **Headers**, if the piece is short | Three sections for 150 words is scaffolding, not structure |
| **The metaphor after it has landed** | State it once. Do not elaborate it |
| **History and footnotes** | Earlier wrong theories are provenance, not comprehension |
| **Restating the question** | They know what they asked |
| **Any sentence that only re-says the contrast** | Trust the two lines to do their work |

**Target: half the words of the version that first clicked.**

## Never

- **Never drop a number.** `24,188 records` · `12 of 59` · `0.74 inches`. Concrete figures are what
  make it land — vagueness is not simplicity.
- **Never soften a finding.** If something is broken or was someone's mistake, it stays that way.
- **Never condescend.** No *"basically"*, no *"don't worry about"*, no baby talk. They lack **your
  context**, not intelligence.
- **Never paste code.** Describe what it does in a sentence.
- **Never fake simplicity.** If a part is genuinely intricate, say so and give it straight.

## Jargon

Cut it, or gloss it **once, inline, plain word first**: *"an empty envelope — `{}` in the logs"*.
Never the reverse order.

## Boundary

**If they understand the mechanism and need to choose, this is the wrong skill** — use
`decision-brief`. A metaphor handed to someone who just wants the call wastes their time.

The tell: *"what should we do?"* is a decision. *"I don't get it"* is this skill.

## Self-check

- Did I name the misconception, or work around it?
- Does the contrast pair stand alone?
- Would the metaphor mislead if pushed on?
- Did every number survive?
- **Could I cut another 30% and still have it land?** If yes, cut it.
- Could they now explain it back to someone else? That is the bar — not a nod.
