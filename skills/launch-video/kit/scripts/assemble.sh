#!/usr/bin/env bash
# Frames + soundtrack -> MP4 (and a 1080p copy when the master is 4K).
#   scripts/assemble.sh frames/full out/video-4k.mp4
#   scripts/assemble.sh frames/preview out/preview.mp4
# Soundtrack: out/music.wav (scripts/make-music-track.sh; silence when missing), plus a real key
# press per typed character (assets/sfx/keyboard.mp3) and a real mouse click per click
# (assets/sfx/click.wav), each at its logged time. No ducking: the music stays level.
set -euo pipefail
cd "$(dirname "$0")/.."
FRAMES=${1:-frames/full}
OUT=${2:-out/video-4k.mp4}
J() { python3 -c "import json,sys;print(json.load(open('$FRAMES/render.json'))['$1'])"; }
FPS=$(J fps); START=$(J startFrame); FROM=$(J from)
TOTAL=$(node -e "import('./src/story.mjs').then(m=>console.log(m.TOTAL))")
NAME=$(basename "$FRAMES")
mkdir -p "$(dirname "$OUT")" out

AUDIO=out/music.wav
if [ ! -s "$AUDIO" ]; then
  echo "no out/music.wav: using silence (see scripts/make-music-track.sh)"
  AUDIO=out/silence.wav
  ffmpeg -v error -y -f lavfi -i "anullsrc=r=48000:cl=stereo" -t "$TOTAL" -c:a pcm_s16le "$AUDIO"
fi

count() { python3 -c "import json;print(len(json.load(open('$1'))))" 2>/dev/null || echo 0; }
if [ "$(count "$FRAMES/keys.json")" -gt 0 ]; then
  if [ -s assets/sfx/keyboard.mp3 ]; then
    node src/keys/make-keys.mjs "$FRAMES/keys.json" "out/keys-$NAME.wav"
    ffmpeg -v error -y -i "$AUDIO" -i "out/keys-$NAME.wav" -filter_complex "[0:a][1:a]amix=inputs=2:normalize=0:duration=first[out]" \
      -map "[out]" -c:a pcm_s16le "out/soundtrack-$NAME.wav"
    AUDIO="out/soundtrack-$NAME.wav"
  else echo "no assets/sfx/keyboard.mp3: typing is silent"; fi
fi

if [ "$(count "$FRAMES/clicks.json")" -gt 0 ]; then
  if [ -s assets/sfx/click.wav ]; then
    GRAPH=$(python3 - "$FRAMES/clicks.json" <<'PY'
import json, sys
t = [c['t'] for c in json.load(open(sys.argv[1]))]   # absolute: the soundtrack is cut at FROM later
n = len(t)
parts = [f"[1:a]asplit={n}" + ''.join(f"[c{i}]" for i in range(n)) + ";"]
parts += [f"[c{i}]adelay={max(0, int(x * 1000))}:all=1[d{i}];" for i, x in enumerate(t)]
parts.append(''.join(f"[d{i}]" for i in range(n)) + f"amix=inputs={n}:normalize=0[clk];[0:a][clk]amix=inputs=2:normalize=0:duration=first[out]")
print(''.join(parts))
PY
)
    ffmpeg -v error -y -i "$AUDIO" -i assets/sfx/click.wav -filter_complex "$GRAPH" -map "[out]" -c:a pcm_s16le "out/soundtrack-clicks-$NAME.wav"
    AUDIO="out/soundtrack-clicks-$NAME.wav"
  else echo "no assets/sfx/click.wav: clicks are silent (scripts/make-click.sh)"; fi
fi

# Video from the frames; the soundtrack is cut to the same span so they stay in sync.
ffmpeg -v error -y -framerate "$FPS" -start_number "$START" -i "$FRAMES/%05d.png" \
  -ss "$FROM" -i "$AUDIO" \
  -map 0:v -map 1:a -shortest \
  -c:v libx264 -preset slow -crf 14 -pix_fmt yuv420p -profile:v high -tune film \
  -c:a aac -b:a 320k -movflags +faststart "$OUT"
echo "wrote $OUT"

# A 1080p copy for social uploads (they re-encode anything larger).
W=$(ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 "$OUT")
if [ "$W" -gt 1920 ]; then
  SMALL="${OUT%-4k.mp4}-1080p.mp4"
  [ "$SMALL" = "$OUT" ] && SMALL="${OUT%.mp4}-1080p.mp4"
  ffmpeg -v error -y -i "$OUT" -vf "scale=1920:1080:flags=lanczos" -c:v libx264 -preset slow -crf 17 \
    -pix_fmt yuv420p -c:a copy -movflags +faststart "$SMALL"
  echo "wrote $SMALL"
fi
