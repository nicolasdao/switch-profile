---
name: session-status
description: Session status — a scannable ledger of what is done, what is left, and what needs you. Use when returning to a session unsure whether work finished, stalled, or is waiting on someone.
disable-model-invocation: true
allowed-tools: Bash, Read, Glob, Grep, TaskList
---

# session-status

Produce a complete picture of where the work stands, in one screen, with **zero follow-up questions needed**.

## Why this exists

The person invoking this works asynchronously. They start something, walk away for hours or a day, and come back with no memory of the session. You have total recall of it; they have none.

A turn ending looks identical whether the work finished or stopped halfway. That ambiguity is what forces them to ask. **Your job is to remove it before they have to.**

They will use this output to make exactly one decision: **close the session, keep going, or start fresh.** Everything you write serves that decision.

---

## Step 1 — Gather artifacts. Do not work from memory.

**This is the accuracy rule and it is not optional.** If you reconstruct the ledger from recollection you will confabulate — confidently, and in prose indistinguishable from truth. Read ground truth first:

```bash
date -u +"%Y-%m-%dT%H:%M:%SZ"     # now, absolute
git log --oneline -30              # what actually shipped
git log -1 --format=%cI            # when work last happened
git status --short                 # what is unfinished
```

Then read, if present:

- **The spec or plan the session was executing.** Its acceptance criteria are the definition of done. Look under `specs/`, or wherever this repo keeps them.
- **The task list** via `TaskList`, if one exists.
- **Any spec the session produced** — it usually enumerates the remaining work already.

**Commit bodies are the decision log.** Where a session wrote thorough commit messages, they record *why* choices were made. In a fresh session they are often the only surviving record. Mine them.

## Step 2 — Work out which situation you are in

**Same session** — you hold the arc. Artifacts are a cross-check against selective memory. Your risk is reporting what you remember most vividly rather than what matters most.

**Fresh session** — you hold nothing. Everything comes from git, specs and the repo. Your risk is inventing continuity. **Say so in the header** (`reconstructed from repository history`) and mark anything you could not determine as unknown rather than guessing.

## Step 3 — Verify before claiming

A task list saying "completed" is a claim, not a fact. Where a cheap check exists, run it: a health endpoint, a queue depth, a file's existence, a test suite.

Every ✅ row needs **evidence in the last column**. If you could not verify something, still list it, but write `not verified` rather than inventing proof.

---

## The output — exactly three parts, nothing else

### Part 1 — Summary

```
**<Project>** · <absolute UTC now> · last activity <absolute UTC>
**What we set out to do:** <the original request or spec path, one line>
**Live checks as of <time>:** <only facts that decay - health, queue depth, freshness>

> ### <emoji> <One-sentence verdict in plain English.>
> <2-4 sentences: where things stand, what is waiting and why, what needs them.>
>
> **One thing needs you right now** — <or omit this line entirely if nothing does>
>
> **Suggested next move:** <one sentence>
```

The verdict must land for someone who has forgotten everything. Where a wait is involved, say **what** is being waited for, **why**, and **when it ends** — as an absolute time.

### Part 2 — One table

| What | In original plan | Added during session | Status | Proof, or what it's waiting for |
|---|:--:|:--:|---|---|

Put **✅ in exactly one** of the two middle columns — the same marker in both, so it reads as one yes/no answer placed in whichever column applies. Leave the other blank. This makes scope drift visible at a glance, and scope drift is precisely what the person has no chance of remembering.

**Status vocabulary — use these six and nothing else:**

| | Meaning |
|---|---|
| ✅ **Done** | Finished. Evidence goes in the last column. |
| 🔴 **Needs you** | Only they can do it. Say what, and what it unblocks. |
| ⏳ **Waiting** | Cannot start yet. Say when it can, absolutely. |
| 🟡 **Ready now** | Nothing blocks it. You could do it immediately. |
| 🔵 **Next session** | Too large for the context that remains. |
| ⚪ **Skipped on purpose** | Deliberate. Give the reason, or it reads as an oversight. |

**Row rules**

- ✅ rows first, then everything else.
- **Aggregate ✅ rows** until they fit roughly ten. Finished work needs one line of proof, not a breakdown.
- **Never aggregate the rest.** That is where the decisions live.
- **Include work currently in flight.** A ledger that omits what you are doing right now recreates the ambiguity it exists to remove.
- Plain language, not internal shorthand. Write `Stop the copying from the old database`, never `§6.4 DROP SUBSCRIPTION`.

### Part 3 — Conclusion, two short lists

```
**Waiting on you — N things**
1. <action> — <what it unblocks>

**Choices I made for you** — say so if you disagree
- <what you chose, and the alternative they might have picked>
```

If nothing is blocked, write **`Nothing is blocked on you.`** in those words. Silence must never be left to mean "clear".

The second list is the most easily forgotten and the most valuable. Autonomous work involves judgment calls they never saw, and each is a place where your choice becomes permanent by default. Keep to material ones; omit the section entirely if there are none.

---

## Step 4 — Act on the verdict

**If nothing is blocked and work remains that you can do: show the ledger, then carry on.** Do not stop for permission. Asking "shall I proceed?" when nothing blocks turns an autonomous task back into a synchronous one, defeating the point of them walking away.

Stop only when: something needs them, everything left is genuinely waiting on a clock, or continuing would mean starting substantial work in depleted context.

**Judge that last case honestly.** You are the only party who can estimate remaining context. If the work left will not fit, say so and recommend a fresh session. A handoff written while you still have the context to write it well is worth far more than one written after quality has degraded.

---

## Hard rules

1. **Plain English. No internal jargon.** Banned: *handoff*, *ripe*, *gate*, *blocker* as a noun, and any bare `§` reference without a description. If a phrase would make them ask "what does that mean?", it has failed.
2. **Absolute timestamps only.** Never `in 7 hours` or `yesterday`. This may be read a day later, when relative times are simply wrong.
3. **Mark what decays.** Queue depths, health checks and freshness are true only at the stamped moment. Group them under one `as of <time>` line.
4. **Never write to disk.** This produces a decision, not an artifact. No files, no saved ledger, nothing persisted.
5. **No options, no flags, no modes.** One invocation does everything. Never ask which variant they want.
6. **Surface failures.** Anything that failed, was skipped, or is still broken goes in. If nothing went wrong, say so explicitly.
7. **Never narrate method.** How something was done is never interesting here. Only state, evidence, and what is next.

## Length

Target one screen. The table carries the weight; prose stays minimal.

When over budget, cut in this order:

1. Any narrative of how something was done — always, first
2. Detail on ✅ rows — aggregate further
3. The "Choices I made for you" list — keep only material items

**Never cut:** the verdict, the waiting-on-you list, or any non-✅ row.

## Constraints

- **Read-only.** This skill carries no `Write` or `Edit` tools by design. If you find yourself wanting to change a file, you have misread the task.
- **Verify rather than assume.** A cheap check beats a confident claim.
- **Never invent history.** In a fresh session, if the artifacts do not say it, you do not know it — say so.
