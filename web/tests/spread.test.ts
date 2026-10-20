import { describe, expect, it } from 'vitest';
import { cloneQuad, fullQuad, type Quad } from '../src/core/geometry';
import { createImg, type Img } from '../src/core/image';
import { boundaryInk, findGutter, foldFromGuide, gutterPoints, isValidSpread, midGutter, splitSpread, turnOuter } from '../src/core/spread';
import { rng } from './scenes';

const W = 400, H = 300;
const outerPx = [{ x: 40, y: 30 }, { x: 360, y: 30 }, { x: 360, y: 270 }, { x: 40, y: 270 }];
const outerQ = outerPx.map((p) => ({ x: p.x / W, y: p.y / H })) as Quad;

/** Two bright pages on a darker desk with a soft dark fold, writing rows, optional fold tilt. */
function spreadImg(o: { gutterX?: number; tilt?: number; fold?: number; foldWidth?: number; writingToFold?: boolean; seed?: number } = {}): Img {
  const img = createImg(W, H), rnd = rng(o.seed ?? 1);
  const gx0 = o.gutterX ?? 200, tilt = o.tilt ?? 0, fold = o.fold ?? 0.35;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const onPage = x >= 40 && x <= 360 && y >= 30 && y <= 270;
    let v = onPage ? 228 : 90;
    if (onPage && fold > 0) { const d = x - (gx0 + tilt * (y - 150)); v -= 228 * fold * Math.exp(-(d * d) / (o.foldWidth ?? 200)); }
    // handwriting: short dark dashes in rows, away from the fold unless asked
    if (onPage && y > 50 && y % 16 < 3) {
      const d = Math.abs(x - (gx0 + tilt * (y - 150)));
      if (x > 70 && x < 330 && (d > 30 || o.writingToFold) && ((x * 7 + y * 3) % 11) < 6) v = 60;
    }
    v += Math.floor(rnd() * 7) - 3;
    const i = (y * W + x) * 4;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v - 3; img.data[i + 3] = 255;
  }
  return img;
}

describe('spread geometry', () => {
  it('splits into a left page and a right page that share the gutter, in reading order', () => {
    const g = { outer: outerQ, tTop: 0.5, tBottom: 0.5 };
    const [l, r] = splitSpread(g);
    expect(l[1]).toEqual(r[0]);
    expect(l[2]).toEqual(r[3]);
    expect(l[0]).toEqual(outerQ[0]);
    expect(r[1]).toEqual(outerQ[1]);
    expect(gutterPoints(g)[0].x).toBeCloseTo(0.5, 5);
  });
  it('a tilted gutter gives two valid quadrilaterals and stays valid at the extremes', () => {
    expect(isValidSpread({ outer: outerQ, tTop: 0.4, tBottom: 0.6 })).toBe(true);
    expect(isValidSpread({ outer: outerQ, tTop: 0.01, tBottom: 0.5 })).toBe(false);
    expect(isValidSpread({ outer: outerQ, tTop: 0.97, tBottom: 0.5 })).toBe(true);
  });
  it('quarter turns relabel the corners without moving them', () => {
    const t = turnOuter(outerQ, 1);
    expect(t[0]).toEqual(outerQ[1]);
    expect(t[3]).toEqual(outerQ[0]);
    expect(turnOuter(outerQ, 4)).toEqual(outerQ);
    expect(turnOuter(outerQ, -1)[0]).toEqual(outerQ[3]);
  });
  it('a spread on the whole frame is valid and clones are independent', () => {
    const g = midGutter(fullQuad());
    expect(isValidSpread(g)).toBe(true);
    const c = cloneQuad(g.outer); c[0].x = 0.3;
    expect(g.outer[0].x).toBe(0);
  });
});

