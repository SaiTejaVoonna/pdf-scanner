import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { applyFilter, blackAndWhite, enhance, grayscale } from '../src/core/filters';
import { area, fullQuad, isConvex, isFullFrame, isValidCrop, orderPoints, signedArea, type Quad } from '../src/core/geometry';
import { boxBlur, createImg, downscale, sampleFactor } from '../src/core/image';
import { buildPdf, combinePdfs, defaultName, extractPages, layout, pageCount, safeFileName } from '../src/core/pdf';
import { homography, outputSize, rotate90, scaleQuad, warp } from '../src/core/warp';

// The classic minimal 1x1 JPEG.
const TINY_JPEG = Uint8Array.from(atob('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='), (c) => c.charCodeAt(0));
const rgb = (r: number, g: number, b: number) => [r, g, b, 255];
const px = (i: ReturnType<typeof createImg>, x: number, y: number) => Array.from(i.data.slice((y * i.width + x) * 4, (y * i.width + x) * 4 + 4));

describe('geometry', () => {
  it('full quad is convex, unit area, full frame, clockwise', () => {
    expect(isConvex(fullQuad())).toBe(true); expect(area(fullQuad())).toBeCloseTo(1);
    expect(isFullFrame(fullQuad())).toBe(true); expect(signedArea(fullQuad())).toBeGreaterThan(0);
  });
  it('rejects crossed, mirrored, rotated-180 and tiny crops', () => {
    const q = (...p: number[]): Quad => [{ x: p[0], y: p[1] }, { x: p[2], y: p[3] }, { x: p[4], y: p[5] }, { x: p[6], y: p[7] }];
    expect(isValidCrop(q(0, 0, 1, 1, 1, 0, 0, 1))).toBe(false);   // bow tie
    expect(isValidCrop(q(0, 0, 0, 1, 1, 1, 1, 0))).toBe(false);   // mirrored (convex but wrong winding)
    expect(isValidCrop(q(1, 1, 1, 0, 0, 0, 0, 1))).toBe(false);   // rotated 180
    expect(isValidCrop(q(0.1, 0.1, 0.15, 0.1, 0.15, 0.15, 0.1, 0.15))).toBe(false); // too small
    expect(isValidCrop(q(0, 0, 1, 0, 0.5, 0.2, 0, 1))).toBe(false); // concave
    expect(isValidCrop(fullQuad())).toBe(true);
  });
  it('orders scrambled points tl, tr, br, bl', () => {
    const q = orderPoints([{ x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }, { x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }]);
    expect(q).toEqual([{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }]);
  });
});

describe('image utils', () => {
  it('downscale keeps aspect, never enlarges, averages blocks', () => {
    const img = createImg(100, 50); for (let i = 0; i < 5000; i++) img.data.set(rgb(i % 2 ? 0 : 200, 100, 50), i * 4);
    const s = downscale(img, 50);
    expect([s.width, s.height]).toEqual([50, 25]);
    expect(downscale(img, 400)).toBe(img);
    expect(sampleFactor(3000, 2000, 700)).toBe(4);
  });
  it('box blur of a constant image is constant', () => {
    expect(Array.from(boxBlur(new Int32Array(63).fill(100), 9, 7, 2, 2)).every((v) => v === 100)).toBe(true);
  });
});

