#!/bin/sh
# Lists source files changed since the last release tag (committed or not) that have no matching test change
# and are not referenced by any test file. Prints nothing when every changed source file is covered.
# Run from the repository root.
set -u

last_tag=$(git describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null || git rev-list --max-parents=0 HEAD | tail -1)

changed=$( { git diff --name-only "$last_tag" -- src index.js; git ls-files --others --exclude-standard -- src; } | sort -u)
tests_changed=$( { git diff --name-only "$last_tag" -- test; git ls-files --others --exclude-standard -- test; } | sort -u)

for file in $changed; do
	[ -f "$file" ] || continue
	module=$(echo "$file" | sed -e 's#^src/##' -e 's#\.js$##')
	base=$(basename "$module")
	# Covered if a test file shares the module's name, or any test references the module path.
	if echo "$tests_changed" | grep -q "test/$base\.js" || grep -rlq "src/$module['\"/]" test 2>/dev/null; then
		continue
	fi
	echo "$file"
done
