# Changelog

All notable changes to the `scrutinize` skill are documented here.

## [0.1.0] - 2026-06-01

### Added
- Initial release. Same-session self-review that scopes to the session diff, spawns a read-only cold-reader sub-agent, runs a simple-gaps pass and a harvest-corrections pass (fed by accumulated learning), reconciles the two (disagreements are blind spots), proves every finding before fixing (failing test, primary-source evidence, or grep), auto-applies the green fixes and surfaces the risky ones, then confirms with the targeted and broad test suites. Includes the "expand the problem" altitude check and the "distrust your own narrative" posture.
