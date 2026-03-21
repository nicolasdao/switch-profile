## [1.0.4] - 2026-03-03

### Fixed
- Re-published to fix a platform bug where `keywords` in `skill.json` were not being synced to the HappySkills registry on push

## [1.0.3] - 2026-03-02

### Added
- Added `keywords` to `skill.json`: `devops`, `documentation`, `docs`

## [1.0.2] - 2026-03-02

### Fixed
- Re-published to include CHANGELOG.md in the package

## [1.0.1] - 2026-03-02

### Fixed
- Replaced hardcoded absolute paths with dynamic project root resolution via `git rev-parse --show-toplevel`
- Skill now works on any machine (macOS, Linux, Windows) regardless of user or directory structure
- Added `Bash` to allowed tools to support the git command
- Protected files section no longer references user-specific paths
