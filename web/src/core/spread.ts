import { isValidCrop, type Pt, type Quad } from './geometry';
import { luma, type Img } from './image';

/**
 * Book-spread geometry. `outer` lists the spread's corners as they appear in an UPRIGHT spread: top-left, top-right,
 * bottom-right, bottom-left (any image corners, so a spread photographed sideways just uses another corner order).
 * The gutter is a line from a point on the top edge (`tTop`, 0..1 from top-left to top-right) to a point on the bottom edge
 * (`tBottom`, 0..1 from bottom-left to bottom-right); because each end slides along an outer edge, both halves are always
 * convex. The left page is first in reading order.
 */
export interface SpreadGeometry { outer: Quad; tTop: number; tBottom: number }

const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export const gutterPoints = (g: SpreadGeometry): [Pt, Pt] => [lerp(g.outer[0], g.outer[1], g.tTop), lerp(g.outer[3], g.outer[2], g.tBottom)];

/** Left page, right page: each tl, tr, br, bl like any page crop. */
export function splitSpread(g: SpreadGeometry): [Quad, Quad] {
  const [top, bottom] = gutterPoints(g);
  const o = g.outer;
  return [[o[0], top, bottom, o[3]], [top, o[1], o[2], bottom]];
}

export const isValidSpread = (g: SpreadGeometry): boolean =>
  g.tTop > 0.02 && g.tTop < 0.98 && g.tBottom > 0.02 && g.tBottom < 0.98 && splitSpread(g).every((q) => isValidCrop(q, 0.005));

/** Re-labels the outer corners by quarter turns (1 = what was the top-left corner becomes the top-right...). */
export function turnOuter(outer: Quad, turns: number): Quad {
  const k = ((turns % 4) + 4) % 4;
  return [0, 1, 2, 3].map((i) => outer[(i + k) % 4]) as Quad;
}

export const midGutter = (outer: Quad): SpreadGeometry => ({ outer, tTop: 0.5, tBottom: 0.5 });

export interface GutterResult { tTop: number; tBottom: number; confident: boolean; score: number; dipRate?: number }

const ROWS = 30;

/**
 * Looks for the dark valley where the pages meet, row by row across the spread, and fits a line through the valley
 * positions. Confident only when most rows agree on a clear, near-vertical valley; otherwise the middle is returned
 * and flagged so the caller can ask the user to confirm it (a guessed midpoint is never committed silently).
 */
export function findGutter(img: Img, outer: Quad): GutterResult {
  const fit = fitGutter(gutterRows(img, outer));
  if (!fit.line) return fit.result;
  // A real fold is a dip in (almost) every row; a column of aligned handwriting is only dark between the lines.
  const dip = dipRate(img, outer, fit.line.a, fit.line.b);
  const confident = fit.result.confident && dip >= 0.75;
  return confident ? { ...fit.result, dipRate: dip } : { tTop: 0.5, tBottom: 0.5, confident: false, score: fit.result.score * dip, dipRate: dip };
}

/** The camera's fold guide is a vertical line in the middle of the picture. */
export const GUIDE_X = 0.5;

export interface GuideFold { tTop: number; tBottom: number; dip: number; /** the guide line crosses the outline near its middle */ central: boolean }

const GUIDE_REACH = 0.06, GUIDE_STEP = 0.01;

/**
 * The camera shows a vertical guide at image x = `guideX`; the person puts the fold on it. So the fold is taken to run
 * along that line, clipped to the outline, and only checked (not searched for): the line may slide a little sideways
 * (and so tilt-free) to sit on the darkest valley, and `dip` says how many rows really show a valley there.
 */
export function foldFromGuide(img: Img, outer: Quad, guideX = GUIDE_X): GuideFold {
  const cross = (a: Pt, b: Pt) => (Math.abs(b.x - a.x) < 1e-6 ? 0.5 : (guideX - a.x) / (b.x - a.x));
  const top = cross(outer[0], outer[1]), bottom = cross(outer[3], outer[2]);
  const central = top > 0.3 && top < 0.7 && bottom > 0.3 && bottom < 0.7;
  const t0 = Math.min(0.95, Math.max(0.05, top)), b0 = Math.min(0.95, Math.max(0.05, bottom));
  let best = { d: 0, dip: -1 };
  for (let d = -GUIDE_REACH; d <= GUIDE_REACH + 1e-9; d += GUIDE_STEP) {
    const a = Math.min(0.95, Math.max(0.05, t0 + d)), b = Math.min(0.95, Math.max(0.05, b0 + d));
    const dip = dipRate(img, outer, a, b - a);
    // Prefer the guide itself when it is about as good as a sideways shift.
    if (dip > best.dip + 0.04 || (Math.abs(d) < 1e-9 && dip >= best.dip - 0.04)) best = { d, dip };
  }
  return { tTop: Math.min(0.95, Math.max(0.05, t0 + best.d)), tBottom: Math.min(0.95, Math.max(0.05, b0 + best.d)), dip: best.dip, central };
}

