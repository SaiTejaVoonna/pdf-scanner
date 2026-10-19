import { area, isValidCrop, orderPoints, type Pt, type Quad } from '../geometry';
import { boxBlur, luma, type Img } from '../image';
import { cannyEdges } from './canny';
import { borderLines, houghLines, type Line } from './hough';
import { regionCandidates } from './region';

/**
 * Offline page-corner detection, no native libraries:
 * 1. Canny edges + Hough transform find the dominant straight lines.
 * 2. Every plausible quadrilateral from those lines (plus the image frame, for pages cut off by the frame) is
 *    scored by how much of its outline lies on real edges, how much it covers, and whether there is a real
 *    brightness/colour step across each side (a printed line has paper on both sides; a page edge doesn't).
 * 3. A brightness-based segmentation adds candidates for smooth backgrounds, scored by the same rule.
 * Returns null when nothing convincing is found so the caller keeps the full image. Never guesses.
 */
const MIN_AREA = 0.12, MAX_AREA = 0.985, MIN_MEAN_SUPPORT = 0.55, MIN_SIDE_SUPPORT = 0.35, BORDER_WEIGHT = 0.5;
const MIN_SIDE_CONTRAST = 8, FULL_CONTRAST = 25, MAX_NEAR_DENSITY = 0.65, BORDER_PENALTY = 0.9;
const CONTRAST_OFFSETS = [4, 7, 10, 13, 16];

/** `img` should be a small copy (about 400 px); returns normalized corners or null. */
export function detectPage(img: Img): Quad | null {
  const { width: w, height: h, data } = img;
  if (w < 32 || h < 32) return null;
  const n = w * h;
  const channels = [new Int32Array(n), new Int32Array(n), new Int32Array(n)];
  for (let i = 0; i < n; i++) { channels[0][i] = data[i * 4]; channels[1][i] = data[i * 4 + 1]; channels[2][i] = data[i * 4 + 2]; }
  const edges = cannyEdges(channels, w, h);
  const near = dilate(edges, w, h, 2);
  let count = 0;
  for (let i = 0; i < n; i++) count += near[i];
  if (count > MAX_NEAR_DENSITY * n) return null;

  const smooth = channels.map((c) => blur2(c, w, h));
  const scorer = new Scorer(near, smooth, w, h);
  let best: { quad: Quad; score: number } | null = null;
  const consider = (px: Pt[] | null) => {
    if (!px) return;
    const s = scorer.score(px);
    if (s && (!best || s.score > best.score)) best = s;
  };

  const minVotes = Math.max(12, Math.floor(0.25 * Math.min(w, h)));
  const lines = [...houghLines(edges, w, h, minVotes, 28), ...borderLines(w, h)];
  forEachQuad(lines, consider);

  const gray = new Int32Array(n);
  for (let i = 0; i < n; i++) gray[i] = luma(channels[0][i], channels[1][i], channels[2][i]);
  for (const q of regionCandidates(gray, w, h)) consider(q.map((p) => ({ x: p.x * w, y: p.y * h })));

  const result = best as { quad: Quad; score: number } | null;
  if (!result || !isValidCrop(result.quad)) return null;
  const loose = padQuad(result.quad, CROP_MARGIN);
  return isValidCrop(loose) ? loose : result.quad;
}

/** Fraction of the page size added around the detected corners: clipping page edges is worse than a sliver of desk. */
export const CROP_MARGIN = 0.012;

/** Moves each corner away from the centre by `margin` of the quad's size, staying inside the image. */
export function padQuad(q: Quad, margin: number): Quad {
  const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4, cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
  return q.map((p) => ({
    x: Math.min(1, Math.max(0, p.x + (p.x - cx) * margin * 2)),
    y: Math.min(1, Math.max(0, p.y + (p.y - cy) * margin * 2)),
  })) as Quad;
}

const blur2 = (c: Int32Array, w: number, h: number) => boxBlur(c, w, h, 2);

class Scorer {
  constructor(private near: Uint8Array, private smooth: Int32Array[], private w: number, private h: number) {}

