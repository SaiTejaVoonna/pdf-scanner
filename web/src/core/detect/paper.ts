import { boxBlur } from '../image';
import { isConvex, orderPoints, type Pt, type Quad } from '../geometry';

const MIN_REGION_FRACTION = 0.05, MIN_QUAD_FRACTION = 0.1, MAX_QUAD_FRACTION = 0.97, MIN_HULL_FILL = 0.8;

/**
 * Candidate generator #3, "paper colour": paper is the brightest, least coloured thing in most photos, so
 * threshold the per-pixel whiteness (the minimum of R, G, B) at two Otsu levels, clean the mask up, and fit a
 * quadrilateral around each large blob's convex hull. Unlike line-based candidates this ignores clutter such as
 * fabric patterns and keyboards, because they are not white.
 */
export function paperCandidates(white: Int32Array, w: number, h: number): Quad[] {
  if (w < 16 || h < 16) return [];
  const blurred = boxBlur(white, w, h, 2);
  const t1 = otsu(blurred, 0);
  const t2 = otsu(blurred, t1 + 1);
  const out: Quad[] = [];
  for (const t of new Set([t1, t2, Math.round((t1 + t2) / 2)])) {
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = blurred[i] > t ? 1 : 0;
    const opened = dilate(erode(mask, w, h, 3), w, h, 3);
    out.push(...blobQuads(opened, w, h));
  }
  return out;
}

function blobQuads(mask: Uint8Array, w: number, h: number): Quad[] {
  const total = w * h, seen = new Uint8Array(total), stack = new Int32Array(total);
  const blobs: { area: number; boundary: Pt[]; edges: number }[] = [];
  for (let s = 0; s < total; s++) {
    if (!mask[s] || seen[s]) continue;
    let sp = 0, area = 0, edges = 0;
    const boundary: Pt[] = [];
    stack[sp++] = s; seen[s] = 1;
    while (sp > 0) {
      const i = stack[--sp], x = i % w, y = (i / w) | 0;
      area++;
      const l = x > 0 && mask[i - 1], r = x < w - 1 && mask[i + 1], u = y > 0 && mask[i - w], d = y < h - 1 && mask[i + w];
      if (!l || !r || !u || !d) boundary.push({ x: x + 0.5, y: y + 0.5 });
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edges++;
      if (l && !seen[i - 1]) { seen[i - 1] = 1; stack[sp++] = i - 1; }
      if (r && !seen[i + 1]) { seen[i + 1] = 1; stack[sp++] = i + 1; }
      if (u && !seen[i - w]) { seen[i - w] = 1; stack[sp++] = i - w; }
      if (d && !seen[i + w]) { seen[i + w] = 1; stack[sp++] = i + w; }
    }
    if (area >= total * MIN_REGION_FRACTION) blobs.push({ area, boundary, edges });
  }
  blobs.sort((a, b) => b.area - a.area);
  const out: Quad[] = [];
  for (const b of blobs.slice(0, 4)) {
    const hull = convexHull(b.boundary);
    if (hull.length < 3) continue;
    const hullArea = polygonArea(hull);
    if (hullArea <= 0 || b.area / hullArea < MIN_HULL_FILL) continue;
    const quad = fitQuad(hull);
    if (!quad) continue;
    const q = orderPoints(quad).map((p) => ({ x: Math.min(1, Math.max(0, p.x / w)), y: Math.min(1, Math.max(0, p.y / h)) })) as Quad;
    const a = polygonArea(q) ;
    if (a < MIN_QUAD_FRACTION || a > MAX_QUAD_FRACTION || !isConvex(q)) continue;
    out.push(q);
  }
  return out;
}

/** Shrinks a convex polygon to four vertices by repeatedly replacing the edge whose removal adds the least area. */
export function fitQuad(hull: Pt[]): Pt[] | null {
  let pts = hull.slice();
  while (pts.length > 4) {
    let bestI = -1, bestAdd = Infinity, bestPt: Pt | null = null;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n], d = pts[(i + 2) % n];
      const p = lineIntersect(a, b, c, d);
      if (!p) continue;
      // The new vertex must lie beyond edge b-c (outside the polygon).
      const side = (c.x - b.x) * (p.y - b.y) - (c.y - b.y) * (p.x - b.x);
      const inside = (c.x - b.x) * (a.y - b.y) - (c.y - b.y) * (a.x - b.x);
      if (side * inside > 0) continue;
      const add = Math.abs((b.x - p.x) * (c.y - p.y) - (c.x - p.x) * (b.y - p.y)) / 2;
      if (add < bestAdd) { bestAdd = add; bestI = i; bestPt = p; }
    }
    if (bestI < 0 || !bestPt) return null;
    const next: Pt[] = [];
    for (let k = 0; k < n; k++) {
      if (k === bestI) next.push(bestPt);
      else if (k !== (bestI + 1) % n) next.push(pts[k]);
    }
    pts = next;
  }
  return pts.length === 4 ? pts : null;
}

function lineIntersect(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const d1x = b.x - a.x, d1y = b.y - a.y, d2x = d.x - c.x, d2y = d.y - c.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * d2y - (c.y - a.y) * d2x) / den;
  return { x: a.x + d1x * t, y: a.y + d1y * t };
}

const polygonArea = (p: Pt[]): number => {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s) / 2;
};

function convexHull(points: Pt[]): Pt[] {
  const p = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [], upper: Pt[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}

function erode(src: Uint8Array, w: number, h: number, r: number): Uint8Array { return morph(src, w, h, r, true); }
function dilate(src: Uint8Array, w: number, h: number, r: number): Uint8Array { return morph(src, w, h, r, false); }
/** Separable min (erode) / max (dilate) filter; outside the image counts as "on" for erosion so border blobs keep their size. */
function morph(src: Uint8Array, w: number, h: number, r: number, min: boolean): Uint8Array {
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = min ? 1 : 0;
    for (let k = -r; k <= r; k++) { const xx = x + k; if (xx < 0 || xx >= w) continue; if (min ? !src[y * w + xx] : src[y * w + xx]) { v = min ? 0 : 1; break; } }
    tmp[y * w + x] = v;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let v = min ? 1 : 0;
    for (let k = -r; k <= r; k++) { const yy = y + k; if (yy < 0 || yy >= h) continue; if (min ? !tmp[yy * w + x] : tmp[yy * w + x]) { v = min ? 0 : 1; break; } }
    out[y * w + x] = v;
  }
  return out;
}

/** Otsu threshold over the values >= `from`. */
function otsu(values: Int32Array, from: number): number {
  const hist = new Array(256).fill(0);
  let total = 0;
  for (const v of values) { const c = Math.min(255, Math.max(0, v)); if (c >= from) { hist[c]++; total++; } }
  if (total === 0) return from;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let sumB = 0, wB = 0, best = -1, threshold = from;
  for (let t = from; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; threshold = t; }
  }
  return threshold;
}
