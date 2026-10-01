#!/bin/sh
# Prints the release state of the repository. Run from the repository root.
# Usage: release-state.sh [--fetch]
set -u

[ "${1:-}" = "--fetch" ] && git fetch --quiet origin 2>/dev/null

version=$(node -p "require('./package.json').version")
lock_version=$(node -p "try { require('./package-lock.json').version } catch (e) { 'n/a' }")
last_tag=$(git describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null || echo "")
branch=$(git rev-parse --abbrev-ref HEAD)

echo "version:        $version (package-lock.json: $lock_version)"
echo "last tag:       ${last_tag:-none}"
echo "branch:         $branch"

if git rev-parse --verify --quiet "origin/$branch" >/dev/null; then
	behind=$(git rev-list --count "HEAD..origin/$branch")
	ahead=$(git rev-list --count "origin/$branch..HEAD")
	echo "vs origin:      $ahead ahead, $behind behind"
else
	echo "vs origin:      no origin/$branch"
fi

changes=$(git status --porcelain | wc -l | tr -d ' ')
echo "uncommitted:    $changes file(s)"

if grep -q '^## \[Unreleased\]' CHANGELOG.md 2>/dev/null; then
	echo "changelog:      has [Unreleased] section"
else
	echo "changelog:      no [Unreleased] section (first run: add the Keep a Changelog header)"
fi

echo ""
if [ -n "$last_tag" ]; then
	echo "commits since $last_tag:"
	git log --no-merges --format='  %h %s' "$last_tag..HEAD"
else
	echo "commits (no tag yet):"
	git log --no-merges --format='  %h %s'
fi
