import { isValidCrop, type Pt, type Quad } from './geometry';
import { luma, type Img } from './image';

/**
 * Edge snapping: moves each side of a rough outline onto the real paper edge next to it.
 *
 * For points along every side it looks across the side (both ways, up to `reach` of the image) for a step from bright paper
 * inside to darker background outside, measured as the difference of two short bands so a pen stroke near the margin does
 * not count as an edge. A straight line is fitted through the points that found an edge (outliers are dropped), and the four
 * lines are intersected to give the new corners. A side keeps its old line when too few points found an edge, and the whole
 * outline is kept when the result is not a sensible shape or moves a corner further than the search reach.
 */
export interface RefineOptions { reach?: number; samples?: number; band?: number; minStep?: number; minHits?: number; guard?: boolean; maxTurn?: number; outermost?: number }
const DEFAULTS: Required<RefineOptions> = { reach: 0.06, samples: 32, band: 4, minStep: 14, minHits: 0.4, guard: false, maxTurn: 0, outermost: 0 };

interface Line { px: number; py: number; dx: number; dy: number } // a point on the line and a unit direction (pixels)

export function refineQuad(img: Img, quad: Quad, opts: RefineOptions = {}): { quad: Quad; moved: number } {
  const o = { ...DEFAULTS, ...opts };
  const { width: w, height: h } = img;
  const gray = grayOf(img);
  const at = (x: number, y: number): number => bilinear(gray, w, h, x, y);
  const P = quad.map((p) => ({ x: p.x * w, y: p.y * h }));
  const cx = (P[0].x + P[1].x + P[2].x + P[3].x) / 4, cy = (P[0].y + P[1].y + P[2].y + P[3].y) / 4;
  const reach = o.reach * Math.max(w, h);

  const lines: Line[] = [];
  let snapped = 0;
  for (let s = 0; s < 4; s++) {
    const a = P[s], b = P[(s + 1) % 4];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const dx = (b.x - a.x) / len, dy = (b.y - a.y) / len;
    // Outward normal: perpendicular to the side, pointing away from the centre.
    let nx = dy, ny = -dx;
    if (((a.x + b.x) / 2 - cx) * nx + ((a.y + b.y) / 2 - cy) * ny < 0) { nx = -nx; ny = -ny; }
    const hits: Pt[] = [];
    for (let i = 0; i < o.samples; i++) {
      const f = 0.12 + 0.76 * (i / (o.samples - 1)); // stay away from the corners, where two edges meet
      const px = a.x + (b.x - a.x) * f, py = a.y + (b.y - a.y) * f;
      let best = -Infinity, bestT = 0;
      const steps: number[] = [];
      for (let t = -reach; t <= reach; t += 0.5) {
        let inside = 0, outside = 0;
        for (let k = 1; k <= o.band; k++) {
          inside += at(px + (t - k) * nx, py + (t - k) * ny);
          outside += at(px + (t + k) * nx, py + (t + k) * ny);
        }
        const step = (inside - outside) / o.band - Math.abs(t) / reach * 4; // small pull towards the original side
        steps.push(step);
        if (step > best) { best = step; bestT = t; }
      }
      if (o.outermost > 0) {
        // The paper edge is the outermost clear step: take the furthest-out one that is nearly as strong as the best.
        for (let j = steps.length - 1; j >= 0; j--) if (steps[j] >= o.outermost * best && steps[j] >= o.minStep) { bestT = -reach + j * 0.5; break; }
      }
      if (best >= o.minStep) hits.push({ x: px + bestT * nx, y: py + bestT * ny });
    }
    const fit = hits.length >= o.minHits * o.samples ? fitLine(hits) : null;
    const old = { px: a.x, py: a.y, dx, dy };
    // Keep the new line only when more of it sits on a clear paper edge than the old one did.
    if (fit && o.maxTurn > 0 && Math.abs(fit.dx * dy - fit.dy * dx) > Math.sin(o.maxTurn * Math.PI / 180)) { lines.push({ px: a.x, py: a.y, dx, dy }); continue; }
    if (fit && (!o.guard || support(fit, a, b, nx, ny) > support(old, a, b, nx, ny) + 0.1)) { lines.push(fit); snapped++; } else lines.push(old);
  }
  if (snapped === 0) return { quad, moved: 0 };

  /** Share of points along the side (projected onto `line`) where there is a bright-inside step right on the line. */
  function support(line: Line, a: Pt, b: Pt, nx: number, ny: number): number {
    let ok = 0;
    for (let i = 0; i < o.samples; i++) {
      const f = 0.12 + 0.76 * (i / (o.samples - 1));
      const sx = a.x + (b.x - a.x) * f, sy = a.y + (b.y - a.y) * f;
      const u = (sx - line.px) * line.dx + (sy - line.py) * line.dy, px = line.px + u * line.dx, py = line.py + u * line.dy;
      let inside = 0, outside = 0;
      for (let k = 1; k <= o.band; k++) { inside += at(px - k * nx, py - k * ny); outside += at(px + k * nx, py + k * ny); }
      if ((inside - outside) / o.band >= o.minStep) ok++;
    }
    return ok / o.samples;
  }

  const out: Pt[] = [];
  for (let c = 0; c < 4; c++) {
    const p = intersect(lines[(c + 3) % 4], lines[c]); // corner c joins the side before it and the side after it
    if (!p) return { quad, moved: 0 };
    out.push(p);
  }
  let moved = 0;
  for (let c = 0; c < 4; c++) moved = Math.max(moved, Math.hypot(out[c].x - P[c].x, out[c].y - P[c].y));
  const q = out.map((p) => ({ x: p.x / w, y: p.y / h })) as Quad;
  if (moved > reach * 1.6 || !isValidCrop(q) || q.some((p) => p.x < -0.02 || p.x > 1.02 || p.y < -0.02 || p.y > 1.02)) return { quad, moved: 0 };
  return { quad: q.map((p) => ({ x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) })) as Quad, moved: moved / Math.max(w, h) };
}

