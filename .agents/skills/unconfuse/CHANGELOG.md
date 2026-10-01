# Changelog

All notable changes to this skill are documented here.

## [0.1.0] - 2026-08-13

### Added
- Initial release. Re-explains the assistant's own previous answer to a reader who did not follow it, then strips it to the shortest version that still lands.
- **Two passes.** Pass 1 makes it click; pass 2 deletes everything not carrying the click — including good writing. A version that lands but rambles has failed, because length is itself an obstacle to understanding.
- **Confusion diagnosis before writing.** Five types, each with its tell and its own repair: wrong mental model, missing prerequisite, lost in the chain, drowning in detail, doesn't see the stake. Applying the wrong repair is why re-explaining louder does not work.
- **The collapsed distinction.** Nearly every confusing finding is two things treated as one — zero vs no-data, absent vs empty, stale vs cached. Stated as a two-line contrast, which usually is the entire explanation.
- **Metaphor is conditional, not mandatory** — three safety tests, and an explicit rule that a forced metaphor is worse than none, because a leaky one teaches something false.
- **Named cut targets for pass 2**: dramatic build-up, headers on short pieces, elaborating the metaphor after it has landed, history and footnotes, restating the question. Target is half the words of the version that first clicked.
- **Guardrails**: never drop a number, never soften a finding, never condescend, never paste code, never fake simplicity where something is genuinely intricate.

### Notes
- Sibling of `decision-brief`, and deliberately orthogonal to it. This skill owns *re-explain an explanation the reader did not understand*; `decision-brief` owns *recast an answer the reader must act on*. The tell: "what should we do?" is a decision, "I don't get it" is this.
