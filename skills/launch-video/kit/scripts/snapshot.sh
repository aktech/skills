#!/usr/bin/env bash
# Freezes the product the video films: copies SUBDIR at COMMIT out of the product repo (the repo
# itself is never touched) into app-snapshot/, then runs an optional patch script inside it for
# filming-only changes (e.g. poll every 150 ms instead of 2 s, so a slow frame-by-frame render
# still sees one step change at a time). Re-snapshot the latest main before every final render.
#   scripts/snapshot.sh ~/work/product <commit> ui [scripts/patch-snapshot.sh]
set -euo pipefail
cd "$(dirname "$0")/.."
REPO=${1:?repo}; COMMIT=${2:?commit}; SUB=${3:-.}; PATCH=${4:-}
D=app-snapshot
rm -rf "$D"; mkdir -p "$D"
if [ "$SUB" = "." ]; then git -C "$REPO" archive "$COMMIT" | tar -x -C "$D"
else git -C "$REPO" archive "$COMMIT" "$SUB" | tar -x -C "$D" --strip-components="$(echo "$SUB" | awk -F/ '{print NF}')"; fi
[ -n "$PATCH" ] && (cd "$D" && bash "../$PATCH")
git -C "$REPO" rev-parse "$COMMIT" > "$D/.commit"
echo "snapshot of $(cat "$D/.commit") in $D: install and serve it, then APP_URL=http://127.0.0.1:<port>/ node src/record.mjs"
