import { area, type Pt, type Quad } from '../core/geometry';

/** How patient auto-capture is: frames the page must hold still for, and at least this long. */
export type Speed = 'fast' | 'normal' | 'careful';
export const SPEEDS: Record<Speed, { frames: number; holdMs: number; label: string }> = {
  fast: { frames: 3, holdMs: 400, label: 'Fast' },
  normal: { frames: 5, holdMs: 700, label: 'Normal' },
  careful: { frames: 8, holdMs: 1300, label: 'Careful' },
};

/** What the detector saw in one live frame. `quad` is null when no page outline was found. */
export interface Observation { t: number; quad: Quad | null; sharp: number }

export type LiveState = 'searching' | 'tracking' | 'steady' | 'cooldown';
export interface LiveResult { state: LiveState; /** 0..1 toward firing */ progress: number; fire: boolean; quad: Quad | null }

const MAX_MOVE = 0.03;      // a corner may move this much (as a fraction of the frame's diagonal-ish size) between frames
const MIN_AREA = 0.15;      // smaller than this is not "the page"
const MIN_SHARP_RATIO = 0.6; // blurry (moving) frames are skipped
export const MIN_SHARP_ABS = 120;   // and so is anything blurrier than this, whatever the recent frames looked like
const SHARP_DECAY = 0.985;   // the reference sharpness fades slowly, so one lucky frame does not block captures for ever
const COOLDOWN_MS = 1200;
const GONE_FRAMES = 3;

const centroid = (q: Quad): Pt => ({ x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4, y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4 });
const maxMove = (a: Quad, b: Quad): number => Math.max(...a.map((p, i) => Math.hypot(p.x - b[i].x, p.y - b[i].y)));

/**
 * Turns a stream of per-frame observations into "fire now". It fires once the page has been in view, big enough,
 * sharp and still for a few frames in a row. After a shot it waits (cooldown) until the camera has clearly moved to
 * something else (page gone, or a different place/size), so one page is never captured twice.
 */
export class AutoTracker {
  private run = 0;
  private runStart = 0;
  private last: Quad | null = null;
  private bestSharp = 0;
  /** Sharpest recent frame, kept across motion (unlike `bestSharp`, which restarts with every still run). */
  private recentBest = 0;
  private fired: { quad: Quad; t: number } | null = null;
  private gone = 0;
  constructor(public speed: Speed = 'normal') {}

  reset(): void { this.run = 0; this.last = null; this.bestSharp = 0; this.recentBest = 0; this.fired = null; this.gone = 0; }

  push(o: Observation): LiveResult {
    this.recentBest = Math.max(o.sharp, this.recentBest * SHARP_DECAY);
    const q = o.quad && area(o.quad) >= MIN_AREA ? o.quad : null;
    if (this.fired) return this.cooldown(o.t, q);
    if (!q) { this.run = 0; this.last = null; this.bestSharp = 0; return { state: 'searching', progress: 0, fire: false, quad: null }; }
    const still = this.last !== null && maxMove(q, this.last) <= MAX_MOVE;
    if (!still) { this.run = 0; this.bestSharp = 0; this.runStart = o.t; }
    this.last = q;
    this.bestSharp = Math.max(this.bestSharp, o.sharp);
    const sharp = o.sharp >= MIN_SHARP_ABS && o.sharp >= MIN_SHARP_RATIO * Math.max(this.bestSharp, this.recentBest);
    if (still && sharp) this.run++; else if (still) this.run = Math.max(0, this.run - 1);
    const s = SPEEDS[this.speed];
    const progress = Math.min(1, this.run / s.frames, (o.t - this.runStart) / s.holdMs);
    if (this.run >= s.frames && o.t - this.runStart >= s.holdMs && sharp) {
      this.fired = { quad: q, t: o.t }; this.run = 0; this.gone = 0;
      return { state: 'steady', progress: 1, fire: true, quad: q };
    }
    return { state: this.run > 0 ? 'steady' : 'tracking', progress: Math.max(0, progress), fire: false, quad: q };
  }

  private cooldown(t: number, q: Quad | null): LiveResult {
    const f = this.fired!;
    this.gone = q ? 0 : this.gone + 1;
    const moved = q !== null && (Math.hypot(centroid(q).x - centroid(f.quad).x, centroid(q).y - centroid(f.quad).y) > 0.12 || area(q) / area(f.quad) > 1.43 || area(q) / area(f.quad) < 0.7);
    if (t - f.t >= COOLDOWN_MS && (this.gone >= GONE_FRAMES || moved)) { this.fired = null; this.last = null; this.run = 0; this.bestSharp = 0; return { state: 'searching', progress: 0, fire: false, quad: q }; }
    return { state: 'cooldown', progress: 1, fire: false, quad: q };
  }
}
