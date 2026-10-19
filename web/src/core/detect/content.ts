import { orderPoints, type Pt, type Quad } from '../geometry';
import { luma, type Img } from '../image';

const REACH = 3;
const CELL = 10, CELL_MIN = 4;

/**
 * Pixel positions of "ink": thin dark strokes with bright paper on both sides (horizontally or vertically). A page edge is dark
 * on one side only and a dark background is not surrounded by bright pixels, so neither counts; handwriting, print and rules do.
 */
export function inkPoints(img: Img): Pt[] {
  const { width: w, height: h, data } = img;
  const lum = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = luma(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  // Brightest value within REACH pixels on each side, per direction.
  const side = (dx: number, dy: number, sign: number) => {
    const out = new Int32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let m = 0;
      for (let k = 1; k <= REACH; k++) {
        const xx = x + sign * dx * k, yy = y + sign * dy * k;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) { m = 0; break; }
        const v = lum[yy * w + xx]; if (v > m) m = v;
      }
      out[y * w + x] = m;
    }
    return out;
  };
  const left = side(1, 0, -1), right = side(1, 0, 1), up = side(0, 1, -1), down = side(0, 1, 1);
  const pts: Pt[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, v = lum[i];
    const bright = Math.max(Math.min(left[i], right[i]), Math.min(up[i], down[i]));
    if (bright >= 130 && v < bright * 0.72) pts.push({ x, y });
  }
  // Keep only ink in cells that hold several strokes pixels: writing is dense, wrinkles and specks are not.
  const cols = Math.ceil(w / CELL), count = new Int32Array(cols * Math.ceil(h / CELL));
  for (const p of pts) count[Math.floor(p.y / CELL) * cols + Math.floor(p.x / CELL)]++;
  return pts.filter((p) => count[Math.floor(p.y / CELL) * cols + Math.floor(p.x / CELL)] >= CELL_MIN);
}

/**
 * Largest share, over the four sides of `quad`, of boundary positions where writing continues on both sides of the edge (ink
 * within a few pixels inside AND outside). A genuine page edge has no writing across it; an edge drawn along a shadow or a
 * stack of sheets slices through lines of text.
 */
export function inkCrossing(ink: Pt[], quad: Quad, w: number, h: number): number {
  const mask = new Uint8Array(w * h);
  for (const p of ink) mask[p.y * w + p.x] = 1;
  const near = (x: number, y: number, nx: number, ny: number) => {
    for (let d = 1; d <= 6; d++) {
      const xx = Math.round(x + nx * d), yy = Math.round(y + ny * d);
      if (xx >= 0 && yy >= 0 && xx < w && yy < h && mask[yy * w + xx]) return true;
    }
    return false;
  };
  const px = quad.map((p) => ({ x: p.x * w, y: p.y * h }));
  let worst = 0;
  for (let i = 0; i < 4; i++) {
    const a = px[i], b = px[(i + 1) % 4];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 8) continue;
    const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len; // inward for a clockwise quad
    let both = 0;
    for (let s = 0; s < len; s++) {
      const x = a.x + ((b.x - a.x) * s) / len, y = a.y + ((b.y - a.y) * s) / len;
      if (near(x, y, nx, ny) && near(x, y, -nx, -ny)) both++;
    }
    worst = Math.max(worst, both / len);
  }
  return worst;
}

/** Ink points inside `quad` grown by `grow` (a fraction of its size), in pixels. */
export function inkNear(ink: Pt[], quad: Quad, w: number, h: number, grow: number): Pt[] {
  const px = quad.map((p) => ({ x: p.x * w, y: p.y * h }));
  const cx = px.reduce((a, p) => a + p.x, 0) / 4, cy = px.reduce((a, p) => a + p.y, 0) / 4;
  const g = px.map((p) => ({ x: p.x + (p.x - cx) * grow, y: p.y + (p.y - cy) * grow }));
  return ink.filter((p) => { for (let i = 0; i < 4; i++) { const a = g[i], b = g[(i + 1) % 4]; if ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) < 0) return false; } return true; });
}

/**
 * Smallest (possibly rotated) rectangle around the writing, ignoring the outermost 1% of strays, grown by `margin`.
 * Returns null when the ink is too sparse to say anything.
 */
export function contentQuad(ink: Pt[], w: number, h: number, margin: number): Quad | null {
  if (ink.length < 50) return null;
  const xs = ink.map((p) => p.x).sort((a, b) => a - b), ys = ink.map((p) => p.y).sort((a, b) => a - b);
  const lo = (v: number[]) => v[Math.floor(v.length * 0.01)], hi = (v: number[]) => v[Math.min(v.length - 1, Math.ceil(v.length * 0.99) - 1)];
  const [x0, x1, y0, y1] = [lo(xs), hi(xs), lo(ys), hi(ys)];
  const inl = ink.filter((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1);
  const hull = convexHull(inl);
  if (hull.length < 3) return null;
  // Minimum-area rectangle by trying every hull edge direction.
  let best: { area: number; c: Pt[] } | null = null;
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i], b = hull[(i + 1) % hull.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y); if (len < 1e-6) continue;
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len, vx = -uy, vy = ux;
    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    for (const p of hull) { const u = p.x * ux + p.y * uy, v = p.x * vx + p.y * vy; minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v); }
    const area = (maxU - minU) * (maxV - minV);
    if (!best || area < best.area) {
      const du = (maxU - minU) * margin, dv = (maxV - minV) * margin;
      const P = (u: number, v: number): Pt => ({ x: u * ux + v * vx, y: u * uy + v * vy });
      best = { area, c: [P(minU - du, minV - dv), P(maxU + du, minV - dv), P(maxU + du, maxV + dv), P(minU - du, maxV + dv)] };
    }
  }
  if (!best) return null;
  return orderPoints(best.c.map((p) => ({ x: Math.min(1, Math.max(0, p.x / w)), y: Math.min(1, Math.max(0, p.y / h)) })));
}

function convexHull(points: Pt[]): Pt[] {
  const p = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Pt[] = [], upper: Pt[] = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  lower.pop(); upper.pop();
  return lower.concat(upper);
}
