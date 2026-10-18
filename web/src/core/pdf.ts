import { PDFDocument } from 'pdf-lib';

export type PageSizeName = 'a4' | 'letter' | 'match';
export const PAGE_SIZES: { id: PageSizeName; label: string }[] = [
  { id: 'a4', label: 'A4' }, { id: 'letter', label: 'US Letter' }, { id: 'match', label: 'Match image' },
];
export type QualityName = 'high' | 'balanced' | 'small';
/** Longest image side in pixels and JPEG quality (0..1). */
export const QUALITIES: { id: QualityName; label: string; maxSide: number; jpeg: number }[] = [
  { id: 'high', label: 'High', maxSide: 2480, jpeg: 0.9 },        // about 300 dpi on A4
  { id: 'balanced', label: 'Balanced', maxSide: 1754, jpeg: 0.8 }, // about 150 dpi
  { id: 'small', label: 'Small file', maxSide: 1240, jpeg: 0.65 }, // about 100 dpi
];

const FIXED: Record<'a4' | 'letter', [number, number]> = { a4: [595.28, 841.89], letter: [612, 792] };
const MATCH_DPI = 150;

export interface Layout { pageW: number; pageH: number; x: number; y: number; w: number; h: number }

/** Page box and image placement: scaled to fit, centred, orientation follows the image. */
export function layout(size: PageSizeName, imageW: number, imageH: number): Layout {
  if (size === 'match') {
    const w = (imageW * 72) / MATCH_DPI, h = (imageH * 72) / MATCH_DPI;
    return { pageW: w, pageH: h, x: 0, y: 0, w, h };
  }
  const [a, b] = FIXED[size];
  const landscape = imageW > imageH;
  const pageW = landscape ? b : a, pageH = landscape ? a : b;
  const scale = Math.min(pageW / imageW, pageH / imageH);
  const w = imageW * scale, h = imageH * scale;
  return { pageW, pageH, x: (pageW - w) / 2, y: (pageH - h) / 2, w, h };
}

export interface PageJpeg { jpeg: Uint8Array; width: number; height: number }

/** Builds a multipage PDF, embedding each JPEG as-is (no re-encoding). */
export async function buildPdf(pages: PageJpeg[], size: PageSizeName, title: string): Promise<Uint8Array> {
  if (pages.length === 0) throw new Error('A PDF needs at least one page');
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setProducer('PDF Scanner');
  doc.setCreator('PDF Scanner');
  for (const p of pages) {
    const img = await doc.embedJpg(p.jpeg);
    const g = layout(size, p.width, p.height);
    const page = doc.addPage([g.pageW, g.pageH]);
    page.drawImage(img, { x: g.x, y: g.y, width: g.w, height: g.h });
  }
  return doc.save();
}

/** Appends the pages of several PDFs into one, keeping text and vector content (nothing is rasterised). */
export async function combinePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  if (files.length === 0) throw new Error('Nothing to combine');
  const out = await PDFDocument.create();
  for (const bytes of files) {
    const src = await PDFDocument.load(bytes); // throws for encrypted or unreadable files
    const copied = await out.copyPages(src, src.getPageIndices());
    copied.forEach((p) => out.addPage(p));
  }
  out.setProducer('PDF Scanner');
  return out.save();
}

/** A new PDF holding only the given 0-based pages of `bytes`, in that order. */
export async function extractPages(bytes: Uint8Array, indices: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes);
  const valid = indices.filter((i) => Number.isInteger(i) && i >= 0 && i < src.getPageCount());
  if (valid.length === 0) throw new Error('No valid pages selected');
  const out = await PDFDocument.create();
  (await out.copyPages(src, valid)).forEach((p) => out.addPage(p));
  return out.save();
}

export async function pageCount(bytes: Uint8Array): Promise<number> {
  return (await PDFDocument.load(bytes)).getPageCount();
}

/** Makes `raw` safe as a file name base. Never empty. */
export function safeFileName(raw: string, fallback = 'Scan'): string {
  const cleaned = raw.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+|\.+$/g, '').replace(/\.pdf$/i, '').trim().slice(0, 100).trim();
  return cleaned || fallback;
}

export const defaultName = (d = new Date()): string => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `Scan ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}`;
};
