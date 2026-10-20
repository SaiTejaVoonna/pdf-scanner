import type { Quad } from './geometry';
import { luma, type Img } from './image';
import { detectPage } from './detect';
import { inkPoints } from './detect/content';
import { dipRate } from './spread';

/**
 * Anchor lines for single-page capture. The camera shows two vertical guide lines; the person puts one edge of the wanted page
 * on the nearest line (the outer edge of a loose sheet, or the fold when only one page of an open book is wanted). The side
 * that really shows an edge or a fold is pinned, the picture is cut there (so the neighbouring page is never reached into),
 * the existing outline detector finds the other sides in what is left, and the pinned side is put back on the line.
 */
export const ANCHOR_LEFT = 0.08, ANCHOR_RIGHT = 0.92;

const BAND = 0.07;          // how far from the guide line (fraction of width) a real edge may be found
const ROWS = 40;
const MIN_STEP = 0.1;       // brightness change that counts as an edge, relative to the local paper level
const MIN_DIP = 0.05;       // a fold is a softer, narrower valley
const MIN_EVIDENCE = 0.5;   // share of rows that must agree on one near-vertical line (an edge)
const MIN_FOLD = 0.4;       // share of rows with a valley on the line (a soft fold)
const LINE_TOL = 0.02;      // fraction of width
const MIN_STRIP = 0.2;      // the strip left for the page must be at least this wide

/** A near-vertical line, x as a fraction of the width at the top and bottom of the picture. */
export interface VLine { xTop: number; xBottom: number }
export interface LineEvidence { evidence: number; line: VLine | null; kind?: 'edge' | 'fold' }

const median = (a: number[]): number => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

const DIP_STEPS = 28;

/** A soft fold between two pages: the share of rows that are darker on a vertical line than just beside it, best line in the band. */
function foldEvidence(img: Img, x: number): LineEvidence {
  // dipRate compares the line with points 4% of the strip width to either side; the whole picture width suits a fold's shadow.
  const strip: Quad = [{ x: 0, y: 0.1 }, { x: 1, y: 0.1 }, { x: 1, y: 0.9 }, { x: 0, y: 0.9 }];
  let best = { x, dip: 0 };
  for (let i = 0; i <= DIP_STEPS; i++) { const cx = Math.min(0.98, Math.max(0.02, x - BAND + (2 * BAND * i) / DIP_STEPS)), d = dipRate(img, strip, cx, 0); if (d > best.dip) best = { x: cx, dip: d }; }
  return { evidence: best.dip, line: { xTop: best.x, xBottom: best.x } };
}

/** How well the picture shows one straight, near-vertical edge or fold near `x`. */
export function lineEvidence(img: Img, x: number): LineEvidence {
  const edge = edgeEvidence(img, x);
  if (edge.evidence >= MIN_EVIDENCE) return { ...edge, kind: 'edge' };   // a clear page edge wins over a possible fold
  const fold = foldEvidence(img, x);
  // The fold's exact position is soft (a broad shadow), so the line the person aligned is used, the valley only confirms it.
  return fold.evidence >= MIN_FOLD && fold.evidence > edge.evidence ? { evidence: fold.evidence, line: { xTop: x, xBottom: x }, kind: 'fold' } : edge;
}

