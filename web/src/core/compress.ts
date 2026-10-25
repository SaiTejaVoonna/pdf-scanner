import { PDFArray, PDFBool, PDFDict, PDFDocument, PDFName, PDFRawStream, PDFRef } from 'pdf-lib';

/** Re-encodes one JPEG at a smaller size / lower quality; null when it cannot (the image is then left alone). */
export type ReEncode = (jpeg: Uint8Array, scale: number, quality: number) => Promise<{ bytes: Uint8Array; width: number; height: number } | null>;
export interface CompressResult { bytes: Uint8Array; /** JPEG photos found in the PDF. */ images: number; /** Photos that became smaller. */ shrunk: number }

const name = (o: unknown): string | null => (o instanceof PDFName ? o.decodeText() : null);
const isDct = (f: unknown): boolean => {
  if (f instanceof PDFName) return f.decodeText() === 'DCTDecode';
  if (f instanceof PDFArray && f.size() === 1) return name(f.lookup(0)) === 'DCTDecode';
  return false;
};

/**
 * Makes a PDF smaller by re-encoding its JPEG photos (what a scan is made of) at `scale` of their size and JPEG `quality`.
 * Text, vector drawings and other image types are left untouched, so a PDF without photos does not shrink. A photo is only
 * replaced when the new version is smaller. Runs entirely on this device.
 */
export async function compressPdf(input: Uint8Array, o: { scale: number; quality: number; encode: ReEncode }): Promise<CompressResult> {
  const doc = await PDFDocument.load(input, { updateMetadata: false });
  const ctx = doc.context;
  let images = 0, shrunk = 0;
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const d = obj.dict;
    if (name(d.get(PDFName.of('Subtype'))) !== 'Image' || !isDct(d.lookup(PDFName.of('Filter')))) continue;
    const mask = d.lookup(PDFName.of('ImageMask'));
    if ((mask instanceof PDFBool && mask.asBoolean()) || d.has(PDFName.of('Decode'))) continue;
    const cs = name(d.lookup(PDFName.of('ColorSpace')));
    if (cs === 'DeviceCMYK') continue; // a CMYK JPEG cannot be redrawn faithfully through a canvas
    images++;
    const old = obj.contents;
    const re = await o.encode(old, o.scale, o.quality);
    if (!re || re.bytes.length >= old.length) continue;
    const fresh: Record<string, unknown> = { Type: 'XObject', Subtype: 'Image', Width: re.width, Height: re.height, ColorSpace: 'DeviceRGB', BitsPerComponent: 8, Filter: 'DCTDecode', Length: re.bytes.length };
    const next = ctx.obj(fresh as never) as unknown as PDFDict;
    const smask = d.get(PDFName.of('SMask'));
    if (smask instanceof PDFRef) next.set(PDFName.of('SMask'), smask);
    ctx.assign(ref, PDFRawStream.of(next, re.bytes));
    shrunk++;
  }
  const bytes = await doc.save({ useObjectStreams: true });
  return { bytes, images, shrunk };
}

/** Steps from gentle to strong; each is tried in turn until the file fits. */
export const COMPRESS_STEPS: { scale: number; quality: number }[] = [
  { scale: 1, quality: 0.8 }, { scale: 1, quality: 0.65 }, { scale: 0.85, quality: 0.6 }, { scale: 0.7, quality: 0.55 }, { scale: 0.55, quality: 0.5 }, { scale: 0.4, quality: 0.45 },
];

/**
 * Compresses until the file is within `target` bytes (or as small as the strongest step allows). With no target the first,
 * gentle step is used. `onStep` reports progress.
 */
export async function compressToTarget(input: Uint8Array, target: number | null, encode: ReEncode, onStep?: (i: number, n: number) => void): Promise<CompressResult & { reached: boolean }> {
  const steps = target === null ? COMPRESS_STEPS.slice(0, 1) : COMPRESS_STEPS;
  let best: CompressResult | null = null;
  for (let i = 0; i < steps.length; i++) {
    onStep?.(i, steps.length);
    const r = await compressPdf(input, { ...steps[i], encode });
    if (r.images === 0) return { ...r, bytes: input, reached: target === null || input.length <= target };
    if (!best || r.bytes.length < best.bytes.length) best = r;
    if (target !== null && r.bytes.length <= target) return { ...r, reached: true };
  }
  const out = best!;
  return out.bytes.length < input.length ? { ...out, reached: target === null || out.bytes.length <= target } : { ...out, bytes: input, reached: target === null || input.length <= target };
}
