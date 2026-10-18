/** Points are normalized (0..1) relative to the image unless a function says "pixel". */
export interface Pt { x: number; y: number }

/** Four corners, clockwise from the top-left: [tl, tr, br, bl]. */
export type Quad = [Pt, Pt, Pt, Pt];

export const fullQuad = (): Quad => [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];

export const cloneQuad = (q: Quad): Quad => q.map((p) => ({ ...p })) as Quad;

/** Shoelace area; positive when tl→tr→br→bl runs clockwise on screen (y grows downward). */
export function signedArea(q: Quad): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

export const area = (q: Quad): number => Math.abs(signedArea(q));

/** Convex, non-degenerate, no crossed edges. */
export function isConvex(q: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-7) return false;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return true;
}

/** Usable crop: convex, clockwise (the opposite winding would mirror the page) and not tiny. */
export const isValidCrop = (q: Quad, minArea = 0.02): boolean =>
  isConvex(q) && signedArea(q) > 0 && area(q) >= minArea;

export function isFullFrame(q: Quad, eps = 0.002): boolean {
  const f = fullQuad();
  return q.every((p, i) => Math.abs(p.x - f[i].x) < eps && Math.abs(p.y - f[i].y) < eps);
}

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Orders four arbitrary points as tl, tr, br, bl. */
export function orderPoints(pts: Pt[]): Quad {
  const by = (f: (p: Pt) => number, max: boolean) =>
    pts.reduce((best, p) => (max ? f(p) > f(best) : f(p) < f(best)) ? p : best);
  return [by((p) => p.x + p.y, false), by((p) => p.x - p.y, true), by((p) => p.x + p.y, true), by((p) => p.x - p.y, false)];
}

export const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);
