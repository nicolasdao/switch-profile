#!/bin/sh
# Pushes master and the release tag. Never forces.
# Usage: push.sh <x.y.z>. Run from the repository root.
set -eu

new=${1:?usage: push.sh <x.y.z>}
branch=$(git rev-parse --abbrev-ref HEAD)
[ "$branch" = "master" ] || { echo "not on master (on $branch)" >&2; exit 1; }

git push origin master
git push origin "v$new"
echo "pushed master and v$new"
