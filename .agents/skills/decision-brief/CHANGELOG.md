# Changelog

All notable changes to this skill are documented here.

## [0.1.0] - 2026-08-13

### Added
- Initial release. Recasts the assistant's own previous answer into a scannable decision brief: verdict first, lossless on anything that changes a decision, lossy on process.
- **The engine stated explicitly** — one filter (does this sentence change the decision?) and one inversion (a thorough answer runs in discovery order; a decision needs the reverse, so the build-up is deleted rather than demoted).
- **Hedge protection.** Compression removes the shortest words first, and those are the qualifiers that carry the decision — "probably fixed" and "fixed" are different decisions. The rule is: cut the whole sentence, or keep the qualifier; never keep the claim and drop the doubt. Grammar is never sacrificed for brevity.
- **A ten-device compression arsenal** beyond bullets: front-loading the operative word, two-column contrast for the pivotal distinction, delta notation, parenthetical provenance (measured / inferred / unverified), numbers over adjectives, named quantities over pronouns, inline em-dash gloss, tables with a mandatory verdict line, strike-through retractions, and a controlled glyph set that is never the sole carrier of meaning.
- **Bullet discipline with a stated limit** — bullets encode "these items are parallel and independent", so a causal chain must stay prose. Plus a 2-line bullet cap, no nesting, one bold phrase per bullet.
- **An explicit boundary.** If the reader is confused rather than deciding, this is the wrong skill — there is no decision for the filter to keep and nothing to invert, so they need the mechanism re-explained rather than compressed.

### Notes
- Successor to `reframe-last-answer`, which remains installed and functional but is no longer developed. This is a new skill, not a rename: the original is referenced by `skills-lock.json` and `_kit-essentials`, and those references are deliberately left intact.