describe('findGutter', () => {
  it('finds a clear fold, vertical or tilted, across noise seeds', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const v = findGutter(spreadImg({ seed }), outerQ);
      expect(v.confident, `vertical seed ${seed}`).toBe(true);
      expect(Math.abs(v.tTop - 0.5)).toBeLessThan(0.03);
      expect(Math.abs(v.tBottom - 0.5)).toBeLessThan(0.03);
      const t = findGutter(spreadImg({ seed, tilt: 0.12 }), outerQ); // +/- 14 px over the page height
      expect(t.confident, `tilted seed ${seed}`).toBe(true);
      expect(t.tBottom - t.tTop).toBeGreaterThan(0.05);
    }
  });
  it('finds an off-centre fold', () => {
    const g = findGutter(spreadImg({ gutterX: 140 }), outerQ);
    expect(g.confident).toBe(true);
    expect(Math.abs(g.tTop - (140 - 40) / 320)).toBeLessThan(0.03);
  });
  it('is not confident when there is no fold (never a silent midpoint)', () => {
    const g = findGutter(spreadImg({ fold: 0 }), outerQ);
    expect(g.confident).toBe(false);
    expect(g.tTop).toBe(0.5);
    expect(g.tBottom).toBe(0.5);
  });
  it('is not confident on a faint fold', () => {
    expect(findGutter(spreadImg({ fold: 0.04 }), outerQ).confident).toBe(false);
  });
});

describe('boundaryInk', () => {
  const left: Quad = [outerQ[0], { x: 0.5, y: outerQ[0].y }, { x: 0.5, y: outerQ[3].y }, outerQ[3]];
  it('is near zero when the writing stays away from the crop edges', () => {
    const ink = boundaryInk(spreadImg({ fold: 0 }), left);
    expect(Math.max(...ink)).toBeLessThan(0.05);
  });
  it('flags a side whose writing is cut by the crop', () => {
    // Crop the left page 40 px too far in, through the writing.
    const cut: Quad = [{ x: 0.2, y: outerQ[0].y }, { x: 0.5, y: outerQ[0].y }, { x: 0.5, y: outerQ[3].y }, { x: 0.2, y: outerQ[3].y }];
    const ink = boundaryInk(spreadImg({ fold: 0 }), cut);
    expect(ink[3]).toBeGreaterThan(0.1);
  });
  it('ignores a narrow but soft fold shadow too (not writing)', () => {
    const half: Quad = [{ x: 0.1, y: outerQ[0].y }, { x: 0.5, y: outerQ[0].y }, { x: 0.5, y: outerQ[3].y }, { x: 0.1, y: outerQ[3].y }];
    const ink = boundaryInk(spreadImg({ fold: 0.45, foldWidth: 45 }), half);
    expect(ink[1]).toBeLessThan(0.05);
  });
  it('ignores a wide dark fold shadow (not writing)', () => {
    const half: Quad = [{ x: 0.1, y: outerQ[0].y }, { x: 0.5, y: outerQ[0].y }, { x: 0.5, y: outerQ[3].y }, { x: 0.1, y: outerQ[3].y }];
    const ink = boundaryInk(spreadImg({ fold: 0.5 }), half);
    expect(ink[1]).toBeLessThan(0.1);
  });
});

describe('fold placed on the camera guide', () => {
  it('confirms a fold that sits on the centre line, even a little off or tilted', () => {
    for (const o of [{}, { gutterX: 206 }, { tilt: 0.04 }, { gutterX: 192, seed: 3 }]) {
      const f = foldFromGuide(spreadImg(o), outerQ);
      expect(f.central).toBe(true);
      expect(f.dip, JSON.stringify(o)).toBeGreaterThanOrEqual(0.55);
    }
  });
  it('does not confirm a missing fold or one far from the guide (the caller shows yellow)', () => {
    expect(foldFromGuide(spreadImg({ fold: 0 }), outerQ).dip).toBeLessThan(0.55);
    expect(foldFromGuide(spreadImg({ gutterX: 275 }), outerQ).dip).toBeLessThan(0.55);
  });
  it('is not fooled by a column of writing when there is no real fold', () => {
    expect(foldFromGuide(spreadImg({ fold: 0, writingToFold: true }), outerQ).dip).toBeLessThan(0.55);
  });
  it('flags an outline that is not centred on the guide', () => {
    const shifted = outerQ.map((p) => ({ x: p.x - 0.3, y: p.y })) as Quad;
    expect(foldFromGuide(spreadImg(), shifted).central).toBe(false);
  });
});
