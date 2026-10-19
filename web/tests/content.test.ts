import { describe, expect, it } from 'vitest';
import { detectPage } from '../src/core/detect';
import { contentQuad, inkCrossing, inkPoints } from '../src/core/detect/content';
import { isValidCrop, type Pt, type Quad } from '../src/core/geometry';
import { createImg, type Img } from '../src/core/image';
import { rng } from './scenes';

const W = 400, H = 300;

/** A sheet of handwriting-like strokes on bright paper; optional dark desk, shadowed left half, white folder strip. */
function sheet(o: { desk?: boolean; shadowLeft?: boolean; folder?: boolean; seed?: number } = {}): { img: Img; text: Pt[] } {
  const img = createImg(W, H), rnd = rng(o.seed ?? 3), text: Pt[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const onPage = x >= 90 && x <= 370 && y >= 30 && y <= 270;
    let v = o.desk === false ? 215 : 70 + ((x * 3 + y * 5) % 9);
    if (o.folder && x >= 30 && x < 90) v = 246;
    if (onPage) {
      v = 232;
      if (o.shadowLeft && x < 200) v = 188;            // the left half lies in shadow: a straight brightness step at x = 200
      const row = y > 50 && (y - 50) % 18 < 2, stroke = ((x * 7 + y) % 9) < 5;
      if (row && x > 105 && x < 355 && stroke) { v = 45; text.push({ x, y }); }
    }
    v += Math.floor(rnd() * 5) - 2;
    const i = (y * W + x) * 4;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v + 6; img.data[i + 3] = 255;
  }
  return { img, text };
}

const inside = (q: Quad, p: Pt) => { for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; if ((b.x * W - a.x * W) * (p.y - a.y * H) - (b.y * H - a.y * H) * (p.x - a.x * W) < -2) return false; } return true; };

describe('ink and content box', () => {
  it('finds strokes but not page edges or a dark desk', () => {
    const { img, text } = sheet();
    const ink = inkPoints(img);
    expect(ink.length).toBeGreaterThan(text.length * 0.4);
    const onPage = ink.filter((p) => p.x > 85 && p.x < 375 && p.y > 25 && p.y < 275).length / ink.length;
    expect(onPage).toBeGreaterThan(0.97); // essentially nothing from the desk or the page border
  });
  it('contentQuad wraps the writing with a margin and is a valid crop', () => {
    const { img } = sheet();
    const q = contentQuad(inkPoints(img), W, H, 0.05)!;
    expect(isValidCrop(q)).toBe(true);
    expect(q[0].x * W).toBeLessThan(110); expect(q[1].x * W).toBeGreaterThan(350);
    expect(q[0].x * W).toBeGreaterThan(80); expect(q[2].y * H).toBeLessThan(290);
  });
  it('inkCrossing is high when an edge runs through the text and about zero along the page edge', () => {
    const { img } = sheet();
    const ink = inkPoints(img);
    const through: Quad = [{ x: 200 / W, y: 30 / H }, { x: 370 / W, y: 30 / H }, { x: 370 / W, y: 270 / H }, { x: 200 / W, y: 270 / H }];
    const clean: Quad = [{ x: 90 / W, y: 30 / H }, { x: 370 / W, y: 30 / H }, { x: 370 / W, y: 270 / H }, { x: 90 / W, y: 270 / H }];
    expect(inkCrossing(ink, through, W, H)).toBeGreaterThan(0.1);
    expect(inkCrossing(ink, clean, W, H)).toBeLessThan(0.03);
  });
});

describe('detectPage never cuts the writing', () => {
  for (const [name, opts] of [
    ['page with a shadowed left half beside a white folder', { shadowLeft: true, folder: true }],
    ['page with a shadowed left half', { shadowLeft: true }],
    ['plain page on a desk', {}],
  ] as const) {
    it(name, () => {
      for (const seed of [1, 2, 3]) {
        const { img, text } = sheet({ ...opts, seed });
        const q = detectPage(img);
        if (!q) continue; // declining is always safe
        const lost = text.filter((p) => !inside(q, p)).length / text.length;
        expect(lost, `seed ${seed}`).toBeLessThan(0.02);
      }
    });
  }
});
