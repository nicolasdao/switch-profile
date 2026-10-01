# Changelog

## [0.3.0] - 2026-08-15

### Changed
- **Answered decisions are now carried out, not just recorded.** 0.2.0 collected the decision and stopped, on the reasoning that a command you run to *check* state should never *change* it. In practice that reproduced the friction the skill exists to remove: the reader clicked an option, saw it echoed back, and still had to type a second prompt to make anything happen. A decision that is only written down has moved nothing.
- The safety intent is preserved rather than dropped. What made 0.2.0 cautious was the mis-click risk, and the answer to that is not inaction — it is that **the option text is what turns a click into authorization**. Step 5 already required every option to name its action and its cost; Step 6 now leans on that, and executes only the option that was picked, at exactly the scope its label described.

### Added
- **Step 6 — re-verify immediately before executing.** The table is a snapshot, and time passes while the modal is open. Before acting on a row, the skill re-runs the Step 1 check that produced it: matching state executes, drifted state stops and re-asks. A decision approves the world it was shown, not whatever the world became.
- The rule is drawn from a real failure, recorded in the skill so it is not re-learned: a table printed "4 commits unpushed", the reader approved "push all 4", a concurrent session committed a fifth before the push ran, and five went. Nothing broke, but the approval no longer described what happened.
- **Outcome reporting per row** — each answered row closes with what actually happened rather than what was intended, failures stated plainly with their error, and anything still open keeps its row. This extends the existing "never mark something closed you did not verify" rule from the table to the execution.
- **The tool grant is documented as the second gate.** `allowed-tools` stays narrow deliberately: shell work runs without friction, while an approved action reaching for a file-mutating tool raises a permission prompt. Because the action set here is unbounded, that prompt is the intended backstop and not a malfunction.

### Fixed
- Two framing lines still promised the old contract — the opening summary and Step 5's "it does not move anything" — and would have contradicted the new behaviour.

## [0.2.0] - 2026-08-02

### Added
- Ask for the decisions that are yours to make. After the table prints, the skill now raises a single batched `AskUserQuestion` for the rows that are stuck on the reader — with grounded recommendations and their costs, ordered most-blocking-first. Seeing what is open and deciding what to do about it used to be two prompts; it is now one.
- Only `you (decide)` rows earn a question, and only when they are not themselves waiting on another open row — asking about a downstream item buys an answer whose premise may evaporate once the upstream decision lands. Rows marked `you (run it)`, `#N`, an external name, or `—` are never asked about, because none of them are a decision.
- If no row qualifies, nothing is asked. A glance-check must not summon a modal, which is what keeps the skill usable mid-flight.

### Changed
- Options must be grounded in something verified that turn. An ungrounded recommendation that gets clicked is worse than asking nothing — it turns a reporting tool into a source of bad decisions — so when nothing can be responsibly recommended the skill offers to walk through the trade-off rather than inventing a fork.
- The free-text escape hatch is never spent as an option slot. `AskUserQuestion` appends **Other** automatically, so re-creating it by hand would cost a real recommendation.
- The read-only guarantee is narrowed rather than dropped. `AskUserQuestion` collects a decision without mutating anything, which is why it is the only tool added — the skill records the answers against their row numbers and stops. Executing them belongs to the session that invoked it, so a command you run to *check* state still cannot *change* state on a mis-click.

## [0.1.0] - 2026-08-02

### Added
- Initial release under this name. Renamed from `nicolasdao/print-open-items@0.1.1` — the behaviour is byte-for-byte identical; only the skill name and its invocation changed, because HappySkills has no rename primitive and a new coordinate is the only way to carry a name change.
- Prints only the still-open items of a session: a headline count on its own line, then a table of `# | Item | Why it's still open | Blocked by`, ordered so each item unblocks the next, and a closing line naming what was verified clear.
- Auto-invokes on the natural phrasings of the question — "any open items?", "what's left?", "are we done?", "anything blocking?" — as well as the explicit `/open-items`.
- Verifies state before reporting (working tree, unpushed commits, unpublished tags, processes still running, last test result) rather than reciting from memory, and treats unanswered questions and user-owned handoffs as open items in their own right.
- Read-only by construction: `allowed-tools` carries no `Write` or `Edit`, so reporting can never mutate the thing being reported on.
- Description is disambiguated against `nicolasdao/session-status`. Both skills answer to "what is left", which makes the phrase ambiguous wherever the Essentials kit installs the pair, so the negative slot names session-status explicitly and SKILL.md states the split: session-status is the full ledger for someone re-orienting after time away, this is the impatient mid-flight question of what is still open.
