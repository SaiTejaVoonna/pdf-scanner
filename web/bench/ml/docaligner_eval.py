"""Offline evaluation of DocAligner heatmap models (ONNX) on the labelled photos. NOT part of the app or its bundle.

  python3 docaligner_eval.py <photos-folder> <labels.json> <model.onnx> [more.onnx ...]

Pre/post-processing follows DocAligner's heatmap_reg/infer.py: RGB, resize to 256x256, /255, NCHW; output (1,4,H,W)
heatmaps, each resized to the image size, thresholded at 0.3, the centroid of the largest blob is the corner.
Scores raw detection with the same metrics as bench/score.mjs (IoU against the labelled pages, union).
"""
import json, os, sys, time
import cv2, numpy as np
import onnxruntime as ort

photos, labels_path, models = sys.argv[1], sys.argv[2], sys.argv[3:]
labels = {k: v for k, v in json.load(open(labels_path)).items() if not k.startswith('_')}

def corners(sess, bgr):
    h, w = bgr.shape[:2]
    x = cv2.resize(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), (256, 256)).transpose(2, 0, 1)[None].astype('float32') / 255.0
    t = time.perf_counter()
    heat = sess.run(None, {sess.get_inputs()[0].name: x})[0]
    ms = (time.perf_counter() - t) * 1000
    pts = []
    for i in range(4):
        m = cv2.resize(heat[0, i], (w, h))
        m[m < 0.3] = 0
        m = (m * 255).astype('uint8')
        _, b = cv2.threshold(m, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        cs, _ = cv2.findContours(b, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not cs: return None, ms
        c = max(cs, key=cv2.contourArea)
        M = cv2.moments(c)
        if M['m00'] == 0: return None, ms
        pts.append((M['m10'] / M['m00'] / w, M['m01'] / M['m00'] / h))
    return pts, ms

def raster(polys, n=300):
    img = np.zeros((n, n), np.uint8)
    for p in polys: cv2.fillPoly(img, [np.array([[x * n, y * n] for x, y in p], np.int32)], 1)
    return img.astype(bool)

for model in models:
    sess = ort.InferenceSession(model, providers=['CPUExecutionProvider'])
    print(f'\n== {os.path.basename(model)}  ({os.path.getsize(model) / 1e6:.2f} MB)')
    for name, lab in labels.items():
        img = cv2.imread(os.path.join(photos, lab['file']))
        pts, ms = corners(sess, img)
        want = lab.get('pages')
        if lab['expect'] == 'none':
            print(f'{name:22s} expect none: model returned {"a quad (FALSE POSITIVE)" if pts else "nothing"}  {ms:.0f} ms'); continue
        if not pts: print(f'{name:22s} nothing returned  {ms:.0f} ms'); continue
        gt, pr = raster(want), raster([pts])
        iou = (gt & pr).sum() / max(1, (gt | pr).sum())
        loss = 1 - (raster([[(cx + (x - cx) * .95, cy + (y - cy) * .95) for x, y in q] for q in want for cx, cy in [(sum(a for a, _ in q) / 4, sum(b for _, b in q) / 4)]]) & pr).sum() / max(1, raster([[(cx + (x - cx) * .95, cy + (y - cy) * .95) for x, y in q] for q in want for cx, cy in [(sum(a for a, _ in q) / 4, sum(b for _, b in q) / 4)]]).sum())
        print(f'{name:22s} IoU {iou * 100:5.1f}%  must-keep loss {loss * 100:5.1f}%  {ms:.0f} ms  corners {[(round(x, 3), round(y, 3)) for x, y in pts]}')
