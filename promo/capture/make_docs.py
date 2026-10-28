"""Clean dummy documents (fictional content, no real people) and phone-style photos of them on a desk.
Run: python3 -I make_docs.py  -> docs/*.png (flat pages) and docs/photo-*.jpg (as a phone would take them)."""
import math, random, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

F = '/usr/share/fonts/truetype'
serif = lambda s, b=False: ImageFont.truetype(f'{F}/liberation/LiberationSerif-{"Bold" if b else "Regular"}.ttf', s)
sans = lambda s, b=False: ImageFont.truetype(f'{F}/liberation/LiberationSans-{"Bold" if b else "Regular"}.ttf', s)
W, H = 1240, 1754  # A4 at 150 dpi
AIM = 'To find out how quickly water heats up and at what temperature it starts to boil, using a beaker, a burner and a digital thermometer.'.split()
LOREM = ('The sample was heated slowly while the temperature was recorded every thirty seconds. Readings stayed steady '
         'for the first two minutes, then rose by about four degrees per minute until the liquid began to boil. Each run '
         'was repeated three times and the average is shown in the table below. Small differences between runs came from '
         'the starting temperature of the water and from how evenly the beaker was heated.').split()

def para(d, x, y, w, font, words, lh, rng):
    line = ''
    for wd in words:
        t = (line + ' ' + wd).strip()
        if d.textlength(t, font=font) > w: d.text((x, y), line, fill=(38, 38, 42), font=font); y += lh; line = wd
        else: line = t
    if line: d.text((x, y), line, fill=(38, 38, 42), font=font); y += lh
    return y

def report(title, sub, seed, chart=True, bar=True):
    rng = random.Random(seed); im = Image.new('RGB', (W, H), (252, 251, 248)); d = ImageDraw.Draw(im)
    if bar: d.rectangle((0, 0, W, 14), fill=(53, 82, 217))
    d.text((110, 120), title, fill=(25, 25, 30), font=serif(64, True)); d.text((112, 205), sub, fill=(110, 110, 118), font=sans(30))
    d.line((110, 262, W - 110, 262), fill=(200, 200, 205), width=3)
    y = 300
    for h in ('1. Aim', '2. Method'):
        d.text((110, y), h, fill=(25, 25, 30), font=sans(36, True)); y += 60
        y = para(d, 110, y, W - 220, serif(30), LOREM if h.startswith('2') else AIM, 44, rng) + 26
    d.text((110, y), '3. Results', fill=(25, 25, 30), font=sans(36, True)); y += 64
    cols = ['Time (min)', 'Run A (°C)', 'Run B (°C)', 'Average']; cw = (W - 220) / 4
    d.rectangle((110, y, W - 110, y + 52), fill=(232, 236, 250))
    for i, c in enumerate(cols): d.text((126 + i * cw, y + 10), c, fill=(30, 30, 40), font=sans(26, True))
    y += 52
    for r in range(6):
        vals = [str(r), f'{21 + r * 4.1 + rng.random():.1f}', f'{21 + r * 3.9 + rng.random():.1f}', f'{21 + r * 4:.1f}']
        for i, v in enumerate(vals): d.text((126 + i * cw, y + 10), v, fill=(50, 50, 55), font=sans(26))
        y += 50; d.line((110, y, W - 110, y), fill=(220, 220, 225), width=2)
    if chart:
        y += 50; x0, y0, cw2, ch = 160, y, W - 320, min(300, H - 190 - y)
        d.line((x0, y0 + ch, x0 + cw2, y0 + ch), fill=(80, 80, 90), width=3); d.line((x0, y0, x0, y0 + ch), fill=(80, 80, 90), width=3)
        pts = [(x0 + i * cw2 / 9, y0 + ch - (i ** 1.4) * ch / 9 ** 1.4 * 0.9) for i in range(10)]
        d.line(pts, fill=(53, 82, 217), width=6)
        for p in pts: d.ellipse((p[0] - 9, p[1] - 9, p[0] + 9, p[1] + 9), fill=(53, 82, 217))
    d.text((110, H - 110), 'Page 1 of 1  ·  Sample document for demonstration', fill=(150, 150, 155), font=sans(24))
    return im

