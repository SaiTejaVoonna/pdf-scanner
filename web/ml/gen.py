"""Synthetic training pictures for a page-corner model, built only from things we may use: pages we draw ourselves and CC0 textures
(Poly Haven). Each picture comes with the exact corners of the page (or 'no page')."""
import glob, json, math, os, random, sys
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONTS_TEXT = ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', '/usr/share/fonts/truetype/freefont/FreeSans.ttf', '/usr/share/fonts/truetype/freefont/FreeSerif.ttf']
FONTS_TEXT = [f for f in FONTS_TEXT if os.path.exists(f)] + glob.glob('/usr/share/fonts/opentype/inter/Inter-Regular.otf')
FONTS_HAND = glob.glob(os.path.join(HERE, 'fonts', '*.ttf'))
FONTS_MONO = [f for f in ['/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'] if os.path.exists(f)]
_font_cache = {}
def font(path, size):
    k = (path, size)
    if k not in _font_cache: _font_cache[k] = ImageFont.truetype(path, size)
    return _font_cache[k]

def words(rng, n):
    out = []
    for _ in range(n):
        L = rng.choice([2, 3, 3, 4, 4, 5, 5, 6, 7, 8, 9])
        out.append(''.join(rng.choice('abcdefghijklmnopqrstuvwxyzaeiouaeiou') for _ in range(L)))
    return ' '.join(out)

PAPER = [(250, 250, 248), (245, 241, 230), (238, 235, 222), (252, 252, 255), (244, 246, 250), (255, 250, 235), (230, 232, 236)]
INK = [(20, 20, 25), (30, 30, 80), (10, 10, 120), (40, 40, 40), (90, 20, 20), (15, 60, 40)]

def text_page(rng, W=800, H=1100):
    paper = rng.choice(PAPER); img = Image.new('RGB', (W, H), paper); d = ImageDraw.Draw(img)
    ink = rng.choice(INK); hand = rng.random() < 0.45 and FONTS_HAND
    fpath = rng.choice(FONTS_HAND) if hand else rng.choice(FONTS_TEXT)
    size = rng.randint(22, 34) if hand else rng.randint(16, 26)
    ruled = rng.random() < (0.6 if hand else 0.15)
    gap = int(size * rng.uniform(1.3, 1.8)); top = rng.randint(60, 120); left = rng.randint(50, 110)
    if ruled:
        col = (160, 190, 225) if rng.random() < .7 else (200, 200, 200)
        for y in range(top, H - 40, gap): d.line([(0, y + 6), (W, y + 6)], fill=col, width=1)
        if rng.random() < .6: d.line([(left - 18, 0), (left - 18, H)], fill=(220, 120, 120), width=2)
    if rng.random() < 0.35:   # a title
        d.text((left, top - 45), words(rng, rng.randint(2, 5)).title(), font=font(fpath, size + 10), fill=ink)
    y = top; f = font(fpath, size)
    while y < H - 60:
        if rng.random() < 0.08: y += gap; continue
        txt = words(rng, rng.randint(4, 11)); d.text((left + rng.choice([0, 0, 0, 30]), y), txt, font=f, fill=ink); y += gap
    if rng.random() < 0.3:   # a table or a box
        x0, y0 = rng.randint(60, 200), rng.randint(300, 700); cw, ch = rng.randint(80, 150), rng.randint(30, 50)
        for r in range(rng.randint(2, 5)):
            for c in range(rng.randint(2, 4)): d.rectangle([x0 + c * cw, y0 + r * ch, x0 + (c + 1) * cw, y0 + (r + 1) * ch], outline=ink, width=1)
    return np.array(img)

