import { describe, expect, it } from 'vitest';
import { isConvex, type Pt, type Quad } from '../src/core/geometry';
import { detectPage, padQuad } from '../src/core/detect';
import { createImg } from '../src/core/image';
import { rng, scene } from './scenes';

const W = 320, H = 420;
const persp: Pt[] = [{ x: 60, y: 55 }, { x: 265, y: 80 }, { x: 285, y: 365 }, { x: 40, y: 385 }];

function expectCorners(expected: Pt[], q: Quad | null, tol = 0.045) {
  expect(q).not.toBeNull();
  expected.forEach((e, i) => {
    expect(Math.abs(e.x / W - q![i].x), `corner ${i} x`).toBeLessThanOrEqual(tol);
    expect(Math.abs(e.y / H - q![i].y), `corner ${i} y`).toBeLessThanOrEqual(tol);
  });
}

describe('detectPage', () => {
  it('textured background with shadow and perspective', () => {
    expectCorners(persp, detectPage(scene({ page: persp, bg: [110, 100, 95], paper: [225, 222, 212] })));
  });
  it('clutter behind the page (folder strip and blue card)', () => {
    expectCorners(persp, detectPage(scene({ page: persp, bg: [150, 140, 130], paper: [235, 235, 228], clutter: true, seed: 3 })), 0.06);
  });
  it('strongly textured, fairly light background (a bed sheet) with clutter', () => {
    const page: Pt[] = [{ x: 90, y: 100 }, { x: 250, y: 90 }, { x: 270, y: 330 }, { x: 80, y: 345 }];
    for (const seed of [2, 4, 6]) expectCorners(page, detectPage(scene({ page, bg: [150, 135, 125], paper: [240, 238, 235], bgTexture: 45, clutter: true, shadow: 15, seed })), 0.07);
  });
  it('low contrast page', () => {
    expectCorners(persp, detectPage(scene({ page: persp, bg: [165, 160, 155], paper: [205, 202, 196], bgTexture: 8, shadow: 10, seed: 5 })), 0.06);
  });
  it('page differing from the background only in colour, not brightness', () => {
    expectCorners(persp, detectPage(scene({ page: persp, bg: [200, 140, 100], paper: [140, 150, 200], bgTexture: 4, shadow: 0, seed: 9 })), 0.06);
  });
  it('rotated page', () => {
    const rot: Pt[] = [{ x: 110, y: 30 }, { x: 290, y: 120 }, { x: 215, y: 390 }, { x: 35, y: 300 }];
    expectCorners(rot, detectPage(scene({ page: rot, bg: [95, 95, 100], paper: [230, 230, 225], seed: 11 })), 0.06);
  });
  it('page cut off by the right edge of the frame keeps clamped corners', () => {
    const cut: Pt[] = [{ x: 50, y: 60 }, { x: 360, y: 60 }, { x: 360, y: 370 }, { x: 50, y: 370 }];
    const expected: Pt[] = [{ x: 50, y: 60 }, { x: W, y: 60 }, { x: W, y: 370 }, { x: 50, y: 370 }];
    expectCorners(expected, detectPage(scene({ page: cut, bg: [100, 95, 90], paper: [228, 226, 218], seed: 13 })), 0.05);
  });
  it('a dark page on a bright table', () => {
    const page: Pt[] = [{ x: 40, y: 50 }, { x: 160, y: 50 }, { x: 160, y: 230 }, { x: 40, y: 230 }];
    const q = detectPage(scene({ page, bg: [235, 235, 235], paper: [60, 60, 60], bgTexture: 4, shadow: 0, text: false, w: 200, h: 280, seed: 2 }));
    expect(q).not.toBeNull();
    expect(Math.abs(q![0].x - 0.2)).toBeLessThan(0.05);
    expect(Math.abs(q![2].y - 230 / 280)).toBeLessThan(0.05);
  });
  it('texture only is not a document', () => {
    const none: Pt[] = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    expect(detectPage(scene({ page: none, bg: [120, 110, 100], paper: [0, 0, 0], bgTexture: 30, seed: 4 }))).toBeNull();
  });
  it('random noise is not a document', () => {
    const img = createImg(200, 280), r = rng(3);
    for (let i = 0; i < 200 * 280; i++) { const v = Math.floor(r() * 256); img.data.set([v, v, v, 255], i * 4); }
    expect(detectPage(img)).toBeNull();
  });
  it('a page filling the whole frame returns null so the full image is kept', () => {
    const full: Pt[] = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
    expect(detectPage(scene({ page: full, bg: [0, 0, 0], paper: [230, 230, 225], seed: 6 }))).toBeNull();
  });
  it('a full-frame page with text never yields a text-block crop (many noise seeds)', () => {
    const full: Pt[] = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
    for (let seed = 1; seed <= 12; seed++) {
      expect(detectPage(scene({ page: full, bg: [0, 0, 0], paper: [230, 230, 225], seed })), `seed ${seed}`).toBeNull();
    }
  });
  it('finds the page reliably across noise seeds', () => {
    for (let seed = 1; seed <= 8; seed++) {
      expectCorners(persp, detectPage(scene({ page: persp, bg: [110, 100, 95], paper: [225, 222, 212], seed })), 0.06);
    }
  });
  it('pads the crop outwards, stays inside the image and keeps a valid shape', () => {
    const q: Quad = [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }];
    const p = padQuad(q, 0.05);
    expect(p[0].x).toBeLessThan(0.2); expect(p[2].x).toBeGreaterThan(0.8);
    expect(p[0].y).toBeLessThan(0.2); expect(p[2].y).toBeGreaterThan(0.8);
    const edge: Quad = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
    padQuad(edge, 0.1).forEach((pt) => { expect(pt.x).toBeGreaterThanOrEqual(0); expect(pt.x).toBeLessThanOrEqual(1); expect(pt.y).toBeGreaterThanOrEqual(0); expect(pt.y).toBeLessThanOrEqual(1); });
    expect(isConvex(p)).toBe(true);
  });
  it('rejects tiny images without throwing', () => {
    expect(detectPage(createImg(4, 4))).toBeNull();
  });
  it('always returns a convex clockwise quad when it finds something', () => {
    const q = detectPage(scene({ page: persp, bg: [110, 100, 95], paper: [225, 222, 212] }))!;
    expect(isConvex(q)).toBe(true);
  });
  it('is fast enough (under 2 s per 320x420 image)', () => {
    const img = scene({ page: persp, bg: [110, 100, 95], paper: [225, 222, 212] });
    const start = performance.now();
    detectPage(img);
    expect(performance.now() - start).toBeLessThan(2000);
  });
});
