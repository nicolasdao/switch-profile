# Changelog

## [1.1.0] - 2026-05-04

### Added
- Optional `$ARGUMENTS` directive to steer commit behavior (force a type/scope, split into multiple commits, restrict the file set, add message constraints). When omitted, the default 6-step workflow runs unchanged.
- `argument-hint` frontmatter so the optional argument surfaces in the slash-command UI.