/** Fraction of rows where the luminance along the line t = a + b*s is darker than at 0.04 to either side. */
export function dipRate(img: Img, outer: Quad, a: number, b: number): number {
  const { width: w, height: h, data } = img;
  const px = outer.map((p) => ({ x: p.x * w, y: p.y * h }));
  const at = (p: Pt) => {
    const ix = Math.min(w - 1, Math.max(0, Math.round(p.x))), iy = Math.min(h - 1, Math.max(0, Math.round(p.y)));
    const i = (iy * w + ix) * 4;
    return luma(data[i], data[i + 1], data[i + 2]);
  };
  let dips = 0;
  for (let r = 0; r < ROWS; r++) {
    const s = 0.08 + (0.84 * r) / (ROWS - 1);
    const l = lerp(px[0], px[3], s), rr = lerp(px[1], px[2], s), t = a + b * s;
    const avg = (tt: number) => { const p = lerp(l, rr, Math.min(0.99, Math.max(0.01, tt))); return (at(p) + at({ x: p.x - 1, y: p.y }) + at({ x: p.x + 1, y: p.y })) / 3; };
    const center = avg(t), around = (avg(t - 0.04) + avg(t + 0.04)) / 2;
    if (around > 1 && (around - center) / around >= 0.04) dips++;
  }
  return dips / ROWS;
}

interface GutterRow { s: number; t: number; depth: number }

/** One candidate valley position per row (rows without a clear valley are omitted). Exported for tests and the benchmark. */
export function gutterRows(img: Img, outer: Quad): GutterRow[] {
  const { width: w, height: h, data } = img;
  const lum = (x: number, y: number) => {
    const ix = Math.min(w - 1, Math.max(0, Math.round(x))), iy = Math.min(h - 1, Math.max(0, Math.round(y)));
    const i = (iy * w + ix) * 4;
    return luma(data[i], data[i + 1], data[i + 2]);
  };
  const px = outer.map((p) => ({ x: p.x * w, y: p.y * h })) as Quad;
  const pts: GutterRow[] = [];
  for (let r = 0; r < ROWS; r++) {
    const s = 0.08 + (0.84 * r) / (ROWS - 1);
    const a = lerp(px[0], px[3], s), b = lerp(px[1], px[2], s);
    const span = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(24, Math.round(span));
    const prof: number[] = [];
    for (let i = 0; i <= n; i++) { const p = lerp(a, b, i / n); prof.push(lum(p.x, p.y)); }
    const win = Math.max(2, Math.round(n / 70));
    const sm = prof.map((_, i) => { let sum = 0, c = 0; for (let k = -win; k <= win; k++) { const v = prof[i + k]; if (v !== undefined) { sum += v; c++; } } return sum / c; });
    const lo = Math.floor(n * 0.1), hi = Math.ceil(n * 0.9);
    const sorted = sm.slice(lo, hi).sort((x, y) => x - y);
    const paper = sorted[Math.floor(sorted.length * 0.9)] ?? 0;
    // Up to three deepest, well-separated local minima: the fold is often not the darkest thing in a row (handwriting is).
    const minima: number[] = [];
    for (let i = Math.max(1, lo); i <= Math.min(n - 1, hi); i++) if (sm[i] <= sm[i - 1] && sm[i] < sm[i + 1]) minima.push(i);
    minima.sort((x, y) => sm[x] - sm[y]);
    const kept: number[] = [];
    for (const m of minima) if (kept.length < 3 && kept.every((k) => Math.abs(k - m) > n * 0.04)) kept.push(m);
    for (const m of kept) {
      const depth = paper > 1 ? (paper - sm[m]) / paper : 0;
      if (depth >= 0.1) pts.push({ s, t: m / n, depth });
    }
  }
  return pts;
}

