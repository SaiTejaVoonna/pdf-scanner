import { applyFilter } from './core/filters';
import { isFullFrame, isValidCrop, type Quad } from './core/geometry';
import { downscale, type Img } from './core/image';
import { detectPage, detectSpread, type SpreadDetection } from './core/detect';
import { outputSize, rotate90, scaleQuad, warp } from './core/warp';
import { blobOf, type PageModel } from './store';

export const MAX_SOURCE_SIDE = 3000;
const DETECT_SIDE = 400;

export class ImageError extends Error {}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!;

export const canvasToBlob = (c: HTMLCanvasElement, type = 'image/jpeg', quality = 0.92): Promise<Blob> =>
  new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new ImageError('Could not encode image'))), type, quality));

/** Decodes an image honouring its EXIF orientation. */
export async function decode(blob: Blob): Promise<ImageBitmap> {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch { throw new ImageError('Not a readable image'); }
}

/** Upright, size-capped JPEG used as the page's stored source. */
export async function normalize(file: Blob): Promise<{ blob: Blob; w: number; h: number }> {
  const bmp = await decode(file);
  try {
    const s = Math.min(1, MAX_SOURCE_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
    const c = canvas(w, h);
    const g = ctx2d(c);
    g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); // flatten transparency (PNG) onto white
    g.drawImage(bmp, 0, 0, w, h);
    return { blob: await canvasToBlob(c, 'image/jpeg', 0.92), w, h };
  } finally { bmp.close(); }
}

/** Decodes `blob` into a small RGBA copy (about 400 px) for detection and warnings. */
export async function analysisImage(blob: Blob): Promise<Img> {
  const bmp = await decode(blob);
  try {
    const s = Math.min(1, DETECT_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.max(32, Math.round(bmp.width * s)), h = Math.max(32, Math.round(bmp.height * s));
    const c = canvas(w, h);
    const g = ctx2d(c);
    g.drawImage(bmp, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h);
    await new Promise((r) => setTimeout(r));
    return { data: d.data, width: w, height: h };
  } finally { bmp.close(); }
}

/** Outline and fold of a two-page spread; `uncertain` is set when the fold had to be guessed. */
export async function detectSpreadIn(blob: Blob): Promise<SpreadDetection> {
  return detectSpread(await analysisImage(blob));
}

/** Finds the page corners in a source image, or null when nothing convincing is found. */
export async function detectCorners(blob: Blob): Promise<Quad | null> {
  const bmp = await decode(blob);
  try {
    const s = Math.min(1, DETECT_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.max(32, Math.round(bmp.width * s)), h = Math.max(32, Math.round(bmp.height * s));
    const c = canvas(w, h);
    const g = ctx2d(c);
    g.drawImage(bmp, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h);
    await new Promise((r) => setTimeout(r)); // let the UI paint before the CPU-heavy part
    return detectPage({ data: d.data, width: w, height: h });
  } finally { bmp.close(); }
}

/** Renders a page with its crop, filter and rotation; the longest side is at most `maxSide`. */
export async function renderPage(page: PageModel, maxSide: number): Promise<HTMLCanvasElement> {
  const blob = blobOf(page.id);
  if (!blob) throw new ImageError('Page image is missing');
  const bmp = await decode(blob);
  try {
    const full = isFullFrame(page.corners);
    const xs = page.corners.map((p) => p.x), ys = page.corners.map((p) => p.y);
    const cropFraction = full ? 1 : Math.max(0.05, Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)));
    // Decode only as much resolution as the cropped region needs to reach maxSide.
    const target = Math.min(Math.max(bmp.width, bmp.height), Math.ceil(maxSide / cropFraction));
    const s = Math.min(1, target / Math.max(bmp.width, bmp.height));
    const sw = Math.max(1, Math.round(bmp.width * s)), sh = Math.max(1, Math.round(bmp.height * s));
    const c = canvas(sw, sh);
    const g = ctx2d(c);
    g.drawImage(bmp, 0, 0, sw, sh);
    const raw = g.getImageData(0, 0, sw, sh);
    let img: Img = { data: raw.data, width: sw, height: sh };
    if (full) img = downscale(img, maxSide);
    else {
      const quadPx = scaleQuad(page.corners, sw, sh);
      const [ow, oh] = outputSize(quadPx, maxSide);
      img = warp(img, quadPx, ow, oh);
    }
    applyFilter(img, page.filter);
    img = rotate90(img, page.rotation);
    const out = canvas(img.width, img.height);
    ctx2d(out).putImageData(new ImageData(img.data as Uint8ClampedArray<ArrayBuffer>, img.width, img.height), 0, 0);
    return out;
  } finally { bmp.close(); }
}

export { isValidCrop };
