#!/usr/bin/env bash
# Cuts one real mouse click out of a recording: from the first sound above -40 dB, 150 ms long,
# a 40 ms fade out, peak at -10 dB.
#   scripts/make-click.sh assets/sfx/click.mp3   -> assets/sfx/click.wav
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=${1:-assets/sfx/click.mp3}
TMP=$(mktemp -t click).wav
ffmpeg -v error -y -i "$SRC" -af "silenceremove=start_periods=1:start_threshold=-40dB,atrim=0:0.15,afade=t=out:st=0.11:d=0.04,aresample=48000" -ac 2 "$TMP"
PEAK=$(ffmpeg -i "$TMP" -af volumedetect -f null - 2>&1 | sed -n 's/.*max_volume: \(-*[0-9.]*\) dB.*/\1/p')
ffmpeg -v error -y -i "$TMP" -af "volume=$(python3 -c "print(-10 - ($PEAK))")dB" -c:a pcm_s16le assets/sfx/click.wav
rm -f "$TMP"
echo "assets/sfx/click.wav (peak was $PEAK dB, now -10 dB)"
