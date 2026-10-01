# Essentials

This is a kit — a curated collection of skills installed together in one command.

The most essential skills to manage any project, regardless of what the project is for. Every project needs to manage its memory, write a specification, and be version-controlled — and may need help reframing the last answer, pressure-testing an analysis before acting on it, verifying the work being done, re-orienting after stepping away, and seeing at a glance what is still open. These are the essential skills and kits every project needs.

## What's Included

- **Doc Essentials** (`nicolasdao/_kit-doc-essentials`) — a nested kit that gives a project perpetual, agent-readable memory (the Project Memory constellation), the ability to write specifications, and clean conventional git commits. This covers three of the essentials on its own: memory, specification, and version control.
- **Decision Brief** (`nicolasdao/decision-brief`) — recast the last answer into something you can act on in seconds: verdict on top, bullet-first, lossless on any caveat or hedge that changes a decision, lossy on process. Replaces `reframe-last-answer` in this kit as of 0.6.0.
- **Unconfuse** (`nicolasdao/unconfuse`) — the counterpart for when you did not follow the answer rather than needing to choose. Diagnoses *which kind* of confusion it is, kills the misconception, states the collapsed distinction as a two-line contrast, then strips the result to the shortest version that still lands. Decision Brief is for readers who must decide; this is for readers who must understand.
- **Scrutinize** (`nicolasdao/scrutinize`) — self-review and fix your own just-finished work in the same session, for when a project needs the work being done verified.
- **Second Opinion** (`nicolasdao/second-opinion`) — audit a just-delivered analysis and fix plan *before* anyone implements it: re-verify its claims at primary sources, test rival explanations, sweep the proposed changes for side effects, and return an UPHELD, AMENDED or OVERTURNED verdict. Where Scrutinize scopes by diff after the work is done, Second Opinion scopes by argument structure before it starts.
- **Session Status** (`nicolasdao/session-status`) — a manually-invoked ledger showing what is done, what is left, what is waiting and why, and what only you can unblock, for when you return to a session and cannot remember where things stand.
- **Open Items** (`nicolasdao/open-items`) — the impatient counterpart to Session Status: only what is still open, as a headline count over a table of item, why it is not closed, and what blocks it, ordered so each item unblocks the next. Session Status is the ledger you read after time away; this is the answer to "what's left?" asked mid-flight.

## When to Use

Install this kit at the start of any project — the domain doesn't matter. It bundles the cross-cutting capabilities every project needs: managing memory, writing specs, version control, reframing answers, auditing an analysis before implementing it, verifying work, knowing where a long-running session actually stands, and seeing in one glance what is still open.

## Install

```bash
npx happyskills install nicolasdao/_kit-essentials
```
