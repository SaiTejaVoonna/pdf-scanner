import type { Pt, Quad } from '../core/geometry';
import type { LiveReply, LiveRequest } from './detect.worker';
// Inlined into the main bundle so the live detector is cached with the app and works offline from the first visit.
import DetectWorker from './detect.worker?worker&inline';

const LONG_SIDE = 400;
const MIN_GAP_MS = 70; // at most about 12 detections a second even on a fast phone

/**
 * Samples the camera preview a few times a second, sends a small copy to the detector worker and hands each result to
 * `onResult`. One frame is in flight at a time, so a slow phone simply runs at a lower rate instead of falling behind.
 */
export class LiveLoop {
  private worker: Worker | null = null;
  private canvas = document.createElement('canvas');
  private timer = 0;
  private id = 0;
  private stopped = false;
  mode: LiveRequest['mode'] = 'single';
  anchors = false;
  constructor(private video: HTMLVideoElement, private onResult: (r: { quad: Quad | null; fold?: [Pt, Pt]; both?: boolean; sure: boolean; why: LiveReply['why']; anchor: LiveReply['anchor']; sharp: number; t: number; ms: number }) => void, private onFail: () => void) {}

  start(): void {
    try { this.worker = new DetectWorker(); } catch { this.onFail(); return; }
    this.worker.onerror = () => { this.stop(); this.onFail(); };
    this.worker.onmessage = (e: MessageEvent<LiveReply>) => {
      if (this.stopped) return;
      if (e.data.error) { this.stop(); this.onFail(); return; }
      this.onResult({ quad: e.data.quad, fold: e.data.fold, both: e.data.both, sure: e.data.sure, why: e.data.why, anchor: e.data.anchor, sharp: e.data.sharp, t: performance.now(), ms: e.data.ms });
      this.timer = window.setTimeout(() => this.send(), Math.max(0, MIN_GAP_MS - e.data.ms));
    };
    this.send();
  }

  stop(): void { this.stopped = true; clearTimeout(this.timer); this.worker?.terminate(); this.worker = null; }

  private send(): void {
    const v = this.video;
    if (this.stopped || !this.worker) return;
    if (!v.videoWidth || v.readyState < 2) { this.timer = window.setTimeout(() => this.send(), 100); return; }
    const k = LONG_SIDE / Math.max(v.videoWidth, v.videoHeight);
    const w = Math.max(32, Math.round(v.videoWidth * k)), h = Math.max(32, Math.round(v.videoHeight * k));
    this.canvas.width = w; this.canvas.height = h;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(v, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h);
    this.worker.postMessage({ id: ++this.id, mode: this.mode, anchors: this.anchors, width: w, height: h, data: px.data.buffer } satisfies LiveRequest, [px.data.buffer]);
  }
}
