import type { Quad } from '../core/geometry';
import type { Img } from '../core/image';
import type { FinalReply, FinalRequest } from './detect.worker';
import { loadModelBytes } from '../model';
import DetectWorker from './detect.worker?worker&inline';

export type FinalResult = Pick<FinalReply, 'quad' | 'spread' | 'confidence' | 'source'>;

let worker: Worker | null = null;
/** Resolves once the model (if there is one) has been handed to the worker, so no request is answered before it. */
let modelReady: Promise<void> = Promise.resolve();
let id = 0;
const waiting = new Map<number, (r: FinalResult | null) => void>();

function start(): Worker | null {
  if (worker) return worker;
  try {
    worker = new DetectWorker();
    const w = worker;
    modelReady = loadModelBytes().then((b) => { if (b && w === worker) w.postMessage({ kind: 'model', buf: b.slice(0) }); }).catch(() => undefined);
    worker.onmessage = (e: MessageEvent<FinalReply>) => {
      if (e.data.kind !== 'final') return;
      const done = waiting.get(e.data.id); waiting.delete(e.data.id);
      done?.(e.data.error ? null : { quad: e.data.quad, spread: e.data.spread, confidence: e.data.confidence, source: e.data.source });
    };
    worker.onerror = () => { waiting.forEach((d) => d(null)); waiting.clear(); worker?.terminate(); worker = null; };
  } catch { worker = null; }
  return worker;
}

/**
 * Finds the crop (or the spread split) of a small copy of a photo in the background worker. Resolves null if the worker is not
 * available, so the caller can keep what it has. Requests are answered in the order they are sent.
 */
export function detectInBackground(img: Img, req: Pick<FinalRequest, 'mode' | 'anchored' | 'foldOnGuide'>): Promise<FinalResult | null> {
  const w = start();
  if (!w) return Promise.resolve(null);
  return new Promise((resolve) => {
    const my = ++id;
    waiting.set(my, resolve);
    const data = new Uint8ClampedArray(img.data); // the original stays usable; the copy is handed over
    void modelReady.then(() => w.postMessage({ kind: 'final', id: my, ...req, width: img.width, height: img.height, data: data.buffer } satisfies FinalRequest, [data.buffer]));
  });
}

export type { Quad };
