#!/bin/sh
# Sets the version in package.json and package-lock.json (no commit, no tag), then verifies both.
# Usage: bump-version.sh <x.y.z>. Run from the repository root.
set -eu

new=${1:?usage: bump-version.sh <x.y.z>}
echo "$new" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' || { echo "not a semver version: $new" >&2; exit 1; }

npm version "$new" --no-git-tag-version --allow-same-version >/dev/null

pkg=$(node -p "require('./package.json').version")
lock=$(node -p "require('./package-lock.json').version")
lock_root=$(node -p "require('./package-lock.json').packages[''].version")
if [ "$pkg" != "$new" ] || [ "$lock" != "$new" ] || [ "$lock_root" != "$new" ]; then
	echo "version mismatch after bump: package.json=$pkg package-lock.json=$lock/$lock_root" >&2
	exit 1
fi
echo "version set to $new in package.json and package-lock.json"
