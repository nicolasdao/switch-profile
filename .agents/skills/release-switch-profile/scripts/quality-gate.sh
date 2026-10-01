#!/bin/sh
# Runs the unit tests and the linter, then prints a compact summary.
# Exits non-zero if either fails. Run from the repository root.
set -u

tmp=$(mktemp -d "${TMPDIR:-/tmp}/release-gate.XXXXXX")
status=0

if npm test >"$tmp/test.log" 2>&1; then
	echo "tests:  PASS ($(grep -Eo '[0-9]+ passing' "$tmp/test.log" | tail -1))"
else
	status=1
	echo "tests:  FAIL"
	grep -E 'passing|failing|pending' "$tmp/test.log" | sed 's/^/        /'
	echo "        --- failures ---"
	sed -n '/failing/,$p' "$tmp/test.log" | head -60 | sed 's/^/        /'
fi

# No --fix: the gate reports problems, it does not silently rewrite files.
if npx eslint . >"$tmp/lint.log" 2>&1; then
	echo "lint:   PASS"
else
	status=1
	echo "lint:   FAIL"
	head -60 "$tmp/lint.log" | sed 's/^/        /'
fi

rm -rf "$tmp"
exit $status
