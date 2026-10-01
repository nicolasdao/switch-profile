#!/bin/sh
# Publishes the package to npm. prepublishOnly runs lint, tests and the bundle tests first.
# Run from the repository root.
set -u

if ! user=$(npm whoami 2>/dev/null); then
	echo "NOT_LOGGED_IN: run 'npm login' in a terminal (in Claude Code: ! npm login), then retry." >&2
	exit 2
fi
echo "publishing as $user"
npm publish --access=public || exit 1
version=$(node -p "require('./package.json').version")
echo "published switch-profile@$version: https://www.npmjs.com/package/switch-profile"
