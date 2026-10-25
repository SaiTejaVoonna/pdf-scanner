import { detectPage, detectSpread } from '../core/detect';
import type { Pt, Quad } from '../core/geometry';
import { GUIDE_X, splitSpread } from '../core/spread';
import { detectAnchored, pageLike, plausibleShape } from '../core/anchor';
import { combine, findPage, type Combined, type Confidence, type FindSource } from '../core/find';
import { CornerNet } from '../modelNet';
import { runModel } from '../modelRun';
import { luma } from '../core/image';
import { sharpness } from './frame';

export interface LiveRequest { kind?: 'live'; id: number; mode: 'single' | 'spread'; anchors: boolean; width: number; height: number; data: ArrayBuffer }
/**
 * `quad` is the outline to track. In spread mode `fold` is the line between the two pages and `both` says the fold was
 * confirmed (so this really is a two-page spread); an outline without a confirmed fold means one page, or a fold that could not be seen.
 */
export interface LiveReply {
  id: number; quad: Quad | null; fold?: [Pt, Pt]; both?: boolean;
  /** The outline looks like a real page (bright, lighter than its surroundings, with writing): only then may auto-capture fire. */
  sure: boolean; why: 'dark' | 'plain' | 'blank' | null;
  /** Single page with anchor lines: which guide line(s) found an edge or a fold. */
  anchor: 'left' | 'right' | 'both' | null;
  sharp: number; ms: number; error?: string;
}

/** The detection that finds the crop of a photo that was just taken, run here so the screen never stalls. */
export interface FinalRequest { kind: 'final'; id: number; mode: 'single' | 'spread'; anchored: boolean; foldOnGuide: boolean; width: number; height: number; data: ArrayBuffer }
export interface FinalReply {
  kind: 'final'; id: number; quad: Quad | null; confidence?: Confidence; source?: FindSource;
  spread?: { outer: Quad; tTop: number; tBottom: number; uncertain: boolean; outlineGuessed: boolean };
  error?: string;
}

/** The learned model, handed over by the page once it has been fetched (the worker cannot resolve the app's base path itself). */
let net: CornerNet | null = null;

const post = (m: LiveReply | FinalReply) => (self as unknown as Worker).postMessage(m);

function live(e: LiveRequest): void {
  const { id, mode, anchors, width, height, data } = e;
  const t0 = performance.now();
  try {
    const img = { width, height, data: new Uint8ClampedArray(data) };
    let quad: Quad | null, fold: [Pt, Pt] | undefined, both: boolean | undefined, anchor: LiveReply['anchor'] = null;
    if (mode === 'spread') {
      const sp = detectSpread(img, GUIDE_X);
      quad = sp.outlineGuessed ? null : sp.outer;
      if (quad) { const [left] = splitSpread(sp); fold = [left[1], left[2]]; both = !sp.uncertain; }
    } else if (anchors) { const a = detectAnchored(img); quad = a.quad; anchor = a.anchor; } else quad = detectPage(img);
    // Not a sheet or a book (a ceiling beam, a wall at a slant): say nothing and draw nothing.
    if (quad && !plausibleShape(quad, width, height, mode === 'spread' ? 3 : 2.4)) { quad = null; fold = undefined; both = undefined; }
    const like = quad ? pageLike(img, quad) : { ok: false, why: null as LiveReply['why'] };
    let why = like.why;
    // Only an outline that holds writing or is a bright blank page is shown. A floor, a wall or a dark scene gets no outline at all.
    if (quad && !like.ok && why !== 'blank') { quad = null; fold = undefined; both = undefined; }
    if (!quad) {
      let sum = 0, n = 0;
      for (let i = 0; i < width * height; i += 7) { sum += luma(img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]); n++; }
      why = sum / Math.max(1, n) < 45 ? 'dark' : null;
    }
    post({ id, quad, fold, both, sure: like.ok, why, anchor, sharp: sharpness(img), ms: performance.now() - t0 });
  } catch (err) {
    post({ id, quad: null, sure: false, why: null, anchor: null, sharp: 0, ms: performance.now() - t0, error: String(err) });
  }
}

function final(e: FinalRequest): void {
  const { id, mode, anchored, foldOnGuide, width, height, data } = e;
  try {
    const img = { width, height, data: new Uint8ClampedArray(data) };
    if (mode === 'spread') {
      const sp = detectSpread(img, foldOnGuide ? GUIDE_X : undefined);
      post({ kind: 'final', id, quad: null, spread: { outer: sp.outer, tTop: sp.tTop, tBottom: sp.tBottom, uncertain: sp.uncertain, outlineGuessed: sp.outlineGuessed } });
    } else {
      const rules = findPage(img, { anchored });
      let f: Combined = { ...rules, source: 'rules' };
      try { if (net) f = combine(img, rules, runModel(net, img)); } catch { /* the rules stand alone */ }
      post({ kind: 'final', id, quad: f.quad, confidence: f.confidence, source: f.source });
    }
  } catch (err) { post({ kind: 'final', id, quad: null, error: String(err) }); }
}

self.onmessage = (e: MessageEvent<LiveRequest | FinalRequest | { kind: 'model'; buf: ArrayBuffer }>) => {
  const m = e.data;
  if (m.kind === 'model') { try { net = new CornerNet(m.buf); } catch { net = null; } return; }
  if (m.kind === 'final') final(m); else live(m);
};
