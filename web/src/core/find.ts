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
/** What the learned model said about a photo: the outline and how likely it is that a page is there (0..1). */
export interface ModelFind { quad: Quad; presence: number }
export const MIN_PRESENCE = 0.5, AGREE_IOU = 0.8;

/**
 * Two opinions on one photo: the rule-based finder (`rules`) and the learned model (`model`, or null when it is not available).
 *  - They agree (outlines overlap by 80% or more): keep the rules' outline, whose edges follow the pixels exactly.
 *  - They disagree, or the rules found nothing: the model leads, but only if it is fairly sure a page is there and the outline is
 *    a sensible shape that looks like a page; the result is never 'high', so the page is marked "Check".
 *  - No usable model answer: the rules alone, as before.
 */
export function combine(img: Img, rules: PageFind, model: ModelFind | null): Combined {
  const usable = model && model.presence >= MIN_PRESENCE && isValidCrop(model.quad) && plausibleShape(model.quad, img.width, img.height, 3);
  if (!usable) return { ...rules, source: 'rules' };
  if (rules.quad && quadIou(rules.quad, model.quad) >= AGREE_IOU) return { quad: rules.quad, confidence: rules.confidence === 'low' ? 'medium' : rules.confidence, source: 'agree' };
  const like = pageLike(img, model.quad);
  if (like.ok || like.why === 'blank') return { quad: model.quad, confidence: 'medium', source: 'model' };
  return { ...rules, source: 'rules' };
}
