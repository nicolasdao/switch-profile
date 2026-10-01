# CHANGELOG.md format

`CHANGELOG.md` lives at the repository root and follows [Keep a Changelog](https://keepachangelog.com) with [Semantic Versioning](https://semver.org).

## Header

The file must start with this header, followed by an `[Unreleased]` section:

```markdown
# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]
```

**First run after standard-version.** Releases up to 1.1.0 were written by standard-version: the header paragraph mentions standard-version, and entries look like `## [1.1.0](https://github.com/nicolasdao/switch-profile/compare/v1.0.0...v1.1.0) (2026-03-21)` with `### Features` / `### Bug Fixes`. On the first run:

- Replace only the header paragraph with the header above and add `## [Unreleased]`.
- Leave every historical entry exactly as it is. Do not reformat old entries.

## A release entry

```markdown
## [Unreleased]

## [2.0.0] - 2026-10-01

### Removed
- Remove copying temporary credentials into `[default]` of `~/.aws/credentials`

### Added
- Add fuzzy profile search ranked by recent use

### Fixed
- Fix SSO login hanging over SSH by using device code automatically
```

- Version in brackets, ISO date: `## [x.y.z] - YYYY-MM-DD`.
- Categories, in this order, only when non-empty: Added, Changed, Deprecated, Removed, Fixed, Security. For a major release, put the breaking category (usually Removed or Changed) first.
- One bullet per **logical change**, not per commit. Squash related commits.
- Start each bullet with an imperative verb: Add, Change, Deprecate, Remove, Fix, Update.
- Write for users of the CLI: name the command, flag, file or behavior. Skip internal-only changes (refactors, tests, CI) unless nothing else changed.
- Mark breaking changes clearly, and say what users must do (e.g., "migrated automatically, backups in `~/.aws/*.bak-*`").

## Classification and bump signal

| Category | What goes there | Bump signal |
|---|---|---|
| Added | New commands, flags, capabilities | minor |
| Changed | Different behavior of something existing | minor, or major if incompatible |
| Deprecated | Still works, will be removed | minor |
| Removed | Gone commands, flags, behaviors, file formats | major |
| Fixed | Bug fixes | patch |
| Security | Vulnerability fixes | patch or minor |

Commit prefixes help but do not decide alone: `feat!` or a `BREAKING CHANGE:` footer means major. `feat` usually means minor. `fix`, `perf`, `refactor`, `docs`, `chore`, `test`, `build` usually mean patch. Read the diff when a message is unclear.

## Stamping a release

1. Move everything under `## [Unreleased]` into the new `## [x.y.z] - YYYY-MM-DD` section, merged with the newly classified changes (no duplicates).
2. Leave `## [Unreleased]` present and empty at the top.
3. Optionally add a compare link at the bottom of the file: `[x.y.z]: https://github.com/nicolasdao/switch-profile/compare/v<previous>...vx.y.z`.

## Recording unreleased changes (Mode C)

- Create `## [Unreleased]` below the header if it is missing.
- Create the `### <Category>` subsection if missing, then append your bullets.
- Amend, never replace: keep bullets other agents recorded. Skip a bullet that duplicates one already there.
- No version number and no date.