function edgeEvidence(img: Img, x: number): LineEvidence {
  const { width: w, height: h, data } = img;
  const win = Math.max(3, Math.round(0.012 * w));
  const lum = (px: number, py: number) => { const i = (py * w + Math.min(w - 1, Math.max(0, px))) * 4; return luma(data[i], data[i + 1], data[i + 2]); };
  const mean = (a: number, b: number, py: number) => { let s = 0, n = 0; for (let px = a; px <= b; px++) for (let dy = -1; dy <= 1; dy++) { s += lum(px, Math.min(h - 1, Math.max(0, py + dy))); n++; } return s / n; };
  const c0 = Math.round((x - BAND) * w), c1 = Math.round((x + BAND) * w);
  const rows: { y: number; c: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    const y = Math.round(h * (0.1 + (0.8 * r) / (ROWS - 1)));
    let best = { c: -1, s: 0 };
    let level = 1;
    for (let c = c0; c <= c1; c += 1) level = Math.max(level, mean(c - win, c + win, y));
    for (let c = c0; c <= c1; c++) {
      const l = mean(c - win, c - 1, y), rr = mean(c + 1, c + win, y);
      const step = Math.abs(l - rr);
      const dip = (mean(c - 2 * win, c - win, y) + mean(c + win, c + 2 * win, y)) / 2 - mean(c - 1, c + 1, y);
      const s = Math.max(step / MIN_STEP, dip / MIN_DIP) / level; // 1 = just enough
      if (s > best.s) best = { c, s };
    }
    if (best.s >= 1) rows.push({ y, c: best.c });
  }
  if (rows.length < ROWS * MIN_EVIDENCE) return { evidence: rows.length / ROWS * 0.5, line: null };
  const third = (lo: number, hi: number) => rows.filter((r) => r.y >= h * lo && r.y <= h * hi).map((r) => r.c);
  const top = third(0, 0.4), bottom = third(0.6, 1);
  if (!top.length || !bottom.length) return { evidence: 0, line: null };
  const yTop = h * 0.25, yBottom = h * 0.75;
  const cTop = median(top), cBottom = median(bottom);
  const at = (y: number) => cTop + ((cBottom - cTop) * (y - yTop)) / (yBottom - yTop);
  const inliers = rows.filter((r) => Math.abs(r.c - at(r.y)) <= LINE_TOL * w).length;
  const evidence = inliers / ROWS;
  return { evidence, line: { xTop: at(0) / w, xBottom: at(h) / w } };
}

export interface Anchored { quad: Quad | null; anchor: 'left' | 'right' | 'both' | null; left: LineEvidence; right: LineEvidence }

const crop = (img: Img, x0: number, x1: number): Img => {
  const a = Math.max(0, Math.floor(x0 * img.width)), b = Math.min(img.width, Math.ceil(x1 * img.width)), cw = b - a;
  const data = new Uint8ClampedArray(cw * img.height * 4);
  for (let y = 0; y < img.height; y++) data.set(img.data.subarray((y * img.width + a) * 4, (y * img.width + b) * 4), y * cw * 4);
  return { width: cw, height: img.height, data };
};
const lineAt = (l: VLine, y: number) => l.xTop + (l.xBottom - l.xTop) * y;

/** Finds the page with the anchor lines: pinned side(s) from the line, the rest from the normal detector inside the strip. */
export function detectAnchored(img: Img): Anchored {
  const left = lineEvidence(img, ANCHOR_LEFT), right = lineEvidence(img, ANCHOR_RIGHT);
  const ok = (e: LineEvidence) => e.line !== null && e.evidence >= (e.kind === 'fold' ? MIN_FOLD : MIN_EVIDENCE);
  const L = ok(left) && left.line, R = ok(right) && right.line;
  if (!L && !R) return { quad: detectPage(img), anchor: null, left, right };
  const x0 = L ? Math.min(L.xTop, L.xBottom) : 0, x1 = R ? Math.max(R.xTop, R.xBottom) : 1;
  if (x1 - x0 < MIN_STRIP) return { quad: detectPage(img), anchor: null, left, right };
  const sub = crop(img, x0, x1);
  const q = detectPage(sub);
  const anchor = L && R ? 'both' : L ? 'left' : 'right';
  if (!q) return { quad: null, anchor, left, right };
  // A quad running from the very top to the very bottom of the strip is the strip's frame, not a page: do not trust it.
  if (Math.min(...q.map((p) => p.y)) < 0.005 && Math.max(...q.map((p) => p.y)) > 0.995) return { quad: null, anchor, left, right };
  const cw = sub.width / img.width, ox = Math.floor(x0 * img.width) / img.width;
  const out = q.map((p) => ({ x: ox + p.x * cw, y: p.y })) as Quad;
  // Put the pinned side(s) back exactly on the line (tl, tr, br, bl).
  if (L) { out[0] = { x: lineAt(L, out[0].y), y: out[0].y }; out[3] = { x: lineAt(L, out[3].y), y: out[3].y }; }
  if (R) { out[1] = { x: lineAt(R, out[1].y), y: out[1].y }; out[2] = { x: lineAt(R, out[2].y), y: out[2].y }; }
  return { quad: out, anchor, left, right };
}