function grayOf(img: Img): Float32Array {
  const { data, width: w, height: h } = img;
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = luma(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  return g;
}

function bilinear(g: Float32Array, w: number, h: number, x: number, y: number): number {
  x = Math.min(w - 1.001, Math.max(0, x)); y = Math.min(h - 1.001, Math.max(0, y));
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
  return (g[i] * (1 - fx) + g[i + 1] * fx) * (1 - fy) + (g[i + w] * (1 - fx) + g[i + w + 1] * fx) * fy;
}

/** Least-squares line through the points, refitted twice without the points furthest from it. */
function fitLine(pts: Pt[]): Line | null {
  let use = pts;
  let line: Line | null = null;
  for (let round = 0; round < 3; round++) {
    if (use.length < 4) return line;
    let mx = 0, my = 0;
    for (const p of use) { mx += p.x; my += p.y; }
    mx /= use.length; my /= use.length;
    let sxx = 0, sxy = 0, syy = 0;
    for (const p of use) { const ux = p.x - mx, uy = p.y - my; sxx += ux * ux; sxy += ux * uy; syy += uy * uy; }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    line = { px: mx, py: my, dx: Math.cos(ang), dy: Math.sin(ang) };
    const d = use.map((p) => Math.abs((p.x - mx) * -line!.dy + (p.y - my) * line!.dx));
    const sorted = [...d].sort((a, b) => a - b), med = sorted[sorted.length >> 1];
    const keep = use.filter((_, i) => d[i] <= Math.max(1.5, 2.5 * med));
    if (keep.length === use.length) break;
    use = keep;
  }
  return line;
}

function intersect(a: Line, b: Line): Pt | null {
  const den = a.dx * b.dy - a.dy * b.dx;
  if (Math.abs(den) < 1e-6) return null;
  const t = ((b.px - a.px) * b.dy - (b.py - a.py) * b.dx) / den;
  return { x: a.px + t * a.dx, y: a.py + t * a.dy };
}
