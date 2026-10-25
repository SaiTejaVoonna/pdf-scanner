import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { compressPdf, compressToTarget, type ReEncode } from '../src/core/compress';
import { extractPages, pageCount, parseRanges } from '../src/core/split';

const JPEG = Uint8Array.from(atob('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'), (c) => c.charCodeAt(0));

async function scanPdf(pages: number): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  const img = await d.embedJpg(JPEG);
  for (let i = 0; i < pages; i++) d.addPage([200, 300]).drawImage(img, { x: 0, y: 0, width: 200, height: 300 });
  return d.save();
}
/** A stand-in for the browser's re-encoder: keeps the leading bytes of the JPEG, reports the scaled size. */
const shrink: ReEncode = async (jpeg, scale) => ({ bytes: jpeg.slice(0, Math.floor(jpeg.length * 0.5 * scale)), width: Math.round(48 * scale), height: Math.round(32 * scale) });

describe('parseRanges', () => {
  it('reads pages, ranges and open ranges in the order written, without repeats', () => {
    expect(parseRanges('1-3, 5, 2', 8)).toEqual({ pages: [0, 1, 2, 4] });
    expect(parseRanges('7-', 8)).toEqual({ pages: [6, 7] });
    expect(parseRanges('-2', 8)).toEqual({ pages: [0, 1] });
  });
  it('explains what is wrong instead of guessing', () => {
    expect('error' in parseRanges('', 5)).toBe(true);
    expect(parseRanges('9', 5)).toEqual({ error: 'This PDF has 5 pages; "9" is outside it.' });
    expect(parseRanges('4-2', 5)).toEqual({ error: '"4-2" counts backwards.' });
    expect('error' in parseRanges('a-b', 5)).toBe(true);
  });
});

describe('extractPages / pageCount', () => {
  it('copies just the chosen pages, in order', async () => {
    const pdf = await scanPdf(4);
    expect(await pageCount(pdf)).toBe(4);
    const out = await extractPages(pdf, [2, 0]);
    expect(await pageCount(out)).toBe(2);
  });
});

describe('compressPdf', () => {
  it('re-encodes the JPEG photos, updates their size and keeps every page', async () => {
    const pdf = await scanPdf(3);
    const r = await compressPdf(pdf, { scale: 0.5, quality: 0.6, encode: shrink });
    expect(r.images).toBe(1); // one shared photo
    expect(r.shrunk).toBe(1);
    const back = await PDFDocument.load(r.bytes);
    expect(back.getPageCount()).toBe(3);
    const stream = [...back.context.enumerateIndirectObjects()].map(([, o]) => o).find((o) => o instanceof PDFRawStream && (o as PDFRawStream).dict.get(PDFName.of('Subtype')) === PDFName.of('Image')) as PDFRawStream;
    expect(stream.contents.length).toBeLessThan(JPEG.length);
    expect(String(stream.dict.get(PDFName.of('Width')))).toBe('24');
  });
  it('leaves a photo alone when the new version is not smaller, and a PDF without photos does not change', async () => {
    const pdf = await scanPdf(1);
    const bigger: ReEncode = async (j) => ({ bytes: new Uint8Array(j.length + 10), width: 48, height: 32 });
    expect((await compressPdf(pdf, { scale: 1, quality: 0.9, encode: bigger })).shrunk).toBe(0);
    const text = await PDFDocument.create(); text.addPage([100, 100]);
    const t = await compressToTarget(await text.save(), 1000, shrink);
    expect(t.images).toBe(0);
  });
  it('steps up the strength until the target is met, and says when it cannot be', async () => {
    const pdf = await scanPdf(2);
    const mild = await compressToTarget(pdf, null, shrink);
    expect(mild.bytes.length).toBeLessThan(pdf.length);
    const strong = await compressToTarget(pdf, mild.bytes.length - 200, shrink);
    expect(strong.bytes.length).toBeLessThanOrEqual(mild.bytes.length);
    const impossible = await compressToTarget(pdf, 10, shrink);
    expect(impossible.reached).toBe(false);
  });
});

import { fitBox, padJpeg, toPixels } from '../src/core/sizing';

describe('sizing helpers for form photos', () => {
  it('converts millimetres at a resolution, and leaves pixels alone', () => {
    expect(toPixels(35, 'mm', 300)).toBe(413);
    expect(toPixels(45, 'mm', 300)).toBe(531);
    expect(toPixels(100, 'px', 300)).toBe(100);
  });
  it('crop fills the canvas and trims the overflow; fit keeps the whole picture centred', () => {
    const c = fitBox(1000, 500, 100, 100, 'crop');
    expect(c.dWidth).toBe(100); expect(c.sWidth).toBeCloseTo(500); expect(c.sx).toBeCloseTo(250);
    const f = fitBox(1000, 500, 100, 100, 'fit');
    expect(f.dWidth).toBe(100); expect(f.dHeight).toBe(50); expect(f.dy).toBe(25);
  });
  it('pads a JPEG to the minimum with comment segments and keeps its start and end intact', () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 1, 2, 3, 4, 0xff, 0xd9]);
    const out = padJpeg(jpeg, 200000);
    expect(out.length).toBe(200000);
    expect([out[0], out[1], out[2], out[3]]).toEqual([0xff, 0xd8, 0xff, 0xfe]);
    expect(Array.from(out.slice(-6))).toEqual([1, 2, 3, 4, 0xff, 0xd9]);
    expect(padJpeg(jpeg, 4)).toBe(jpeg);
    for (const n of [9, 10, 11, 12, 13]) expect(padJpeg(jpeg, n).length).toBeGreaterThanOrEqual(n); // tiny gaps never overflow
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47]);
    expect(padJpeg(png, 100)).toBe(png);
  });
});
