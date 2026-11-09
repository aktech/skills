#!/usr/bin/env bash
# Fits a licensed track to the video: starts it at its first strong beat (OFFSET s), changes
# its tempo by FACTOR (pitch kept) so a beat lands every 0.5 s of video (120 BPM), loudness
# -14 LUFS, fades out over the last 2 s. Measure tempo and phase with scripts/beat.py:
# FACTOR = 120 / bpm, OFFSET = the phase of a beat near where the music should start.
#   scripts/make-music-track.sh assets/music/track.mp3 6.44 1.04   -> out/music.wav
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=${1:?music file}; OFFSET=${2:-0}; FACTOR=${3:-1}
DUR=$(node -e "import('./src/story.mjs').then(m=>console.log(m.TOTAL))")
FADE=$(python3 -c "print($DUR-2.0)")
mkdir -p out
ffmpeg -v error -y -ss "$OFFSET" -i "$SRC" -af "atempo=$FACTOR,atrim=duration=$DUR,loudnorm=I=-14:TP=-1.5:LRA=11,afade=t=out:st=$FADE:d=2.0,aresample=48000" -ac 2 -c:a pcm_s16le out/music.wav
echo "out/music.wav: $(ffprobe -v error -show_entries format=duration -of csv=p=0 out/music.wav) s"
