# Changelog

All notable changes to the `second-opinion` skill are documented here.

## [0.1.0] - 2026-07-08

### Added
- Initial release. Pre-implementation audit of a just-delivered analysis + recommendations: decomposes the argument into claims / links / assumptions / recommendations, spawns a cold-examiner sub-agent that re-verifies the claims and re-diagnoses the symptom without the author's reasoning, re-grounds every claim at primary sources (CLAIMED → ACTUAL → RIDES ON IT), runs a differential over rival explanations, sweeps each recommendation's blast radius (code consumers, product surfaces, data, schedules, contracts), proves or drops every finding, and ends in an UPHELD / AMENDED / OVERTURNED verdict with a per-recommendation risk register — never implementing fixes. Includes the "coherence is not correctness" posture, disagreement weighting against the cold examiner, and bounded stopping.
