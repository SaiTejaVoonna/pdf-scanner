import { area, isValidCrop, orderPoints, type Pt, type Quad } from '../geometry';
import { findGutter, foldFromGuide, midGutter, splitSpread, turnOuter, type SpreadGeometry } from '../spread';
import { boxBlur, luma, type Img } from '../image';
import { cannyEdges } from './canny';
import { borderLines, houghLines, type Line } from './hough';
import { paperCandidates } from './paper';
import { contentQuad, inkCrossing, inkNear, inkPoints } from './content';
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
const MIN_PAPER_FRACTION = 0.5;
const MIN_INK = 300, MAX_CROSSING = 0.04, CONTENT_MARGIN = 0.05, MAX_GROWTH = 1.6;
const CONTRAST_OFFSETS = [4, 7, 10, 13, 16];

export interface Candidate { source: 'lines' | 'region' | 'paper'; quad: Quad; score: number; paper: number }

/**
 * `img` should be a small copy (about 400 px); returns normalized corners or null. `trace` (benchmarks and debugging) is called
 * with every candidate that survives the basic checks, with the score it would have.
 */
export function detectPage(img: Img, trace?: (c: Candidate) => void): Quad | null {
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
  let source: Candidate['source'] = 'lines';
  const consider = (px: Pt[] | null) => {
    if (!px) return;
    const s = scorer.score(px);
    if (!s) return;
    if (trace) { const pf = scorer.paperFraction(s.quad); trace({ source, quad: s.quad, score: s.score * Math.pow(pf, 3), paper: pf }); }
    if (best && s.score <= best.score) return;
    // Only the few candidates that could win pay for the (slower) "is this mostly paper?" check.
    const pf = scorer.paperFraction(s.quad);
    if (pf < MIN_PAPER_FRACTION) return;
    s.score *= Math.pow(pf, 3);
    if (!best || s.score > best.score) best = s;
  };

  const minVotes = Math.max(12, Math.floor(0.25 * Math.min(w, h)));
  const lines = [...houghLines(edges, w, h, minVotes, 28), ...borderLines(w, h)];
  forEachQuad(lines, consider);

  const gray = new Int32Array(n);
  for (let i = 0; i < n; i++) gray[i] = luma(channels[0][i], channels[1][i], channels[2][i]);
  source = 'region';
  for (const q of regionCandidates(gray, w, h)) consider(q.map((p) => ({ x: p.x * w, y: p.y * h })));
  const white = new Int32Array(n);
  for (let i = 0; i < n; i++) white[i] = Math.min(channels[0][i], channels[1][i], channels[2][i]);
  source = 'paper';
  for (const q of paperCandidates(white, w, h)) consider(q.map((p) => ({ x: p.x * w, y: p.y * h })));

  const result = best as { quad: Quad; score: number } | null;
  if (!result || !isValidCrop(result.quad)) return null;
  const loose = padQuad(result.quad, CROP_MARGIN);
  const chosen = isValidCrop(loose) ? loose : result.quad;
  // Never cut writing: if the chosen outline runs through lines of text (a shadow or a stack of sheets fooled the edge search),
  // fall back to a box around the nearby writing, unless that box would be much bigger than the outline.
  const ink = inkPoints(img);
  if (ink.length >= MIN_INK && inkCrossing(ink, chosen, w, h) > MAX_CROSSING) {
    const box = contentQuad(inkNear(ink, chosen, w, h, 0.25), w, h, CONTENT_MARGIN);
    if (box && isValidCrop(box) && area(box) <= MAX_GROWTH * area(chosen)) return box;
  }
  return chosen;
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

  /**
   * How much of the quad's interior looks like paper: pixels at least 80% as white as the quad's own bright level
   * (its 90th percentile). Paper with text scores ~0.9; a box around fabric, a keyboard and a floor scores far less.
   */
  paperFraction(q: Quad): number {
    const { w, h, smooth } = this;
    const xs = q.map((p) => p.x * w), ys = q.map((p) => p.y * h);
    const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(h - 1, Math.ceil(Math.max(...ys)));
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), x1 = Math.min(w - 1, Math.ceil(Math.max(...xs)));
    const hist = new Int32Array(256);
    let count = 0;
    for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) {
      let inside = true;
      for (let i = 0; i < 4 && inside; i++) {
        const j = (i + 1) % 4;
        if ((xs[j] - xs[i]) * (y - ys[i]) - (ys[j] - ys[i]) * (x - xs[i]) < 0) inside = false;
      }
      if (!inside) continue;
      const k = y * w + x;
      hist[Math.min(255, Math.max(0, Math.min(smooth[0][k], smooth[1][k], smooth[2][k])))]++;
      count++;
    }
    if (count < 20) return 0;
    let acc = 0, p90 = 255;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= count * 0.9) { p90 = v; break; } }
    const cut = p90 * 0.8;
    let paper = 0;
    for (let v = Math.ceil(cut); v < 256; v++) paper += hist[v];
    return paper / count;
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

export interface SpreadDetection extends SpreadGeometry {
  /** True when the gutter could not be found: the geometry holds a guessed midpoint that the user must confirm. */
  uncertain: boolean;
  /** True when no page outline was found either and the outline is just the frame (inset). */
  outlineGuessed: boolean;
}

const INSET = 0.03;
/** Share of rows that must show a valley on the guide line before a camera spread counts as confirmed (green). */
const GUIDE_MIN_DIP = 0.55;

/**
 * Two-page spread: the outer outline from the page detector plus the gutter valley. Tries both orientations (vertical
 * valley = pages side by side; horizontal valley = photo taken sideways, where the top page is treated as the first).
 * Never returns "nothing": when unsure it returns a flagged guess so the review screen can ask the user.
 */
export function detectSpread(img: Img, guideX?: number): SpreadDetection {
  const found = detectPage(img);
  const outer: Quad = found ?? [{ x: INSET, y: INSET }, { x: 1 - INSET, y: INSET }, { x: 1 - INSET, y: 1 - INSET }, { x: INSET, y: 1 - INSET }];
  if (guideX !== undefined) {
    // In-app camera: the fold was placed on the guide line, so use it (and just check it) instead of searching.
    const f = foldFromGuide(img, outer, guideX);
    return { outer, tTop: f.tTop, tBottom: f.tBottom, uncertain: !(f.central && f.dip >= GUIDE_MIN_DIP), outlineGuessed: !found };
  }
  let best: { outer: Quad; g: ReturnType<typeof findGutter> } | null = null;
  for (const turns of [0, 1]) {
    const o = turnOuter(outer, turns);
    const g = findGutter(img, o);
    if (!best || (g.confident && (!best.g.confident || g.score > best.g.score))) best = { outer: o, g };
  }
  const { outer: o, g } = best!;
  return { outer: o, tTop: g.tTop, tBottom: g.tBottom, uncertain: !g.confident, outlineGuessed: !found };
}

export interface Detection { pages: Quad[]; spread?: SpreadDetection }

/** Benchmark entry point: 'page' gives one crop (or none), 'spread' gives the two page crops of a spread. */
export function detectDocument(img: Img, mode: 'page' | 'spread' = 'page'): Detection | null {
  if (mode === 'page') { const q = detectPage(img); return q ? { pages: [q] } : null; }
  const spread = detectSpread(img);
  return { pages: splitSpread(spread), spread };
}

export { midGutter };