def notes(seed, margin=60):
    rng = random.Random(seed); im = Image.new('RGB', (W, H), (253, 252, 246)); d = ImageDraw.Draw(im)
    for y in range(220, H - 80, 62): d.line((margin, y, W - margin, y), fill=(196, 214, 238), width=2)
    d.line((170, 0 if margin == 60 else 150, 170, H if margin == 60 else H - 120), fill=(236, 170, 170), width=3)
    hand = ImageFont.truetype('/tmp/claude-0/-home-user-pdf-scanner/677fdab5-5a59-5333-ae00-a8550e0c3561/scratchpad/gen/fonts/Kalam-Regular.ttf', 46)
    lines = ['Week 4 - Light and lenses', '', '* Light travels in straight lines', '* Reflection: angle in = angle out',
             '* Refraction bends light at a boundary', '* Convex lens -> brings rays together', '* Concave lens -> spreads rays out',
             '', 'Focal length f: distance to the focus', '1/f = 1/u + 1/v', '', 'Try at home: water glass + pencil',
             'The pencil looks "broken" at the surface', '', 'Next week: colour and the spectrum']
    for i, t in enumerate(lines): d.text((200, 160 + i * 62), t, fill=(34, 52, 120), font=hand)
    return im

def desk(w, h, seed):
    """A light oak desk with soft window light (procedural grain: noise stretched along the boards, no photos of real places)."""
    rng = np.random.default_rng(seed)
    n = rng.normal(0, 1, (h, w)).astype(np.float32)
    fine = cv2.GaussianBlur(n, (0, 0), sigmaX=40, sigmaY=1.2); fine /= fine.std() + 1e-6
    coarse = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), sigmaX=160, sigmaY=8); coarse /= coarse.std() + 1e-6
    g = 0.6 * fine + 0.4 * coarse
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    seams = (np.abs(((yy + 37) % 420) - 2) < 1.5).astype(np.float32)  # board joints
    base = np.stack([186 + g * 9, 150 + g * 8, 112 + g * 7], -1) * (1 - 0.18 * seams[..., None])
    light = 0.8 + 0.28 * np.exp(-(((xx - w * 0.25) / w) ** 2 + ((yy - h * 0.2) / h) ** 2) * 2.2)
    return np.clip(base * light[..., None], 0, 255).astype(np.uint8)

def photo(page, quad, seed, size=(1500, 2000), tint=(1.0, 0.97, 0.9)):
    """Places a flat page into a phone-style photo: perspective, soft shadow, uneven light, slight blur and noise."""
    w, h = size; bg = desk(w, h, seed).astype(np.float32)
    src = np.float32([[0, 0], [page.width, 0], [page.width, page.height], [0, page.height]]); dst = np.float32(quad)
    M = cv2.getPerspectiveTransform(src, dst); pg = np.asarray(page).astype(np.float32)
    warped = cv2.warpPerspective(pg, M, (w, h)); mask = cv2.warpPerspective(np.ones(pg.shape[:2], np.float32), M, (w, h))
    sh = cv2.GaussianBlur(cv2.warpPerspective(np.ones(pg.shape[:2], np.float32), M, (w, h)), (0, 0), 22)
    sh = np.roll(np.roll(sh, 18, 0), 12, 1); bg *= (1 - 0.45 * sh)[..., None]
    out = bg * (1 - mask[..., None]) + warped * mask[..., None]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    shade = 0.74 + 0.3 * np.exp(-(((xx - w * 0.3) / w) ** 2 + ((yy - h * 0.25) / h) ** 2) * 1.6)  # window light from top-left
    out = out * shade[..., None] * np.float32(tint)
    out = cv2.GaussianBlur(out, (0, 0), 0.8) + np.random.default_rng(seed).normal(0, 3.2, out.shape)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

if __name__ == '__main__':
    r1 = report('Boiling Point Lab', 'Physics · Group 3 · Sample report', 1); r1.save('docs/page-report.png')
    n1 = notes(2); n1.save('docs/page-notes.png')
    r2 = report('Plant Growth Log', 'Biology · Week 2 · Sample report', 3, chart=True); r2.save('docs/page-plants.png')
    photo(r1, [[300, 330], [1260, 250], [1340, 1640], [190, 1720]], 11).save('docs/photo-report.jpg', quality=93)
    photo(n1, [[250, 260], [1230, 310], [1290, 1700], [170, 1650]], 12).save('docs/photo-notes.jpg', quality=93)
    photo(r2, [[230, 300], [1210, 250], [1300, 1690], [200, 1700]], 13).save('docs/photo-plants.jpg', quality=93)
    # A book spread: two pages side by side with a shadowed fold, photographed at an angle
    sp = Image.new('RGB', (W * 2, H), (250, 249, 245)); sp.paste(notes(4, margin=170), (0, 0)); sp.paste(report('Chapter 3 Summary', 'Sample textbook spread', 5, chart=False, bar=False), (W, 0))
    a = np.asarray(sp).astype(np.float32); xx = np.arange(W * 2)[None, :, None]; a *= 1 - 0.28 * np.exp(-((xx - W) / 60.0) ** 2)
    photo(Image.fromarray(a.astype(np.uint8)), [[140, 420], [1910, 380], [1960, 1500], [90, 1540]], 14, size=(2000, 1800)).save('docs/photo-spread.jpg', quality=93)
    print('ok')
