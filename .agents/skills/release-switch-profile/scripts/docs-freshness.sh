#!/bin/sh
# Reports whether the documentation is newer than the last code change.
# Prints FRESH or STALE on the first line, then the evidence. Run from the repository root.
set -u

docs_ts=$(git log -1 --format=%ct -- README.md docs 2>/dev/null)
code_ts=$(git log -1 --format=%ct -- src index.js package.json 2>/dev/null)
dirty_code=$(git status --porcelain -- src index.js package.json | wc -l | tr -d ' ')
dirty_docs=$(git status --porcelain -- README.md docs | wc -l | tr -d ' ')

human() { [ -n "$1" ] && node -e "console.log(new Date($1 * 1000).toISOString())" || echo never; }

if [ "$dirty_code" = "0" ] && [ -n "$docs_ts" ] && [ "${docs_ts:-0}" -ge "${code_ts:-0}" ]; then
	echo FRESH
else
	echo STALE
fi
echo "last docs commit:      $(human "$docs_ts")"
echo "last code commit:      $(human "$code_ts")"
echo "uncommitted code:      $dirty_code file(s)"
echo "uncommitted docs:      $dirty_docs file(s)"
