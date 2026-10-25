"""Stress test: take the real exam photos and break them in nasty ways; measure how the model holds up."""
import sys, numpy as np, torch, cv2
sys.path.insert(0, '.'); from model import CornerNet
torch.set_num_threads(2)
ex = np.load('exam.npz'); X, Y, P = ex['X'], ex['Y'], ex['P']; pos = P > 0
net = CornerNet(); net.load_state_dict(torch.load(sys.argv[1] if len(sys.argv) > 1 else 'net.pt')); net.eval()
rng = np.random.RandomState(1)
def iou(a, b, S=96):
    ma = np.zeros((S, S), np.uint8); mb = np.zeros((S, S), np.uint8)
    cv2.fillPoly(ma, [(a.reshape(4, 2) * S).astype(np.int32)], 1); cv2.fillPoly(mb, [(b.reshape(4, 2) * S).astype(np.int32)], 1)
    return (ma & mb).sum() / max(1, (ma | mb).sum())
def run(Xs):
    qs, ps = [], []
    with torch.no_grad():
        for i in range(0, len(Xs), 128):
            x = ((torch.from_numpy(np.ascontiguousarray(Xs[i:i+128])).permute(0, 3, 1, 2).float() / 255) - 0.5) / 0.25
            q, p, _ = net(x); qs.append(q.numpy()); ps.append(torch.sigmoid(p).numpy())
    return np.concatenate(qs), np.concatenate(ps)
def clip(a): return np.clip(a, 0, 255).astype(np.uint8)
def blur(x, k): return cv2.GaussianBlur(x, (0, 0), k)
def jpeg(x, q): return cv2.imdecode(cv2.imencode('.jpg', x, [cv2.IMWRITE_JPEG_QUALITY, q])[1], 1)
def glare(x):
    h, w = x.shape[:2]; yy, xx = np.mgrid[:h, :w]; cx, cy = rng.uniform(0.2, 0.8) * w, rng.uniform(0.2, 0.8) * h
    g = np.exp(-(((xx - cx) / (w * .25)) ** 2 + ((yy - cy) / (h * .2)) ** 2)) * 200
    return clip(x.astype(np.float32) + g[..., None])
def shadow(x):
    h, w = x.shape[:2]; m = np.ones((h, w), np.float32); m[:, int(w * rng.uniform(.3, .7)):] = 0.45; return clip(blur(m, 6)[..., None] * x)
def noise(x, s): return clip(x + rng.randn(*x.shape) * s)
def lowres(x): return cv2.resize(cv2.resize(x, (48, 48), interpolation=cv2.INTER_AREA), (192, 192))
# transforms that keep the label identical (photometric)
PHOTO = {'baseline': lambda x: x, 'blur_motion': lambda x: cv2.filter2D(x, -1, np.eye(9)[::-1 if rng.rand() < .5 else 1] / 9),
  'blur_gauss3': lambda x: blur(x, 3), 'dark_x0.35': lambda x: clip(x * 0.35), 'bright_x1.6': lambda x: clip(x * 1.6 + 20),
  'low_contrast': lambda x: clip((x - 128) * 0.45 + 128), 'noise_25': lambda x: noise(x, 25), 'jpeg_q8': lambda x: jpeg(x, 8),
  'lowres_48': lowres, 'glare': glare, 'shadow_half': shadow, 'grayscale': lambda x: np.repeat(cv2.cvtColor(x, cv2.COLOR_BGR2GRAY)[..., None], 3, 2),
  'color_cast': lambda x: clip(x * np.array([1.0, 0.8, 1.3])), 'invert_dark_mode': lambda x: 255 - x}
print(f'{"case":22s} IoU>=0.8  IoU>=0.9  false-green  green-on-nopage')
res = {}
for name, f in PHOTO.items():
    Xt = np.stack([f(x) for x in X]); q, p = run(Xt)
    io = np.array([iou(q[i], Y[i]) if pos[i] else 0 for i in range(len(q))]); g = p > 0.5
    row = (100 * (io[pos] >= .8).mean(), 100 * (io[pos] >= .9).mean(), 100 * (g[pos] & (io[pos] < .8)).mean(), 100 * g[~pos].mean())
    res[name] = row; print(f'{name:22s} {row[0]:7.0f}%  {row[1]:7.0f}%  {row[2]:9.0f}%  {row[3]:11.0f}%', flush=True)
# geometry: rotate 90/180/270 and mirror (label rotates too, canonical order by position)
def canon(y):
    p = y.reshape(4, 2); s = p[:, 0] + p[:, 1]; d = p[:, 0] - p[:, 1]
    return np.array([p[np.argmin(s)], p[np.argmax(d)], p[np.argmax(s)], p[np.argmin(d)]]).reshape(-1)
for k, nm in [(1, 'rot90'), (2, 'rot180'), (3, 'rot270')]:
    Xt = np.stack([np.rot90(x, k) for x in X]); q, p = run(Xt)
    Yr = []
    for y in Y:
        pts = y.reshape(4, 2).copy()
        for _ in range(k): pts = np.stack([pts[:, 1], 1 - pts[:, 0]], 1)
        Yr.append(canon(pts.reshape(-1)))
    io = np.array([iou(q[i], Yr[i]) if pos[i] else 0 for i in range(len(q))]); g = p > 0.5
    print(f'{nm:22s} {100*(io[pos]>=.8).mean():7.0f}%  {100*(io[pos]>=.9).mean():7.0f}%  {100*(g[pos]&(io[pos]<.8)).mean():9.0f}%  {100*g[~pos].mean():11.0f}%', flush=True)
# occlusion: a finger/hand blob over a page edge, and cut-off pages (zoom in so corners leave the frame)
def occl(x):
    x = x.copy(); h, w = x.shape[:2]; c = (int(rng.uniform(.2, .8) * w), int(rng.uniform(.2, .8) * h))
    cv2.ellipse(x, c, (int(w * .12), int(h * .28)), rng.uniform(0, 180), 0, 360, (90, 130, 190), -1); return x
Xt = np.stack([occl(x) for x in X]); q, p = run(Xt)
io = np.array([iou(q[i], Y[i]) if pos[i] else 0 for i in range(len(q))]); g = p > 0.5
print(f'{"hand_over_page":22s} {100*(io[pos]>=.8).mean():7.0f}%  {100*(io[pos]>=.9).mean():7.0f}%  {100*(g[pos]&(io[pos]<.8)).mean():9.0f}%  {100*g[~pos].mean():11.0f}%')
# pure junk frames: must never be green
junk = {'black': np.zeros((300, 192, 192, 3), np.uint8), 'white': np.full((300, 192, 192, 3), 255, np.uint8),
        'noise': rng.randint(0, 255, (300, 192, 192, 3)).astype(np.uint8), 'gradient': np.stack([np.tile(np.linspace(0, 255, 192)[None, :, None], (192, 1, 3)).astype(np.uint8)] * 300),
        'stripes': np.stack([np.tile((np.arange(192) // 12 % 2 * 255)[None, :, None], (192, 1, 3)).astype(np.uint8)] * 300),
        'face_skin': np.full((300, 192, 192, 3), (120, 150, 200), np.uint8)}
for n, a in junk.items():
    q, p = run(a); print(f'junk {n:17s} green {100*(p>.5).mean():.0f}%')
