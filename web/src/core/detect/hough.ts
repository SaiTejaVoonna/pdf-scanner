/** A line x·cosθ + y·sinθ = ρ in pixel coordinates. `isBorder` marks the image frame itself. */
export class Line {
  constructor(readonly theta: number, readonly rho: number, readonly votes: number, readonly isBorder = false) {}

  /** Direction angle of the line itself, folded into [0°, 180°). */
  get directionDeg(): number { return (((this.theta * 180) / Math.PI + 90) % 180 + 180) % 180; }

  intersect(o: Line): [number, number] | null {
    const det = Math.cos(this.theta) * Math.sin(o.theta) - Math.sin(this.theta) * Math.cos(o.theta);
    if (Math.abs(det) < 1e-6) return null;
    const x = (this.rho * Math.sin(o.theta) - o.rho * Math.sin(this.theta)) / det;
    const y = (o.rho * Math.cos(this.theta) - this.rho * Math.cos(o.theta)) / det;
    return [x, y];
  }

  /** True when both lines are almost the same line (angle and offset), allowing for θ wrap-around. */
  nearlySameAs(o: Line, angleTolDeg: number, rhoTol: number): boolean {
    let dTheta = Math.abs((this.theta - o.theta) * 180 / Math.PI);
    let otherRho = o.rho;
    if (dTheta > 90) { dTheta = 180 - dTheta; otherRho = -o.rho; }
    return dTheta <= angleTolDeg && Math.abs(this.rho - otherRho) <= rhoTol;
  }
}

const ANGLE_BINS = 180;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Strongest straight lines through the edge map, with near-duplicates suppressed. */
export function houghLines(edges: Uint8Array, w: number, h: number, minVotes: number, maxLines: number): Line[] {
  const diag = Math.floor(Math.hypot(w, h)) + 2;
  const rhoBins = 2 * diag + 1;
  const acc = new Int32Array(ANGLE_BINS * rhoBins);
  const cosT = new Float64Array(ANGLE_BINS), sinT = new Float64Array(ANGLE_BINS);
  for (let t = 0; t < ANGLE_BINS; t++) { cosT[t] = Math.cos(rad(t)); sinT[t] = Math.sin(rad(t)); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!edges[y * w + x]) continue;
    const px = x + 0.5, py = y + 0.5;
    for (let t = 0; t < ANGLE_BINS; t++) acc[t * rhoBins + Math.round(px * cosT[t] + py * sinT[t]) + diag]++;
  }
  const peaks: { t: number; r: number; votes: number }[] = [];
  for (let t = 0; t < ANGLE_BINS; t++) for (let r = 1; r < rhoBins - 1; r++) {
    const c = acc[t * rhoBins + r], l = acc[t * rhoBins + r - 1], rr = acc[t * rhoBins + r + 1];
    const v = l + c + rr; // smooth across neighbouring rho bins so slightly bowed edges still form one peak
    if (v >= minVotes && c >= l && c >= rr) peaks.push({ t, r, votes: v });
  }
  peaks.sort((a, b) => b.votes - a.votes);
  const lines: Line[] = [];
  for (const p of peaks) {
    const cand = new Line(rad(p.t), p.r - diag, p.votes);
    if (!lines.some((l) => l.nearlySameAs(cand, 6, 10))) {
      lines.push(cand);
      if (lines.length >= maxLines) break;
    }
  }
  return lines;
}

/** The four sides of the image frame, usable as page sides when a page is cut off by the frame. */
export const borderLines = (w: number, h: number): Line[] => [
  new Line(rad(90), 0, 0, true),  // top    y = 0
  new Line(rad(0), w, 0, true),   // right  x = w
  new Line(rad(90), h, 0, true),  // bottom y = h
  new Line(rad(0), 0, 0, true),   // left   x = 0
];
