import { describe, expect, it } from 'vitest';
import { assess, findPage } from '../src/core/find';
import { fullQuad, type Quad } from '../src/core/geometry';
import { createImg } from '../src/core/image';
import { rng, scene } from './scenes';

const page = [{ x: 60, y: 60 }, { x: 260, y: 50 }, { x: 270, y: 350 }, { x: 55, y: 360 }];

describe('findPage: one way to find a page, with an honest confidence', () => {
  it('a written page on a desk is found with high confidence', () => {
    const f = findPage(scene({ page, bg: [110, 100, 95], paper: [225, 222, 212] }));
    expect(f.quad).not.toBeNull();
    expect(f.confidence).toBe('high');
  });
  it('a clean image with no page gives low confidence and no outline', () => {
    const img = createImg(320, 420);
    const rnd = rng(7);
    for (let i = 0; i < 320 * 420; i++) { const v = 90 + Math.floor(rnd() * 8); img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
    const f = findPage(img);
    expect(f.confidence).toBe('low');
    expect(f.quad).toBeNull();
  });
  it('assess never trusts a missing, degenerate or distorted outline', () => {
    const img = scene({ page, bg: [110, 100, 95], paper: [225, 222, 212] });
    expect(assess(img, null)).toBe('low');
    const sliver: Quad = [{ x: 0.1, y: 0.1 }, { x: 0.11, y: 0.1 }, { x: 0.11, y: 0.9 }, { x: 0.1, y: 0.9 }];
    expect(assess(img, sliver)).toBe('low');
    const skew: Quad = [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.4 }, { x: 0.95, y: 0.95 }, { x: 0.02, y: 0.5 }];
    expect(assess(img, skew)).not.toBe('high');
  });
  it('the full frame of a written page is a usable (not low) outline', () => {
    const img = scene({ page: [{ x: 0, y: 0 }, { x: 319, y: 0 }, { x: 319, y: 419 }, { x: 0, y: 419 }], bg: [110, 100, 95], paper: [225, 222, 212] });
    expect(assess(img, fullQuad())).not.toBe('low');
  });
});

import { combine, maskOverlap, quadIou } from '../src/core/find';
import { prepareInput } from '../src/modelRun';

const q = (x0: number, y0: number, x1: number, y1: number): Quad => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const written = () => scene({ page, bg: [110, 100, 95], paper: [225, 222, 212] });

describe('quadIou', () => {
  it('is 1 for the same outline, 0 for apart, and about the overlap in between', () => {
    expect(quadIou(q(0.1, 0.1, 0.9, 0.9), q(0.1, 0.1, 0.9, 0.9))).toBeCloseTo(1, 5);
    expect(quadIou(q(0, 0, 0.3, 0.3), q(0.6, 0.6, 1, 1))).toBe(0);
    expect(quadIou(q(0, 0, 0.5, 1), q(0.25, 0, 0.75, 1))).toBeCloseTo(1 / 3, 1);
  });
});

describe('combine: the rules and the model, two opinions', () => {
  const img = written();
  const rulesQuad: Quad = [{ x: 60 / 320, y: 60 / 420 }, { x: 260 / 320, y: 50 / 420 }, { x: 270 / 320, y: 350 / 420 }, { x: 55 / 320, y: 360 / 420 }];
  const rules = { quad: rulesQuad, confidence: 'high' as const };
  it('without a usable model answer the rules stand alone', () => {
    expect(combine(img, rules, null)).toMatchObject({ source: 'rules', confidence: 'high' });
    expect(combine(img, rules, { quad: rulesQuad, presence: 0.2 })).toMatchObject({ source: 'rules' });
    expect(combine(img, rules, { quad: q(0.1, 0.1, 0.11, 0.9), presence: 0.99 })).toMatchObject({ source: 'rules' }); // a sliver is not a page
  });
  it('when they agree the rules outline is kept (it follows the pixels) with its confidence', () => {
    const near: Quad = rulesQuad.map((p) => ({ x: p.x + 0.01, y: p.y - 0.01 })) as Quad;
    const c = combine(img, rules, { quad: near, presence: 0.9 });
    expect(c.source).toBe('agree');
    expect(c.quad).toBe(rulesQuad);
    expect(c.confidence).toBe('high');
  });
  it('when they disagree the model leads but the page is never "high"; if the model outline is not a page the rules stay', () => {
    const none = { quad: null, confidence: 'low' as const };
    const c = combine(img, none, { quad: rulesQuad, presence: 0.9 });
    expect(c.source).toBe('model');
    expect(c.confidence).toBe('medium');
    const dark = createImg(320, 420); for (let i = 0; i < dark.data.length; i += 4) { dark.data[i] = 20; dark.data[i + 1] = 20; dark.data[i + 2] = 20; dark.data[i + 3] = 255; }
    expect(combine(dark, none, { quad: rulesQuad, presence: 0.99 })).toMatchObject({ source: 'rules', quad: null });
  });
});