  score(px: Pt[]): { quad: Quad; score: number } | null {
    const { w, h } = this;
    const cx = px.map((p) => Math.min(w, Math.max(0, p.x)));
    const cy = px.map((p) => Math.min(h, Math.max(0, p.y)));
    const quad = [0, 1, 2, 3].map((i) => ({ x: cx[i] / w, y: cy[i] / h })) as Quad;
    if (!isValidCrop(quad)) return null;
    const a = area(quad);
    if (a < MIN_AREA || a > MAX_AREA) return null;
    if (!this.anglesPlausible(cx, cy)) return null;

    let sum = 0, weakest = 1, genuine = 0, borders = 0, contrastSum = 0;
    const centreX = (cx[0] + cx[1] + cx[2] + cx[3]) / 4, centreY = (cy[0] + cy[1] + cy[2] + cy[3]) / 4;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const [support, onBorder] = this.sideSupport(cx[i], cy[i], cx[j], cy[j]);
      if (onBorder) borders++;
      else {
        genuine++;
        weakest = Math.min(weakest, support);
        const c = this.sideContrast(cx[i], cy[i], cx[j], cy[j], centreX, centreY);
        if (c < MIN_SIDE_CONTRAST) return null;
        contrastSum += c;
      }
      sum += support;
    }
    const mean = sum / 4;
    if (genuine < 2 || borders > 2 || borders === 4) return null;
    if (mean < MIN_MEAN_SUPPORT || weakest < MIN_SIDE_SUPPORT) return null;
    const contrastFactor = Math.sqrt(Math.min(1, contrastSum / genuine / FULL_CONTRAST));
    const score = Math.pow(a, 0.7) * mean * mean * (0.5 + 0.5 * weakest) * contrastFactor * Math.pow(BORDER_PENALTY, borders);
    return { quad, score };
  }

  /** Fraction of the side's length lying on image edges; samples on the frame count half. */
  private sideSupport(ax: number, ay: number, bx: number, by: number): [number, boolean] {
    const { w, h, near } = this;
    const steps = Math.max(8, Math.floor(Math.hypot(bx - ax, by - ay)));
    let total = 0, onBorder = 0;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      const ix = Math.min(w - 1, Math.max(0, x | 0)), iy = Math.min(h - 1, Math.max(0, y | 0));
      if (x <= 2 || y <= 2 || x >= w - 2 || y >= h - 2) { onBorder++; total += BORDER_WEIGHT; }
      else if (near[iy * w + ix]) total += 1;
    }
    const samples = steps + 1;
    return [total / samples, onBorder > samples * 0.8];
  }

  /**
   * Step in the *brightest* level of each colour channel across a side, comparing bands either side. Using the
   * band maximum (the paper level) instead of the mean means the edge of a block of printed text, which has
   * white paper on both sides, shows no step, while a page-to-desk boundary still does.
   */
  private sideContrast(ax: number, ay: number, bx: number, by: number, centreX: number, centreY: number): number {
    const { w, h, smooth } = this;
    const length = Math.hypot(bx - ax, by - ay);
    let nx = -(by - ay) / length, ny = (bx - ax) / length;
    if (((ax + bx) / 2 - centreX) * nx + ((ay + by) / 2 - centreY) * ny < 0) { nx = -nx; ny = -ny; }
    const steps = Math.max(8, Math.floor(length / 2));
    const inside = [0, 0, 0], outside = [0, 0, 0];
    let total = 0, count = 0;
    for (let s = 1; s < steps; s++) {
      const t = s / steps, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      inside.fill(0); outside.fill(0);
      let used = 0;
      for (const d of CONTRAST_OFFSETS) {
        const ox = (x + nx * d) | 0, oy = (y + ny * d) | 0, ix = (x - nx * d) | 0, iy = (y - ny * d) | 0;
        if (ox < 0 || ox >= w || oy < 0 || oy >= h || ix < 0 || ix >= w || iy < 0 || iy >= h) continue;
        for (let c = 0; c < 3; c++) {
          outside[c] = Math.max(outside[c], smooth[c][oy * w + ox]);
          inside[c] = Math.max(inside[c], smooth[c][iy * w + ix]);
        }
        used++;
      }
      if (used < 3) continue;
      let diff = 0;
      for (let c = 0; c < 3; c++) diff = Math.max(diff, Math.abs(outside[c] - inside[c]));
      total += diff; count++;
    }
    return count === 0 ? 0 : total / count;
  }

  /** Interior angles must stay near a rectangle's, allowing for perspective. */
  private anglesPlausible(xs: number[], ys: number[]): boolean {
    for (let i = 0; i < 4; i++) {
      const p = (i + 3) % 4, nn = (i + 1) % 4;
      const ux = xs[p] - xs[i], uy = ys[p] - ys[i], vx = xs[nn] - xs[i], vy = ys[nn] - ys[i];
      const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
      if (lu < 4 || lv < 4) return false;
      const deg = (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (lu * lv)))) * 180) / Math.PI;
      if (deg < 50 || deg > 130) return false;
    }
    const top = Math.hypot(xs[1] - xs[0], ys[1] - ys[0]), bottom = Math.hypot(xs[2] - xs[3], ys[2] - ys[3]);
    const left = Math.hypot(xs[3] - xs[0], ys[3] - ys[0]), right = Math.hypot(xs[2] - xs[1], ys[2] - ys[1]);
    const wAvg = (top + bottom) / 2, hAvg = (left + right) / 2;
    return Math.max(wAvg, hAvg) / Math.max(1, Math.min(wAvg, hAvg)) <= 4.5 &&
      Math.min(top, bottom) / Math.max(top, bottom) > 0.35 && Math.min(left, right) / Math.max(left, right) > 0.35;
  }
}

const angleDiff = (a: Line, b: Line) => { const d = Math.abs(a.directionDeg - b.directionDeg); return Math.min(d, 180 - d); };

/** Enumerates quadrilaterals formed by two near-parallel line pairs that cross each other. */
function forEachQuad(lines: Line[], emit: (px: Pt[] | null) => void): void {
  const n = lines.length;
  const splits = [[0, 1, 2, 3], [0, 2, 1, 3], [0, 3, 1, 2]];
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) {
    const set = [a, b, c, d];
    for (const sp of splits) {
      const p1 = lines[set[sp[0]]], p2 = lines[set[sp[1]]], q1 = lines[set[sp[2]]], q2 = lines[set[sp[3]]];
      if (p1.isBorder && p2.isBorder && q1.isBorder && q2.isBorder) continue;
      if (angleDiff(p1, p2) > 35 || angleDiff(q1, q2) > 35) continue;
      if (angleDiff(p1, q1) < 40 || angleDiff(p1, q2) < 40 || angleDiff(p2, q1) < 40 || angleDiff(p2, q2) < 40) continue;
      const i1 = p1.intersect(q1), i2 = p1.intersect(q2), i3 = p2.intersect(q2), i4 = p2.intersect(q1);
      if (!i1 || !i2 || !i3 || !i4) continue;
      emit(orderPoints([i1, i2, i3, i4].map(([x, y]) => ({ x, y }))));
    }
  }
}

function dilate(src: Uint8Array, w: number, h: number, radius: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!src[y * w + x]) continue;
    for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) out[ny * w + nx] = 1;
    }
  }
  return out;
}