describe('warp', () => {
  it('axis aligned quad is an exact crop', () => {
    const src = createImg(40, 30);
    for (let y = 0; y < 30; y++) for (let x = 0; x < 40; x++) src.data.set(rgb(x * 6, y * 8, 0), (y * 40 + x) * 4);
    const out = warp(src, [{ x: 10, y: 5 }, { x: 30, y: 5 }, { x: 30, y: 25 }, { x: 10, y: 25 }], 20, 20);
    for (let y = 0; y < 20; y += 3) for (let x = 0; x < 20; x += 3) expect(px(out, x, y).map(Math.round)).toEqual(px(src, x + 10, y + 5));
  });
  it('corners map to corners and output size respects the cap', () => {
    const q: Quad = [{ x: 12, y: 8 }, { x: 90, y: 15 }, { x: 80, y: 70 }, { x: 5, y: 60 }];
    const h = homography(200, 100, q);
    const map = (u: number, v: number) => { const d = h[6] * u + h[7] * v + 1; return [(h[0] * u + h[1] * v + h[2]) / d, (h[3] * u + h[4] * v + h[5]) / d]; };
    [[0, 0], [200, 0], [200, 100], [0, 100]].forEach(([u, v], i) => { const [x, y] = map(u, v); expect(x).toBeCloseTo(q[i].x, 6); expect(y).toBeCloseTo(q[i].y, 6); });
    expect(outputSize([{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 500 }, { x: 0, y: 500 }], 500)).toEqual([500, 250]);
  });
  it('degenerate quad throws', () => {
    const p = { x: 1, y: 1 };
    expect(() => homography(10, 10, [p, p, p, p])).toThrow();
  });
  it('rotates by quarter turns', () => {
    const img = createImg(2, 1); img.data.set(rgb(255, 0, 0), 0); img.data.set(rgb(0, 0, 255), 4);
    const r = rotate90(img, 90);
    expect([r.width, r.height]).toEqual([1, 2]);
    expect(px(r, 0, 0)).toEqual(rgb(255, 0, 0)); expect(px(r, 0, 1)).toEqual(rgb(0, 0, 255));
    expect(rotate90(img, 360)).toBe(img);
    const back = rotate90(rotate90(img, 90), 270);
    expect(px(back, 0, 0)).toEqual(rgb(255, 0, 0));
    expect(scaleQuad(fullQuad(), 10, 20)[2]).toEqual({ x: 10, y: 20 });
  });
});

describe('filters', () => {
  it('grayscale equalises channels with luma weights', () => {
    const img = createImg(3, 1); img.data.set([...rgb(255, 0, 0), ...rgb(0, 255, 0), ...rgb(0, 0, 255)]);
    grayscale(img);
    expect([img.data[0], img.data[4], img.data[8]]).toEqual([76, 149, 29]);
  });
  it('black and white yields only black/white and handles uneven light', () => {
    const w = 120, h = 60, img = createImg(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = 240 - Math.floor((x * 130) / w); img.data.set(rgb(p, p, p), (y * w + x) * 4); }
    for (const cx of [10, 60, 110]) for (let y = 20; y < 40; y++) for (let x = cx; x < cx + 3; x++) { const p = Math.floor((240 - Math.floor((x * 130) / w)) * 0.55); img.data.set(rgb(p, p, p), (y * w + x) * 4); }
    blackAndWhite(img);
    for (let i = 0; i < w * h; i++) expect([0, 255]).toContain(img.data[i * 4]);
    for (const cx of [10, 60, 110]) expect(img.data[(30 * w + cx + 1) * 4]).toBe(0);
    expect(img.data[(10 * w + 100) * 4]).toBe(255); expect(img.data[(10 * w + 5) * 4]).toBe(255);
  });
  it('enhance removes the shadow gradient, keeps ink dark and coloured', () => {
    const w = 256, h = 160, img = createImg(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = 245 - Math.floor((x * 125) / w); img.data.set(rgb(p, p, p - 8), (y * w + x) * 4); }
    for (let y = 40; y < 44; y++) for (let x = 20; x < w - 20; x++) img.data.set(rgb(25, 25, 30), (y * w + x) * 4);
    for (let y = 90; y < 94; y++) for (let x = 20; x < w - 20; x++) img.data.set(rgb(25, 40, 170), (y * w + x) * 4);
    enhance(img);
    for (const x of [2, 60, 128, 200, 253]) { const p = px(img, x, 10); expect(p[0]).toBeGreaterThanOrEqual(228); expect(p[2]).toBeGreaterThanOrEqual(205); }
    for (const x of [40, 128, 230]) { expect(px(img, x, 41)[0]).toBeLessThan(70); const b = px(img, x, 91); expect(b[2]).toBeGreaterThan(b[0] + 60); }
  });
  it('enhance is safe on tiny, flat and near-black images; applyFilter dispatches', () => {
    enhance(createImg(1, 1));
    const flat = createImg(64, 64); for (let i = 0; i < 4096; i++) flat.data.set(rgb(200, 200, 200), i * 4);
    enhance(flat); expect(flat.data[0]).toBeGreaterThanOrEqual(250);
    const dark = createImg(64, 64); for (let i = 0; i < 4096; i++) dark.data.set(rgb(5, 5, 5), i * 4);
    enhance(dark); expect(dark.data[0]).toBeLessThan(60);
    const c = createImg(1, 1); c.data.set(rgb(10, 20, 30)); applyFilter(c, 'original'); expect(px(c, 0, 0)).toEqual(rgb(10, 20, 30));
  });
});