function fitGutter(pts: GutterRow[]): { result: GutterResult; line?: { a: number; b: number } } {
  const mid: GutterResult = { tTop: 0.5, tBottom: 0.5, confident: false, score: 0 };
  if (pts.length < 6) return { result: mid };
  const rowsOf = (a: number, b: number, tol: number) => {
    const rows = new Set<number>();
    for (const p of pts) if (Math.abs(p.t - (a + b * p.s)) <= tol) rows.add(Math.round(p.s * 1000));
    return rows.size;
  };
  // Hough-style vote: the line through two valley candidates that most rows agree with.
  let best = { a: 0.5, b: 0, rows: 0 };
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const ds = pts[j].s - pts[i].s;
    if (Math.abs(ds) < 0.2) continue;
    const b = (pts[j].t - pts[i].t) / ds;
    if (Math.abs(b) > 0.35) continue;
    const a = pts[i].t - b * pts[i].s;
    const rows = rowsOf(a, b, 0.02);
    if (rows > best.rows) best = { a, b, rows };
  }
  const inliers = pts.filter((p) => Math.abs(p.t - (best.a + best.b * p.s)) <= 0.02);
  if (!inliers.length) return { result: mid };
  // Refine with the inliers' median offset.
  const offs = inliers.map((p) => p.t - best.b * p.s).sort((x, y) => x - y);
  const a = offs[Math.floor(offs.length / 2)];
  const depths = inliers.map((p) => p.depth).sort((x, y) => x - y);
  const medianDepth = depths[Math.floor(depths.length / 2)];
  const tTop = Math.min(0.95, Math.max(0.05, a)), tBottom = Math.min(0.95, Math.max(0.05, a + best.b));
  const confident = best.rows >= ROWS * 0.5 && medianDepth >= 0.12;
  const score = (best.rows / ROWS) * medianDepth;
  return { result: confident ? { tTop, tBottom, confident, score } : { ...mid, score }, line: { a, b: best.b } };
}

/**
 * Fraction of each side of `quad` (in the order tl-tr, tr-br, br-bl, bl-tl) where thin dark strokes - writing - touch
 * the boundary from the inside. Writing there is probably cut by the crop. Wide dark areas (a gutter shadow, a desk) are
 * not strokes and are ignored.
 */
export function boundaryInk(img: Img, quad: Quad): [number, number, number, number] {
  const { width: w, height: h, data } = img;
  const px = quad.map((p) => ({ x: p.x * w, y: p.y * h }));
  const lum = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 255;
    const i = ((y | 0) * w + (x | 0)) * 4;
    return luma(data[i], data[i + 1], data[i + 2]);
  };
  // The page's paper level: 90th percentile of luma inside the quad.
  const xs = px.map((p) => p.x), ys = px.map((p) => p.y);
  const hist = new Int32Array(256);
  let count = 0;
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(h - 1, Math.ceil(Math.max(...ys))); y += 2) {
    for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(w - 1, Math.ceil(Math.max(...xs))); x += 2) {
      let ok = true;
      for (let i = 0; i < 4 && ok; i++) { const j = (i + 1) % 4; if ((px[j].x - px[i].x) * (y - px[i].y) - (px[j].y - px[i].y) * (x - px[i].x) < 0) ok = false; }
      if (ok) { hist[lum(x, y)]++; count++; }
    }
  }
  if (count < 50) return [0, 0, 0, 0];
  let acc = 0, paper = 255;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= count * 0.9) { paper = v; break; } }
  const dark = paper * 0.6;
  const out: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = px[i], b = px[(i + 1) % 4];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len; // clockwise quad: this points inward
    let touched = 0, total = 0;
    for (let s = 0; s < len; s++) {
      const x = a.x + ((b.x - a.x) * s) / len, y = a.y + ((b.y - a.y) * s) / len;
      total++;
      let d0 = -1;
      for (let d = 0; d <= 3; d++) if (lum(x + nx * d, y + ny * d) < dark) { d0 = d; break; }
      if (d0 < 0) continue;
      // Strokes have sharp edges: a pixel 3 px either way is much brighter. A soft fold shadow changes slowly.
      const here = lum(x + nx * d0, y + ny * d0);
      let brightest = 0;
      for (const k of [2, 3, 4]) brightest = Math.max(brightest, lum(x + nx * (d0 + k), y + ny * (d0 + k)), lum(x + nx * (d0 - k), y + ny * (d0 - k)));
      if (brightest - here < paper * 0.25) continue;
      // Width of the dark run through this point, inward and outward: strokes are thin, a fold shadow or the desk is wide.
      let run = 0;
      while (run < 14 && lum(x + nx * (d0 + run), y + ny * (d0 + run)) < dark) run++;
      let back = 1;
      while (back < 14 && lum(x + nx * (d0 - back), y + ny * (d0 - back)) < dark) back++;
      if (run + back - 1 <= 8) touched++;
    }
    out.push(total ? touched / total : 0);
  }
  return out as [number, number, number, number];
}
