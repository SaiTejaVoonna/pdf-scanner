"""Second reel voiceover with Kokoro-82M (Apache-2.0) via kokoro-onnx: one WAV per line ("say" overrides the spoken text,
"speed" the pace), then prints the durations. Run from this folder: python speak.py MODEL_DIR [VOICE]"""
import json, sys, soundfile as sf
from kokoro_onnx import Kokoro
k = Kokoro(f'{sys.argv[1]}/kokoro-v1.0.onnx', f'{sys.argv[1]}/voices-v1.0.bin')
voice = sys.argv[2] if len(sys.argv) > 2 else 'af_heart'
for l in json.load(open('lines.json')):
    a, sr = k.create(l.get('say', l['text']), voice=voice, speed=l.get('speed', 1.0), lang='en-us')
    sf.write(f"{voice}-{l['id']}.wav", a, sr); print(f"{l['id']:8s} {len(a)/sr:.2f}s")
