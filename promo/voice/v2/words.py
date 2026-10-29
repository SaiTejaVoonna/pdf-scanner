"""Transcribes every voice line with faster-whisper (small.en) to check the words, and writes words.json with each caption
word's start and end (s). Caption words come from lines.json "text"; times come from the recogniser, matched in order."""
import json, re, subprocess
import numpy as np
from faster_whisper import WhisperModel
m = WhisperModel('small.en', device='cpu', compute_type='int8')
out, bad = {}, []
# 16 kHz mono float samples through ffmpeg (this PyAV build cannot open files for faster-whisper)
pcm16k = lambda f: np.frombuffer(subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', f, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout, np.float32)
norm = lambda s: re.sub(r"[^a-z0-9]", '', s.lower())
for l in json.load(open('lines.json')):
    segs, _ = m.transcribe(pcm16k(f"af_heart-{l['id']}.wav"), word_timestamps=True, language='en')
    ws = [w for s in segs for w in s.words]
    heard = ' '.join(w.word.strip() for w in ws)
    cap = l['text'].split()
    print(f"{l['id']:8s} heard: {heard}")
    if len(ws) != len(cap): bad.append((l['id'], len(ws), len(cap)))
    times = [(w.start, w.end) for w in ws]
    while len(times) < len(cap): times.append(times[-1])
    out[l['id']] = [{'w': c, 's': round(times[i][0], 2), 'e': round(times[i][1], 2)} for i, c in enumerate(cap)]
json.dump(out, open('words.json', 'w'), indent=1)
print('word-count mismatches:', bad)
