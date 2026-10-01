# Changelog

All notable changes to this skill are documented here.

## [0.1.0] - 2026-07-26

Initial release.

### Added

- Manually-invoked session ledger producing a one-screen picture of where work stands: a plain-English summary and verdict, a single table, and two closing lists.
- **Scope-drift tracking.** The table marks each item as coming from the original plan or added mid-session, in separate columns. Work added along the way is the hardest thing for someone to reconstruct after stepping away, and a ledger that only checks the original plan silently misses it.
- **Six-state status vocabulary** — Done, Needs you, Waiting, Ready now, Next session, Skipped on purpose. These distinguish outcomes that otherwise look identical from outside: work that is genuinely waiting on a clock reads the same as work that was abandoned, unless the ledger says which.
- **Artifacts over recollection.** The ledger is derived from `git log`, `git status`, the task list and the executing spec's acceptance criteria, never from memory. Reconstructing from recall produces confident fiction that reads exactly like truth.
- **Works in a fresh session.** Detects whether it holds the session history or is reconstructing cold, states which in the header, and marks anything undetermined as unknown rather than guessing.
- **Plain-English constraint**, with an explicit ban on jargon such as *handoff*, *ripe* and *gate*, plus bare section references. The output is meant to raise no follow-up questions.
- Absolute timestamps only, and decaying facts grouped under a single `as of` line, so a ledger read hours later does not mislead.
- Continues working after reporting when nothing is blocked, rather than pausing for permission.

### Notes

- Read-only by construction: the skill is granted no `Write` or `Edit` tools, so it cannot persist anything. It produces a decision, not an artifact.
- Manual invocation only (`disable-model-invocation: true`) — it runs when asked and never on its own.
