"""Tempo and beat phase of an audio file (onset autocorrelation, 5 ms resolution).
   python3 scripts/beat.py file.mp3 [start_s] [length_s]  ->  JSON {bpm, period, phase}"""
import json, math, struct, subprocess, sys
f = sys.argv[1]; start = float(sys.argv[2]) if len(sys.argv) > 2 else 0; length = float(sys.argv[3]) if len(sys.argv) > 3 else 60
SR, hop = 8000, 40; fr = SR / hop
raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(start), '-t', str(length), '-i', f, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True).stdout
s = struct.unpack(f'<{len(raw)//2}h', raw)
e = [math.sqrt(sum(x * x for x in s[i:i + hop]) / hop) for i in range(0, len(s) - hop, hop)]
on = [max(0, e[i] - e[i - 1]) for i in range(1, len(e))]
def score(lag):
    tot = 0
    for i in range(0, len(on) - int(lag) - 2, 2):
        j = i + lag; k = int(j); w = j - k
        tot += on[i] * (on[k] * (1 - w) + on[k + 1] * w)
    return tot
best = max((score(l / 10), l / 10) for l in range(int(0.30 * fr * 10), int(0.80 * fr * 10), 2))
period = best[1] / fr
bins = 100; hist = [0] * bins
for i, v in enumerate(on): hist[int(((i / fr) % period) / period * bins) % bins] += v
phase = hist.index(max(hist)) / bins * period
print(json.dumps({'bpm': round(60 / period, 2), 'period': round(period, 4), 'phase': round(phase, 4)}))
