# Changelog

All notable changes to the Essentials kit are documented here.

## [0.6.0] - 2026-08-13

### Added
- `nicolasdao/decision-brief` — successor to `reframe-last-answer`. Same engine (one filter: does this sentence change the decision; one inversion: a thorough answer runs in discovery order, a decision needs the reverse) with far harder output discipline: verdict on top, bullet-first, a ten-device compression arsenal beyond bullets, and an explicit rule that a hedge is never dropped to save words, because "probably fixed" and "fixed" are different decisions.
- `nicolasdao/unconfuse` — the counterpart for readers who did not follow the answer rather than needing to choose. Diagnoses which of five confusion types is present before writing, kills the misconception, states the collapsed distinction as a two-line contrast, then strips the result to the shortest version that still lands.

### Removed
- **BREAKING — `nicolasdao/reframe-last-answer` is no longer a member.** Upgrading to 0.6.0 removes it. It is superseded by `decision-brief`, which owns the same job with a sharper output standard and an explicit boundary telling the reader when to reach for `unconfuse` instead.
- **The skill itself is NOT deleted.** `nicolasdao/reframe-last-answer` remains published and installable — anyone who wants it back can install it directly. It is no longer developed.

### Why the two new skills rather than one
They optimise for opposite things and their instructions conflict. `decision-brief` minimises reading time — the reader knows the domain and every word is friction, so process is cut and the build-up deleted. `unconfuse` minimises obstacles to understanding — the reader lacks context, so words are spent on a metaphor and a contrast, then everything not carrying the click is stripped. Merging them would produce a skill with contradictory guidance and a mode switch that routes wrong under exactly the conditions where it matters. Each names the other in its `Not for` clause: "what should we do?" is a decision, "I don't get it" is the other one.

## [0.5.0] - 2026-08-02

### Changed
- Swap `nicolasdao/print-open-items` for `nicolasdao/open-items`. Same skill under a shorter name — the behaviour is byte-for-byte identical, so nothing about what the kit does changes. HappySkills has no rename primitive, so carrying a name change means publishing a new coordinate and repointing the kit at it.

### Removed
- `nicolasdao/print-open-items` is no longer a member and has been deleted from the registry. Installs of this kit at 0.4.0 or earlier resolved that coordinate; upgrade to 0.5.0 to pick up `nicolasdao/open-items` in its place.

## [0.4.0] - 2026-07-31

### Added
- `nicolasdao/print-open-items` — the impatient counterpart to Session Status. It prints only what is still open: a headline count on its own line, then a table of item, why it is not closed, and what blocks it, ordered so each item unblocks the next. Nothing finished appears, which is what keeps the count trustworthy at a glance. Session Status remains the full ledger you read after time away; this answers "what's left?" asked mid-flight.

### Changed
- The kit description now names capabilities rather than enumerating members, so adding a skill no longer forces a rewrite of a sentence that was already at its length limit.

## [0.3.0] - 2026-07-28

### Added
- `nicolasdao/second-opinion` — a pre-implementation audit of a delivered analysis and fix plan. It re-grounds each claim at primary sources, tests rival explanations for the same symptom, sweeps the proposed changes for side effects on adjacent features, and returns an UPHELD, AMENDED or OVERTURNED verdict. It implements nothing; the human decides what happens next.
- It pairs with `scrutinize` rather than duplicating it: Scrutinize scopes by diff and runs after the work is done, Second Opinion scopes by argument structure and runs before implementation begins. The two cover opposite ends of the same risk.
- Version strategy unchanged — always-latest (`*`), consistent with every other member.

### Changed
- Kit description and keywords updated to name the new member; README "What's Included" extended with a Second Opinion entry that spells out how it differs from Scrutinize.

## [0.2.0] - 2026-07-26

### Added
- `nicolasdao/session-status` — a manually-invoked session ledger. It answers the question a long-running session leaves ambiguous: has the work finished, is it waiting on something, or did it stop halfway? The output is one screen — a plain-English verdict, a single table separating what came from the original plan from what was added along the way, and a short list of what only the user can unblock.
- It earns a place among the essentials for the same reason the others do: it is cross-cutting and domain-independent. Any project worked on across more than one sitting has the problem it solves.
- Version strategy unchanged — always-latest (`*`), consistent with every other member.

## [0.1.0] - 2026-07-03

### Added
- Initial release of the Essentials kit.
- Bundles `nicolasdao/_kit-doc-essentials` (nested kit: project memory, specifications, git commits), `nicolasdao/reframe-last-answer`, and `nicolasdao/scrutinize`.
- Version strategy: always-latest (`*`) for every member.
