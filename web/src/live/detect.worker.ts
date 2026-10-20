import { detectPage, detectSpread } from '../core/detect';
import type { Pt, Quad } from '../core/geometry';
import { splitSpread } from '../core/spread';
import { sharpness } from './frame';

export interface LiveRequest { id: number; mode: 'single' | 'spread'; width: number; height: number; data: ArrayBuffer }
/**
 * `quad` is the outline to track. In spread mode `fold` is the line between the two pages and `both` says the fold was found
 * (so this really is a two-page spread); an outline without a fold means one page, or a fold that could not be seen.
 */
export interface LiveReply { id: number; quad: Quad | null; fold?: [Pt, Pt]; both?: boolean; sharp: number; ms: number; error?: string }

// Live frames are small; the same detector as the review screen runs here, off the main thread.
self.onmessage = (e: MessageEvent<LiveRequest>) => {
  const { id, mode, width, height, data } = e.data;
  const t0 = performance.now();
  try {
    const img = { width, height, data: new Uint8ClampedArray(data) };
    let quad: Quad | null, fold: [Pt, Pt] | undefined, both: boolean | undefined;
    if (mode === 'spread') {
      const sp = detectSpread(img);
      quad = sp.outlineGuessed ? null : sp.outer;
      if (quad) { const [left] = splitSpread(sp); fold = [left[1], left[2]]; both = !sp.uncertain; }
    } else quad = detectPage(img);
    (self as unknown as Worker).postMessage({ id, quad, fold, both, sharp: sharpness(img), ms: performance.now() - t0 } satisfies LiveReply);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, quad: null, sharp: 0, ms: performance.now() - t0, error: String(err) } satisfies LiveReply);
  }
};
