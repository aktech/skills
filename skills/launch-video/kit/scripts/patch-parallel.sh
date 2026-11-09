#!/usr/bin/env bash
# Re-renders only the named shots at full quality and patches them into frames/full, balanced:
# each shot is cut into ~3 s chunks run 12 at a time (a chunk starting inside a shot replays
# it from its start without capturing), then one encode. Change only what was asked, patch
# only those shots.
#   scripts/patch-parallel.sh c-share d-demo            (OUT=out/video-4k.mp4 JOBS=12)
set -euo pipefail
cd "$(dirname "$0")/.."
JOBS=${JOBS:-12}
OUT=${OUT:-out/video-4k.mp4}
[ -f frames/full/render.json ] || { echo "no frames/full yet: run scripts/render-parallel.mjs first"; exit 1; }
mkdir -p out
rm -rf frames/chunk-*
node -e "
import('./src/story.mjs').then(m=>{
  for (const n of process.argv.slice(1)) {
    const s = m.SHOTS.find(x => x.name === n)
    if (!s) { console.error('no shot ' + n); process.exit(1) }
    for (let a = s.start; a < s.end - 1e-6; a += 3) console.log(a, Math.min(a + 3, s.end))
  }
})" "$@" > out/chunks.txt
echo "$(wc -l < out/chunks.txt | tr -d ' ') chunks"
xargs -P "$JOBS" -L 1 sh -c 'node src/record.mjs --from "$0" --to "$1" --out "frames/chunk-$0" > "out/chunk-$0.log" 2>&1 && echo "chunk $0-$1 done" || { echo "chunk $0 failed, see out/chunk-$0.log"; exit 255; }' < out/chunks.txt
# Sound logs: drop the patched shots' old entries, add the new ones.
node -e "
const fs = require('fs'), path = require('path')
const chunks = fs.readFileSync('out/chunks.txt', 'utf8').trim().split('\n').map((l) => l.split(' ').map(Number))
const inside = (t) => chunks.some(([a, b]) => t >= a && t < b)
for (const f of ['keys.json', 'clicks.json']) {
  let all = JSON.parse(fs.readFileSync(path.join('frames/full', f), 'utf8')).filter((k) => !inside(k.t))
  for (const [a] of chunks) all = all.concat(JSON.parse(fs.readFileSync(path.join('frames/chunk-' + a, f), 'utf8')))
  fs.writeFileSync(path.join('frames/full', f), JSON.stringify(all.sort((x, y) => x.t - y.t)))
}"
for d in frames/chunk-*; do cp "$d"/*.png frames/full/; done
rm -rf frames/chunk-*
echo "patched: $*"
scripts/assemble.sh frames/full "$OUT"
