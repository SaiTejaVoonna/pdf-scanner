import { detectAnchored, pageLike, plausibleShape } from './anchor';
import { detectPage } from './detect';
import { isValidCrop, type Quad } from './geometry';
import type { Img } from './image';

/**
 * How far a found outline can be trusted: 'high' looks like a real page (right shape, bright, holds writing), 'medium' is a
 * sound outline that does not look like a written page (a blank sheet, a screenshot), 'low' is nothing usable.
 */
export type Confidence = 'high' | 'medium' | 'low';
export interface PageFind { quad: Quad | null; confidence: Confidence }

/** Rates an outline found in `img`. */
export function assess(img: Img, quad: Quad | null): Confidence {
  if (!quad || !isValidCrop(quad)) return 'low';
  if (!plausibleShape(quad, img.width, img.height, 2.4)) return 'medium';
  return pageLike(img, quad).ok ? 'high' : 'medium';
}

/**
 * The one way every input (live camera, shutter, gallery, screenshots, Take photo, editor Auto-detect) finds a page, so the
 * same photo gets the same crop wherever it came from. `img` is a small copy (about 400 px).
 */
export function findPage(img: Img, o: { anchored?: boolean } = {}): PageFind {
  const quad = o.anchored ? detectAnchored(img).quad ?? detectPage(img) : detectPage(img);
  return { quad, confidence: assess(img, quad) };
}

/** Overlap of two outlines (0..1), measured on a 64 x 64 grid over the image. */
export function quadIou(a: Quad, b: Quad, n = 64): number {
  const inside = (q: Quad, x: number, y: number): boolean => {
    let sign = 0;
    for (let i = 0; i < 4; i++) {
      const p = q[i], r = q[(i + 1) % 4], c = (r.x - p.x) * (y - p.y) - (r.y - p.y) * (x - p.x);
      if (c !== 0) { const s2 = c > 0 ? 1 : -1; if (sign === 0) sign = s2; else if (s2 !== sign) return false; }
    }
    return true;
  };
  let both = 0, either = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n, y = (j + 0.5) / n, ia = inside(a, x, y), ib = inside(b, x, y);
    if (ia && ib) both++;
    if (ia || ib) either++;
  }
  return either ? both / either : 0;
}

export type FindSource = 'rules' | 'agree' | 'model';
export interface Combined extends PageFind { source: FindSource }
/**
 * What the learned model said about a photo: the outline and how likely it is that a page is there (0..1). Engine v2 also gives
 * `maskOverlap`: how well the outline matches the model's own page mask (0..1), its check on itself. Engine v1 has no mask.
 */
export interface ModelFind { quad: Quad; presence: number; maskOverlap?: number }

/**
 * Overlap (0..1) of an outline with the model's page mask (`mask`: `hm` x `hm` logits, row by row; above 0 means "page"). This is
 * `agree()` in web/ml/train2.py, which is what "green" meant in training, so it fills the outline the way that code does
 * (OpenCV fillPoly): the corners are rounded to whole cells, and a cell counts when it lies inside that outline or on one of its
 * edges. Checked against the Python version on real photos (bench/real-eval/README.md).
 */
export function maskOverlap(quad: Quad, mask: ArrayLike<number>, hm: number): number {
  const cell = (v: number) => Math.floor(Math.round(v * hm * 8) / 8 + 0.5); // to an eighth of a cell first, as the Python code does
  const px = quad.map((p) => cell(p.x)), py = quad.map((p) => cell(p.y));
  const inQuad = new Uint8Array(hm * hm);
  for (let j = 0; j < hm; j++) for (let i = 0; i < hm; i++) {
    let pos = 0, neg = 0;
    for (let k = 0; k < 4; k++) {
      const n = (k + 1) % 4, c = (px[n] - px[k]) * (j - py[k]) - (py[n] - py[k]) * (i - px[k]);
      if (c > 0) pos++; else if (c < 0) neg++;
    }
    if (pos === 0 || neg === 0) inQuad[j * hm + i] = 1;
  }
  // the edges, drawn as lines one cell wide: every cell within half a cell of the edge, measured across its shorter direction
  const set = (i: number, j: number) => { if (i >= 0 && j >= 0 && i < hm && j < hm) inQuad[j * hm + i] = 1; };
  for (let k = 0; k < 4; k++) {
    const n = (k + 1) % 4, dx = px[n] - px[k], dy = py[n] - py[k];
    if (dx === 0 && dy === 0) { set(px[k], py[k]); continue; }
    if (Math.abs(dx) >= Math.abs(dy)) {
      for (let i = Math.min(px[k], px[n]); i <= Math.max(px[k], px[n]); i++) { const y = py[k] + ((i - px[k]) / dx) * dy; for (let j = Math.ceil(y - 0.5); j <= Math.floor(y + 0.5); j++) set(i, j); }
    } else {
      for (let j = Math.min(py[k], py[n]); j <= Math.max(py[k], py[n]); j++) { const x = px[k] + ((j - py[k]) / dy) * dx; for (let i = Math.ceil(x - 0.5); i <= Math.floor(x + 0.5); i++) set(i, j); }
    }
  }
  let both = 0, either = 0;
  for (let c = 0; c < hm * hm; c++) {
    const m = mask[c] > 0;
    if (inQuad[c] && m) both++;
    if (inQuad[c] || m) either++;
  }
  return both / Math.max(1, either);
}

export const MIN_PRESENCE = 0.5, AGREE_IOU = 0.8, MASK_OVERLAP = 0.9;

/**
 * Two opinions on one photo: the rule-based finder (`rules`) and the learned model (`model`, or null when it is not available).
 *
 * Engine v2 (the model gives `maskOverlap`, its check on itself): the model leads.
 *  - It sees a page (fairly sure, sensible shape): its outline is used. The result is 'high' only when the outline also matches
 *    the model's own page mask by more than 90%, which is what "green" meant when the model was trained and measured; otherwise
 *    it is 'medium' and the page is marked "Check".
 *  - It sees no page: the rules' answer is kept as a fallback but is never 'high'.
 *
 * Engine v1 (no mask):
 *  - They agree (outlines overlap by 80% or more): keep the rules' outline, whose edges follow the pixels exactly.
 *  - They disagree, or the rules found nothing: the model leads, but only if it is fairly sure a page is there and the outline is
 *    a sensible shape that looks like a page; the result is never 'high', so the page is marked "Check".
 *
 * No model at all: the rules alone.
 */
export function combine(img: Img, rules: PageFind, model: ModelFind | null): Combined {
  if (!model) return { ...rules, source: 'rules' };
  const usable = model.presence >= MIN_PRESENCE && isValidCrop(model.quad) && plausibleShape(model.quad, img.width, img.height, 3);
  const agrees = usable && !!rules.quad && quadIou(rules.quad, model.quad) >= AGREE_IOU;
  if (model.maskOverlap !== undefined) {
    if (!usable) return { quad: rules.quad, confidence: rules.confidence === 'high' ? 'medium' : rules.confidence, source: 'rules' };
    return { quad: model.quad, confidence: model.maskOverlap > MASK_OVERLAP ? 'high' : 'medium', source: agrees ? 'agree' : 'model' };
  }
  if (!usable) return { ...rules, source: 'rules' };
  if (agrees) return { quad: rules.quad, confidence: rules.confidence === 'low' ? 'medium' : rules.confidence, source: 'agree' };
  const like = pageLike(img, model.quad);
  if (like.ok || like.why === 'blank') return { quad: model.quad, confidence: 'medium', source: 'model' };
  return { ...rules, source: 'rules' };
}