describe('pdf', () => {
  it('builds a multipage pdf with the requested page sizes and orientation', async () => {
    const bytes = await buildPdf([{ jpeg: TINY_JPEG, width: 100, height: 200 }, { jpeg: TINY_JPEG, width: 200, height: 100 }], 'a4', 'Café (2)');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    const [p1, p2] = doc.getPages().map((p) => p.getSize());
    expect(p1.width).toBeCloseTo(595.28, 1); expect(p1.height).toBeCloseTo(841.89, 1);
    expect(p2.width).toBeCloseTo(841.89, 1); expect(p2.height).toBeCloseTo(595.28, 1);
    expect(doc.getTitle()).toBe('Café (2)');
    expect(new TextDecoder().decode(bytes.slice(0, 8))).toBe('%PDF-1.7');
  });
  it('match-image size follows the scan at 150 dpi; letter size is 612x792', async () => {
    const m = await PDFDocument.load(await buildPdf([{ jpeg: TINY_JPEG, width: 1500, height: 750 }], 'match', 't'));
    expect(m.getPage(0).getSize()).toEqual({ width: 720, height: 360 });
    const l = await PDFDocument.load(await buildPdf([{ jpeg: TINY_JPEG, width: 100, height: 200 }], 'letter', 't'));
    expect(l.getPage(0).getSize()).toEqual({ width: 612, height: 792 });
  });
  it('layout keeps aspect ratio and centres', () => {
    const g = layout('a4', 1000, 500);
    expect(g.w / g.h).toBeCloseTo(2); expect(g.x).toBeCloseTo((g.pageW - g.w) / 2); expect(g.y).toBeCloseTo((g.pageH - g.h) / 2);
  });
  it('refuses an empty document', async () => { await expect(buildPdf([], 'a4', 't')).rejects.toThrow(); });
  it('combines PDFs in order and extracts pages', async () => {
    const a = await buildPdf([{ jpeg: TINY_JPEG, width: 100, height: 200 }], 'a4', 'a');
    const b = await buildPdf([{ jpeg: TINY_JPEG, width: 200, height: 100 }, { jpeg: TINY_JPEG, width: 100, height: 100 }], 'letter', 'b');
    const both = await combinePdfs([a, b]);
    expect(await pageCount(both)).toBe(3);
    const sizes = (await PDFDocument.load(both)).getPages().map((p) => Math.round(p.getWidth()));
    expect(sizes).toEqual([595, 792, 612]);
    const picked = await extractPages(both, [2, 0, 99]);
    expect((await PDFDocument.load(picked)).getPages().map((p) => Math.round(p.getWidth()))).toEqual([612, 595]);
    await expect(extractPages(both, [7])).rejects.toThrow();
    await expect(combinePdfs([])).rejects.toThrow();
    await expect(combinePdfs([new Uint8Array([1, 2, 3])])).rejects.toThrow();
  });
  it('file names are sanitised and the default name is timestamped', () => {
    expect(safeFileName('a/b\\c:d*e?f"g<h>i')).toBe('a b c d e f g h i');
    expect(safeFileName('notes.PDF')).toBe('notes'); expect(safeFileName('...hidden...')).toBe('hidden');
    expect(safeFileName('///')).toBe('Scan'); expect(safeFileName('x'.repeat(300))).toHaveLength(100);
    expect(defaultName(new Date(2026, 2, 9, 14, 5))).toBe('Scan 2026-03-09 14.05');
  });
});
