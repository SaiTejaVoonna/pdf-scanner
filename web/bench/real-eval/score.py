"""Scores result.json (from the engine) against eval.json (true corners). Usage: python3 -I score.py DIR. Needs numpy, opencv-python."""
import json, sys, collections
import numpy as np, cv2
d = sys.argv[1]
meta = json.load(open(f'{d}/eval.json')); res = json.load(open(f'{d}/result.json'))
print('engine ms per image:', round(res['ms'] / len(meta), 1))
def mask(q, w, h):
    m = np.zeros((h, w), np.uint8); cv2.fillPoly(m, [np.array([[x * w, y * h] for x, y in q], np.int32)], 1); return m
rows = []
for m, r in zip(meta, res['out']):
    gt = mask(m['gt'], m['w'], m['h'])
    iou = 0.0
    if r['quad']:
        pr = mask([[p['x'], p['y']] for p in r['quad']], m['w'], m['h']); iou = (gt & pr).sum() / max(1, (gt | pr).sum())
    rows.append((m['name'].split('_')[0], iou, r['quad'] is not None, r['sure']))
def rep(name, rs):
    n = len(rs)
    f = lambda c: round(100 * sum(1 for r in rs if c(r)) / n)
    print(f"{name:10s} n={n:3d} found={f(lambda r: r[2])}% IoU>=0.9:{f(lambda r: r[1] >= 0.9)}% >=0.8:{f(lambda r: r[1] >= 0.8)}% green={f(lambda r: r[3])}% FALSE-GREEN={f(lambda r: r[3] and r[1] < 0.8)}%")
rep('ALL', rows)
for c, _ in collections.Counter(r[0] for r in rows).most_common(6): rep(c, [r for r in rows if r[0] == c])
