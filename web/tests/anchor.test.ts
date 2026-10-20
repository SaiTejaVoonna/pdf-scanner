import { describe, expect, it } from 'vitest';
import { detectAnchored, lineEvidence, pageLike, plausibleShape, ANCHOR_LEFT, ANCHOR_RIGHT } from '../src/core/anchor';
import { detectPage } from '../src/core/detect';
import { createImg, type Img } from '../src/core/image';
import type { Quad } from '../src/core/geometry';
import { rng } from './scenes';

const W = 400, H = 300;
type Fn = (x: number, y: number) => number;
const make = (fn: Fn, seed = 1): Img => {
  const img = createImg(W, H), rnd = rng(seed);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const v = Math.max(0, Math.min(255, fn(x, y) + Math.floor(rnd() * 7) - 3));
    const i = (y * W + x) * 4; img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v - 3; img.data[i + 3] = 255;
  }
  return img;
};
/** handwriting-like dashes on rows */
const ink = (x: number, y: number, x0: number, x1: number, top: number, bottom: number) =>
  x > x0 + 16 && x < x1 - 16 && y > top + 16 && y < bottom - 16 && y % 14 < 3 && ((x * 7 + y * 3) % 11) < 6;

/** A loose sheet whose left edge sits on the left guide line (x = 0.085 W), on a darker desk. */
const sheet = (right: number) => make((x, y) => {
  const on = x >= 34 && x <= right && y >= 28 && y <= 276;
  return ink(x, y, 34, right, 28, 276) ? 55 : on ? 225 : 85;
});
/** One page of an open book: the fold is on the right guide line (x = 0.92 W), the other page continues to the frame edge. */
const notebook = () => make((x, y) => {
  const left = x >= 26 && x <= 368 && y >= 28 && y <= 276, right = x > 368 && y >= 20 && y <= 282;
  const fold = 215 * 0.5 * Math.exp(-((x - 368) * (x - 368)) / 40);
  if (left && ink(x, y, 26, 368, 28, 276)) return 55;
  if (right && ink(x, y, 368, 460, 20, 282)) return 55;
  return (left || right ? 225 : 85) - (left || right ? fold : 0);
});

const near = (q: Quad | null, i: number, v: number, tol: number) => { expect(q).not.toBeNull(); expect(Math.abs(q![i].x - v)).toBeLessThan(tol); };

describe('anchor lines', () => {
  it('sees an edge or fold on a guide line, and not on a plain surface', () => {
    expect(lineEvidence(sheet(300), ANCHOR_LEFT).evidence).toBeGreaterThanOrEqual(0.4);
    expect(lineEvidence(notebook(), ANCHOR_RIGHT).evidence).toBeGreaterThanOrEqual(0.4);
    expect(lineEvidence(make(() => 120), ANCHOR_LEFT).evidence).toBeLessThan(0.4);
    // a busy texture may show weak fold-like valleys, but never a clear page edge
    const busy = lineEvidence(make((x, y) => 100 + ((x * 13 + y * 7) % 40)), ANCHOR_RIGHT);
    expect(busy.kind === 'edge').toBe(false);
  });
  it('pins the left edge of a loose sheet and finds the other sides', () => {
    const r = detectAnchored(sheet(300));
    expect(r.anchor).toBe('left');
    near(r.quad, 0, 34 / W, 0.03); near(r.quad, 3, 34 / W, 0.03);
    near(r.quad, 1, 300 / W, 0.04);
  });
  it('stops at the fold when one page of an open book is wanted (never reaches into the other page)', () => {
    const r = detectAnchored(notebook());
    expect(['right', 'both']).toContain(r.anchor); // the page's own left edge may also sit near the left line
    near(r.quad, 1, 368 / W, 0.03); near(r.quad, 2, 368 / W, 0.03);
    near(r.quad, 0, 26 / W, 0.04);
  });
  it('falls back to the normal detector when nothing sits on the lines', () => {
    const img = sheet(300);
    const shifted = make((x, y) => { const on = x >= 130 && x <= 300 && y >= 28 && y <= 276; return ink(x, y, 130, 300, 28, 276) ? 55 : on ? 225 : 85; });
    const r = detectAnchored(shifted);
    expect(r.anchor).toBeNull();
    expect(JSON.stringify(r.quad)).toBe(JSON.stringify(detectPage(shifted)));
    expect(img.width).toBe(W);
  });
});

describe('page-like check for auto-capture', () => {
  const page = sheet(300);
  const quadOf = (l: number, r: number): Quad => [{ x: l / W, y: 28 / H }, { x: r / W, y: 28 / H }, { x: r / W, y: 276 / H }, { x: l / W, y: 276 / H }];
  it('accepts a page with writing on a darker desk', () => expect(pageLike(page, quadOf(34, 300)).ok).toBe(true));
  it('rejects a blank floor texture, a dark scene and a blank sheet', () => {
    const floor = make((x, y) => 120 + ((x * 13 + y * 7) % 50) + (Math.sin(x / 9) * 12 + Math.cos(y / 7) * 12));
    expect(pageLike(floor, quadOf(60, 340)).ok).toBe(false);
    const dark = make((x, y) => (x >= 34 && x <= 300 && y >= 28 && y <= 276 ? 40 + (ink(x, y, 34, 300, 28, 276) ? -20 : 0) : 20));
    expect(pageLike(dark, quadOf(34, 300))).toEqual({ ok: false, why: 'dark' });
    const blank = make((x, y) => (x >= 34 && x <= 300 && y >= 28 && y <= 276 ? 225 : 85));
    expect(pageLike(blank, quadOf(34, 300))).toEqual({ ok: false, why: 'blank' });
  });
});

describe('plausible shape', () => {
  const q = (pts: number[][]) => pts.map(([x, y]) => ({ x, y })) as Quad;
  it('accepts a sheet, a sheet seen at an angle and an open book', () => {
    expect(plausibleShape(q([[0.1, 0.1], [0.7, 0.12], [0.72, 0.9], [0.08, 0.88]]), 400, 300)).toBe(true);
    expect(plausibleShape(q([[0.2, 0.15], [0.75, 0.1], [0.8, 0.85], [0.15, 0.9]]), 400, 300)).toBe(true);
    expect(plausibleShape(q([[0.04, 0.09], [0.8, 0.02], [0.81, 0.88], [0.04, 0.92]]), 400, 300, 3)).toBe(true);
  });
  it('rejects a ceiling-beam sliver, a very skewed trapezoid and a thin strip', () => {
    expect(plausibleShape(q([[0.0, 0.62], [1.0, 0.36], [1.0, 0.46], [0.0, 0.74]]), 400, 300)).toBe(false);
    expect(plausibleShape(q([[0.1, 0.2], [0.9, 0.2], [0.9, 0.8], [0.75, 0.25]]), 400, 300)).toBe(false);
    expect(plausibleShape(q([[0.1, 0.1], [0.9, 0.1], [0.9, 0.2], [0.1, 0.2]]), 400, 300)).toBe(false);
  });
});
