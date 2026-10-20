import { detectPage, detectSpread } from '../core/detect';
import type { Quad } from '../core/geometry';
import { sharpness } from './frame';

export interface LiveRequest { id: number; mode: 'single' | 'spread'; width: number; height: number; data: ArrayBuffer }
export interface LiveReply { id: number; quad: Quad | null; sharp: number; ms: number; error?: string }

// Live frames are small; the same detector as the review screen runs here, off the main thread.
self.onmessage = (e: MessageEvent<LiveRequest>) => {
  const { id, mode, width, height, data } = e.data;
  const t0 = performance.now();
  try {
    const img = { width, height, data: new Uint8ClampedArray(data) };
    let quad: Quad | null;
    if (mode === 'spread') { const s = detectSpread(img); quad = s.outlineGuessed ? null : s.outer; } else quad = detectPage(img);
    (self as unknown as Worker).postMessage({ id, quad, sharp: sharpness(img), ms: performance.now() - t0 } satisfies LiveReply);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, quad: null, sharp: 0, ms: performance.now() - t0, error: String(err) } satisfies LiveReply);
  }
};