describe('maskOverlap: the outline against the model\'s own page mask', () => {
  const hm = 48;
  /** A mask that says "page" exactly in the cells from (x0, y0) to (x1, y1), both included. */
  const box = (x0: number, y0: number, x1: number, y1: number): Float32Array => { const m = new Float32Array(hm * hm).fill(-5); for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) m[j * hm + i] = 5; return m; };
  it('is 1 when the mask fills the outline, edges included, and falls as they drift apart', () => {
    const outline = q(12 / hm, 12 / hm, 36 / hm, 36 / hm);
    expect(maskOverlap(outline, box(12, 12, 36, 36), hm)).toBe(1);
    expect(maskOverlap(outline, box(12, 12, 36, 24), hm)).toBeCloseTo(13 / 25, 5); // the mask covers 13 of the outline's 25 rows
    expect(maskOverlap(outline, box(0, 0, 5, 5), hm)).toBe(0);
    expect(maskOverlap(outline, new Float32Array(hm * hm).fill(-5), hm)).toBe(0);
  });
  it('handles a slanted outline and one that touches the image edge', () => {
    const slanted: Quad = [{ x: 0.25, y: 0.2 }, { x: 0.8, y: 0.25 }, { x: 0.75, y: 0.8 }, { x: 0.2, y: 0.75 }];
    const v = maskOverlap(slanted, box(10, 10, 38, 38), hm);
    expect(v).toBeGreaterThan(0.75); expect(v).toBeLessThan(1);
    expect(maskOverlap(q(0, 0, 1, 1), box(0, 0, 47, 47), hm)).toBe(1);
  });
});

describe('combine with engine v2: the model leads and checks itself against its mask', () => {
  const img = written();
  const rulesQuad: Quad = [{ x: 60 / 320, y: 60 / 420 }, { x: 260 / 320, y: 50 / 420 }, { x: 270 / 320, y: 350 / 420 }, { x: 55 / 320, y: 360 / 420 }];
  const rules = { quad: rulesQuad, confidence: 'high' as const };
  const other = q(0.3, 0.3, 0.95, 0.95);
  it('is "high" only when the outline matches the mask by more than 90%, whatever the rules say', () => {
    expect(combine(img, rules, { quad: other, presence: 0.9, maskOverlap: 0.95 })).toMatchObject({ quad: other, confidence: 'high', source: 'model' });
    expect(combine(img, rules, { quad: other, presence: 0.9, maskOverlap: 0.9 })).toMatchObject({ quad: other, confidence: 'medium', source: 'model' });
    expect(combine(img, { quad: null, confidence: 'low' }, { quad: other, presence: 0.9, maskOverlap: 0.97 })).toMatchObject({ quad: other, confidence: 'high', source: 'model' });
  });
  it('uses the model outline when the rules agree too, and says so', () => {
    const near: Quad = rulesQuad.map((p) => ({ x: p.x + 0.01, y: p.y - 0.01 })) as Quad;
    expect(combine(img, rules, { quad: near, presence: 0.9, maskOverlap: 0.95 })).toMatchObject({ quad: near, confidence: 'high', source: 'agree' });
    expect(combine(img, rules, { quad: near, presence: 0.9, maskOverlap: 0.5 })).toMatchObject({ quad: near, confidence: 'medium', source: 'agree' });
  });
  it('falls back to the rules when the model sees no page, but never as "high"', () => {
    expect(combine(img, rules, { quad: other, presence: 0.2, maskOverlap: 0.99 })).toMatchObject({ quad: rulesQuad, confidence: 'medium', source: 'rules' });
    expect(combine(img, rules, { quad: q(0.1, 0.1, 0.11, 0.9), presence: 0.99, maskOverlap: 0.99 })).toMatchObject({ quad: rulesQuad, confidence: 'medium', source: 'rules' }); // a sliver is not a page
    expect(combine(img, { quad: null, confidence: 'low' }, { quad: other, presence: 0.1, maskOverlap: 0 })).toMatchObject({ quad: null, confidence: 'low', source: 'rules' });
  });
});

describe('prepareInput', () => {
  it('averages down to the model size and normalises channel-first', () => {
    const w = 8, h = 8, im = createImg(w, h);
    for (let i = 0; i < w * h; i++) { im.data[i * 4] = 255; im.data[i * 4 + 1] = 0; im.data[i * 4 + 2] = 51; im.data[i * 4 + 3] = 255; }
    const out = prepareInput(im, 2, 0.5, 0.25);
    expect(out.length).toBe(3 * 2 * 2);
    expect(out[0]).toBeCloseTo(2, 5); expect(out[4]).toBeCloseTo(-2, 5); expect(out[8]).toBeCloseTo((0.2 - 0.5) / 0.25, 5);
  });
});