def receipt(rng):
    W, H = rng.randint(380, 460), rng.randint(900, 1500)
    img = Image.new('RGB', (W, H), rng.choice([(250, 250, 250), (245, 245, 240), (255, 255, 255)])); d = ImageDraw.Draw(img)
    f = font(FONTS_MONO[0] if FONTS_MONO else FONTS_TEXT[0], rng.randint(15, 20)); y = 30
    d.text((W // 2 - 80, y), words(rng, 2).upper(), font=font(FONTS_TEXT[0], 24), fill=(20, 20, 20)); y += 60
    while y < H - 160:
        d.text((24, y), words(rng, rng.randint(2, 4)), font=f, fill=(30, 30, 30)); d.text((W - 110, y), f'{rng.randint(1, 999)}.{rng.randint(0, 99):02d}', font=f, fill=(30, 30, 30)); y += rng.randint(26, 34)
        if rng.random() < 0.08: d.line([(20, y), (W - 20, y)], fill=(120, 120, 120)); y += 12
    x = 40
    for _ in range(60):
        w = rng.choice([2, 3, 4]); d.rectangle([x, H - 110, x + w, H - 40], fill=(10, 10, 10)); x += w + rng.choice([2, 3, 4])
        if x > W - 40: break
    return np.array(img)

def card(rng):
    W, H = 856, 540
    c1 = np.array([rng.randint(120, 255) for _ in range(3)]); c2 = np.array([rng.randint(120, 255) for _ in range(3)])
    g = np.linspace(0, 1, W)[None, :, None]; arr = (c1[None, None, :] * (1 - g) + c2[None, None, :] * g).repeat(H, 0).astype(np.uint8)
    img = Image.fromarray(arr); d = ImageDraw.Draw(img)
    px = rng.choice([40, W - 260]); d.rectangle([px, 110, px + 220, 390], fill=(rng.randint(150, 220),) * 3); d.ellipse([px + 50, 140, px + 170, 260], fill=(rng.randint(90, 180),) * 3)
    f = font(rng.choice(FONTS_TEXT), 26); x0 = 300 if px < 100 else 40
    d.text((x0, 40), words(rng, 3).upper(), font=font(FONTS_TEXT[0], 34), fill=(20, 20, 60))
    for i in range(5): d.text((x0, 130 + i * 52), words(rng, rng.randint(2, 4)), font=f, fill=(25, 25, 25))
    d.rectangle([20, 470, W - 20, 500], fill=(rng.randint(180, 240),) * 3)
    return np.array(img)

def book(rng):
    a, b = text_page(rng, 700, 980), text_page(rng, 700, 980)
    out = np.concatenate([a, b], axis=1).astype(np.float32)
    x = np.arange(out.shape[1])[None, :, None]; c = out.shape[1] / 2
    shade = 1 - rng.uniform(0.25, 0.6) * np.exp(-((x - c) ** 2) / (2 * (rng.uniform(25, 60)) ** 2))
    return np.clip(out * shade, 0, 255).astype(np.uint8)

class Pool:
    def __init__(self, n, seed):
        rng = random.Random(seed); self.items = []
        for i in range(n):
            r = rng.random()
            if r < 0.55: self.items.append(('page', text_page(rng)))
            elif r < 0.7: self.items.append(('receipt', receipt(rng)))
            elif r < 0.85: self.items.append(('card', card(rng)))
            else: self.items.append(('book', book(rng)))
        self.tex = sorted(glob.glob(os.path.join(HERE, 'tex', '*.jpg'))); self._tc = {}
        self.hdri = sorted(glob.glob(os.path.join(HERE, 'hdri', '*.jpg'))) if os.environ.get('GEN_HDRI') else []; self._hc = {}; self.hdri_share = float(os.environ.get('GEN_HDRI_SHARE', '0.3'))
    def texture(self, rng):
        p = rng.choice(self.tex)
        if p not in self._tc:
            im = cv2.imread(p); self._tc[p] = cv2.cvtColor(im, cv2.COLOR_BGR2RGB)
            if len(self._tc) > 40: self._tc.pop(next(iter(self._tc)))
        return self._tc[p]

S = 192
def hdri_view(pool, rng, size=384):
    if not pool.hdri: return None
    p = rng.choice(pool.hdri)
    if p not in pool._hc:
        pool._hc[p] = cv2.cvtColor(cv2.imread(p), cv2.COLOR_BGR2RGB)
        if len(pool._hc) > 12: pool._hc.pop(next(iter(pool._hc)))
    pano = pool._hc[p]; H, W = pano.shape[:2]
    fov = math.radians(rng.uniform(45, 100)); yaw = rng.uniform(0, 2 * math.pi); pitch = math.radians(rng.uniform(-75, 55)); roll = math.radians(rng.uniform(-35, 35)) if rng.random() < 0.6 else 0
    f = 0.5 * size / math.tan(fov / 2)
    xs, ys = np.meshgrid(np.arange(size) - size / 2 + 0.5, np.arange(size) - size / 2 + 0.5)
    xr = xs * math.cos(roll) - ys * math.sin(roll); yr = xs * math.sin(roll) + ys * math.cos(roll)
    d = np.stack([xr, yr, np.full_like(xr, f)], -1); d /= np.linalg.norm(d, axis=-1, keepdims=True)
    cp, sp = math.cos(pitch), math.sin(pitch); cy, sy = math.cos(yaw), math.sin(yaw)
    y1 = d[..., 1] * cp - d[..., 2] * sp; z1 = d[..., 1] * sp + d[..., 2] * cp
    x2 = d[..., 0] * cy + z1 * sy; z2 = -d[..., 0] * sy + z1 * cy
    lon = np.arctan2(x2, z2); lat = np.arcsin(np.clip(y1, -1, 1))
    mx = ((lon / (2 * math.pi) + 0.5) % 1.0) * W; my = (lat / math.pi + 0.5) * H
    v = cv2.remap(pano, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_WRAP)
    return v.astype(np.float32)

def background(pool, rng):
    if pool.hdri and rng.random() < pool.hdri_share:
        v = hdri_view(pool, rng, S * 2)
        if v is not None: return np.clip(v * rng.uniform(0.6, 1.25), 0, 255)
    t = pool.texture(rng); h, w = t.shape[:2]
    scale = rng.uniform(0.25, 1.0); cw = int(min(w, max(64, w * scale))); ch = int(min(h, max(64, h * scale)))
    x, y = rng.randint(0, w - cw), rng.randint(0, h - ch)
    bg = cv2.resize(t[y:y + ch, x:x + cw], (S * 2, S * 2), interpolation=cv2.INTER_AREA).astype(np.float32)
    if rng.random() < 0.5: bg = bg[:, ::-1]
    bg *= rng.uniform(0.5, 1.3)
    return np.clip(bg, 0, 255)

def distractors(img, rng):
    h, w = img.shape[:2]
    for _ in range(rng.randint(0, 4)):
        kind = rng.random()
        col = tuple(int(rng.randint(10, 250)) for _ in range(3))
        if kind < 0.5:   # a box / book / phone lying around
            cx, cy = rng.randint(0, w), rng.randint(0, h); a, b = rng.randint(30, 160), rng.randint(20, 90); ang = rng.uniform(0, 180)
            box = cv2.boxPoints(((cx, cy), (a, b), ang)).astype(np.int32); cv2.fillPoly(img, [box], col)
        elif kind < 0.8:   # a cable
            pts = np.array([[rng.randint(0, w), rng.randint(0, h)] for _ in range(4)], np.int32); cv2.polylines(img, [pts], False, col, rng.randint(2, 6))
        else:
            cv2.ellipse(img, (rng.randint(0, w), rng.randint(0, h)), (rng.randint(15, 60), rng.randint(10, 40)), rng.randint(0, 180), 0, 360, (200, 160, 130), -1)

def canonical(q):
    q = np.array(q, np.float32); s = q.sum(1); d = q[:, 0] - q[:, 1]
    return np.stack([q[s.argmin()], q[d.argmax()], q[s.argmax()], q[d.argmin()]])   # tl, tr, br, bl by position

def sample(pool, rng, negative=False):
    bg = background(pool, rng).astype(np.float32); H = bg.shape[0]
    quad = None
    if not negative:
        kind, doc = rng.choice(pool.items)
        dh, dw = doc.shape[:2]
        ar = dw / dh
        for _ in range(30):
            sc = rng.uniform(0.35, 0.95) * H
            hh = sc if ar < 1.6 else sc / ar * 1.0; ww = hh * ar
            if ww > H * 0.98: ww = H * 0.98; hh = ww / ar
            cx = rng.uniform(ww / 2 + 4, H - ww / 2 - 4) if ww / 2 + 4 < H - ww / 2 - 4 else H / 2
            cy = rng.uniform(hh / 2 + 4, H - hh / 2 - 4) if hh / 2 + 4 < H - hh / 2 - 4 else H / 2
            ang = rng.choice([0, 0, 0, 90, -90]) + rng.uniform(-28, 28) * (1 if rng.random() < 0.8 else 0.15)
            rect = cv2.boxPoints(((cx, cy), (ww, hh), ang)); j = 0.1 * min(ww, hh)
            q = rect + np.array([[rng.uniform(-j, j), rng.uniform(-j, j)] for _ in range(4)])
            if (q > 2).all() and (q < H - 2).all() and cv2.contourArea(q.astype(np.float32)) > 0.05 * H * H and cv2.isContourConvex(q.astype(np.float32).reshape(-1, 1, 2)):
                quad = q; break
        if quad is None: negative = True
    if not negative:
        src = np.array([[0, 0], [dw, 0], [dw, dh], [0, dh]], np.float32)
        # order dest like src: rect from boxPoints is cyclic; sort to tl,tr,br,bl around the centre keeping orientation
        cen = quad.mean(0); order = np.argsort([math.atan2(p[1] - cen[1], p[0] - cen[0]) for p in quad])
        q4 = quad[order].astype(np.float32); k = rng.randint(0, 3); q4 = np.roll(q4, k, axis=0)
        M = cv2.getPerspectiveTransform(src, q4)
        doc_f = doc.astype(np.float32)
        warped = cv2.warpPerspective(doc_f, M, (H, H), flags=cv2.INTER_AREA if dw > H else cv2.INTER_LINEAR)
        mask = cv2.warpPerspective(np.ones((dh, dw), np.float32), M, (H, H), flags=cv2.INTER_LINEAR)[..., None]
        # lighting on the page: soft gradient + page edge darkening
        gx = np.linspace(rng.uniform(0.75, 1.0), rng.uniform(0.85, 1.15), H)[None, :, None]; gy = np.linspace(rng.uniform(0.8, 1.0), rng.uniform(0.9, 1.1), H)[:, None, None]
        warped = warped * gx * gy
        # a soft shadow of the page on the surface
        sh = cv2.GaussianBlur(np.roll(np.roll(mask[..., 0], rng.randint(3, 14), 0), rng.randint(-10, 10), 1), (0, 0), rng.uniform(4, 12))[..., None]
        bg = bg * (1 - rng.uniform(0.15, 0.5) * sh * (1 - mask))
        distractors(bg, rng)
        img = bg * (1 - mask) + warped * mask
        # re-draw some distractors partly over the table only (not over the page): skip for simplicity
        quad = canonical(q4)
    else:
        distractors(bg, rng); img = bg
    img = cv2.resize(img, (S, S), interpolation=cv2.INTER_AREA)
    if quad is not None: quad = quad * (S / H)
    # camera effects
    if rng.random() < 0.5: img = cv2.GaussianBlur(img, (0, 0), rng.uniform(0.3, 1.4))
    if rng.random() < 0.15:
        k = rng.randint(3, 7); ker = np.zeros((k, k), np.float32); ker[k // 2, :] = 1; ker /= k; img = cv2.filter2D(img, -1, ker)
    img = img * rng.uniform(0.6, 1.2) + rng.uniform(-20, 20); img = img + np.array([rng.uniform(-12, 12) for _ in range(3)])
    img = img + np.random.RandomState(rng.randint(0, 1 << 30)).randn(S, S, 3) * rng.uniform(0, 7)
    img = np.clip(img, 0, 255).astype(np.uint8)
    ok, enc = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, rng.randint(35, 95)]); img = cv2.imdecode(enc, 1)  # the channel order is kept as it came in (RGB)
    return np.ascontiguousarray(img), (quad / S if quad is not None else None)

def build(n, seed, neg=float(os.environ.get('GEN_NEG', '0.15')), pool_n=500):
    pool = Pool(pool_n, seed); rng = random.Random(seed + 1)
    X = np.zeros((n, S, S, 3), np.uint8); Y = np.zeros((n, 8), np.float32); P = np.zeros(n, np.float32)
    for i in range(n):
        im, q = sample(pool, rng, negative=rng.random() < neg)
        X[i] = im
        if q is not None: Y[i] = q.reshape(-1); P[i] = 1
    return X, Y, P

if __name__ == '__main__':
    n, seed, out = int(sys.argv[1]), int(sys.argv[2]), sys.argv[3]
    X, Y, P = build(n, seed); np.savez(out, X=X, Y=Y, P=P); print(out, X.shape, P.mean())
