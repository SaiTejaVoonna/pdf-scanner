import type { Pt, Quad } from '../core/geometry';
import type { LiveReply, LiveRequest } from './detect.worker';
// Inlined into the main bundle so the live detector is cached with the app and works offline from the first visit.
import DetectWorker from './detect.worker?worker&inline';

const LONG_SIDE = 400;
const MIN_GAP_MS = 70; // at most about 12 detections a second even on a fast phone
const MAX_IDLE_GAP_MS = 350; // with nothing in view the loop slows down to save battery

/** The part of the video the person actually sees (the preview fills the screen and crops the rest), in video pixels. */
export interface ViewRect { sx: number; sy: number; sw: number; sh: number }

export interface LiveResult {
  quad: Quad | null; fold?: [Pt, Pt]; both?: boolean; sure: boolean; why: LiveReply['why']; anchor: LiveReply['anchor'];
  sharp: number; t: number; ms: number;
}

/**
 * Samples the visible part of the camera preview a few times a second, sends a small copy to the detector worker and hands
 * each result to `onResult`. One frame is in flight at a time, so a slow phone simply runs at a lower rate instead of falling behind.
 */
export class LiveLoop {
  private worker: Worker | null = null;
  private canvas = document.createElement('canvas');
  private timer = 0;
  private id = 0;
  private stopped = false;
  private idle = 0;
  mode: LiveRequest['mode'] = 'single';
  anchors = false;
  constructor(private video: HTMLVideoElement, private view: () => ViewRect | null, private onResult: (r: LiveResult) => void, private onFail: () => void) {}

  start(): void {
    try { this.worker = new DetectWorker(); } catch { this.onFail(); return; }
    this.worker.onerror = () => { this.stop(); this.onFail(); };
    this.worker.onmessage = (e: MessageEvent<LiveReply>) => {
      if (this.stopped) return;
      if (e.data.error) { this.stop(); this.onFail(); return; }
      const d = e.data;
      this.onResult({ quad: d.quad, fold: d.fold, both: d.both, sure: d.sure, why: d.why, anchor: d.anchor, sharp: d.sharp, t: performance.now(), ms: d.ms });
      this.idle = d.quad ? 0 : Math.min(15, this.idle + 1);
      const gap = Math.min(MAX_IDLE_GAP_MS, MIN_GAP_MS + this.idle * 20);
      this.timer = window.setTimeout(() => this.send(), Math.max(0, gap - d.ms));
    };
    this.send();
  }

  stop(): void { this.stopped = true; clearTimeout(this.timer); this.worker?.terminate(); this.worker = null; }

  private send(): void {
    const v = this.video, view = this.view();
    if (this.stopped || !this.worker) return;
    if (document.hidden) { this.timer = window.setTimeout(() => this.send(), 500); return; }
    if (!v.videoWidth || v.readyState < 2 || !view) { this.timer = window.setTimeout(() => this.send(), 100); return; }
    const k = LONG_SIDE / Math.max(view.sw, view.sh);
    const w = Math.max(32, Math.round(view.sw * k)), h = Math.max(32, Math.round(view.sh * k));
    this.canvas.width = w; this.canvas.height = h;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(v, view.sx, view.sy, view.sw, view.sh, 0, 0, w, h);
    const px = ctx.getImageData(0, 0, w, h);
    this.worker.postMessage({ id: ++this.id, mode: this.mode, anchors: this.anchors, width: w, height: h, data: px.data.buffer } satisfies LiveRequest, [px.data.buffer]);
  }
}