const MIN_BRIGHT = 70, MIN_CONTRAST = 0.08, MIN_INK = 80;

/**
 * "Is this really a page?" for auto-capture: bright enough, clearly lighter than what is around it, and with writing or print
 * inside. A blank floor, a carpet or a dark room fail; so does a blank sheet (that one is captured with the shutter).
 */
export function pageLike(img: Img, quad: Quad): { ok: boolean; why: 'dark' | 'plain' | 'blank' | null } {
  const { width: w, height: h, data } = img;
  const px = quad.map((p) => ({ x: p.x * w, y: p.y * h }));
  const cx = px.reduce((s, p) => s + p.x, 0) / 4, cy = px.reduce((s, p) => s + p.y, 0) / 4;
  const maker = (k: number) => {
    // point-in-quad after scaling the quad about its centre by k
    const q = px.map((p) => ({ x: cx + (p.x - cx) * k, y: cy + (p.y - cy) * k }));
    return (x: number, y: number) => {
      let sign = 0;
      for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4]; const cr = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x); if (cr !== 0) { const s = cr > 0 ? 1 : -1; if (sign === 0) sign = s; else if (s !== sign) return false; } }
      return true;
    };
  };
  const in09 = maker(0.9), in10 = maker(1.0), in125 = maker(1.25);
  let inSum = 0, inN = 0, ringSum = 0, ringN = 0;
  for (let y = 0; y < h; y += 3) for (let x = 0; x < w; x += 3) {
    const i = (y * w + x) * 4, l = luma(data[i], data[i + 1], data[i + 2]);
    if (in09(x, y)) { inSum += l; inN++; } else if (!in10(x, y) && in125(x, y)) { ringSum += l; ringN++; }
  }
  if (inN < 30) return { ok: false, why: 'plain' };
  const inMean = inSum / inN;
  if (inMean < MIN_BRIGHT) return { ok: false, why: 'dark' };
  // Frame-edge pages have no ring around them: then only the brightness and writing tests apply.
  if (ringN > 60 && (inMean - ringSum / ringN) / Math.max(1, ringSum / ringN) < MIN_CONTRAST) return { ok: false, why: 'plain' };
  const ink = inkPoints(img).filter((p) => in10(p.x, p.y)).length;
  return ink >= MIN_INK ? { ok: true, why: null } : { ok: false, why: 'blank' };
}

/**
 * Could this quad be a sheet or an open book seen from above at an angle? Interior angles close to right angles, an ordinary
 * length-to-width ratio and opposite sides of similar length. A ceiling beam or a wall seen at a slant is none of these.
 */
export function plausibleShape(q: Quad, w: number, h: number, maxAspect = 2.4): boolean {
  const p = q.map((pt) => ({ x: pt.x * w, y: pt.y * h }));
  const len = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y);
  for (let i = 0; i < 4; i++) {
    const a = p[i], b = p[(i + 1) % 4], c = p[(i + 3) % 4];
    const v1 = { x: b.x - a.x, y: b.y - a.y }, v2 = { x: c.x - a.x, y: c.y - a.y };
    const cos = (v1.x * v2.x + v1.y * v2.y) / Math.max(1e-6, Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y));
    const deg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    if (deg < 55 || deg > 125) return false;
  }
  const top = len(p[0], p[1]), bottom = len(p[3], p[2]), left = len(p[0], p[3]), right = len(p[1], p[2]);
  if (Math.max(top, bottom) / Math.max(1, Math.min(top, bottom)) > 2 || Math.max(left, right) / Math.max(1, Math.min(left, right)) > 2) return false;
  const wd = (top + bottom) / 2, ht = (left + right) / 2;
  return Math.max(wd, ht) / Math.max(1, Math.min(wd, ht)) <= maxAspect;
}
