#!/bin/sh
# Creates the release commit (release files only) and the annotated tag.
# Usage: commit-and-tag.sh <x.y.z>. Run from the repository root.
set -eu

new=${1:?usage: commit-and-tag.sh <x.y.z>}
files="package.json package-lock.json CHANGELOG.md"

# Refuse if anything besides the release files is staged or modified: the release commit carries only metadata.
others=$(git status --porcelain | awk '{print $2}' | grep -v -x -e package.json -e package-lock.json -e CHANGELOG.md || true)
if [ -n "$others" ]; then
	echo "refusing to release: other files have changes:" >&2
	echo "$others" | sed 's/^/  /' >&2
	exit 1
fi
if git rev-parse --verify --quiet "refs/tags/v$new" >/dev/null; then
	echo "tag v$new already exists" >&2
	exit 1
fi

git add $files
git commit --quiet -m "chore(release): switch-profile v$new"
git tag -a "v$new" -m "Release v$new"
echo "committed $(git rev-parse --short HEAD) and tagged v$new"
