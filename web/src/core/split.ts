import { PDFDocument } from 'pdf-lib';

/**
 * "1-3, 5, 8-" into zero-based page indexes within `count` pages, in the order written, without repeats.
 * Returns an error message instead when the text cannot be read or names pages that do not exist.
 */
export function parseRanges(text: string, count: number): { pages: number[] } | { error: string } {
  const out: number[] = [], seen = new Set<number>();
  const parts = text.split(/[,;\s]+/).filter(Boolean);
  if (!parts.length) return { error: 'Type the pages to keep, for example 1-3, 5.' };
  for (const part of parts) {
    const m = /^(\d+)?(-)?(\d+)?$/.exec(part);
    if (!m || (!m[1] && !m[3])) return { error: `"${part}" is not a page or a range.` };
    const a = m[1] ? Number(m[1]) : 1, b = m[2] ? (m[3] ? Number(m[3]) : count) : a;
    if (a < 1 || b < 1 || a > count || b > count) return { error: `This PDF has ${count} page${count === 1 ? '' : 's'}; "${part}" is outside it.` };
    if (a > b) return { error: `"${part}" counts backwards.` };
    for (let p = a; p <= b; p++) if (!seen.has(p - 1)) { seen.add(p - 1); out.push(p - 1); }
  }
  return { pages: out };
}

/** A new PDF made of the given pages (zero-based) of `input`, copied without re-rendering. */
export async function extractPages(input: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(input, { updateMetadata: false });
  const out = await PDFDocument.create();
  for (const p of await out.copyPages(src, pages)) out.addPage(p);
  return out.save();
}

export async function pageCount(input: Uint8Array): Promise<number> {
  return (await PDFDocument.load(input, { updateMetadata: false })).getPageCount();
}
