import { h, openDialog, toast } from '../dom';
import { icon } from './icons';
import { canvasToBlob, normalize } from '../imaging';
import { state, subscribe, type CaptureMode } from '../store';
import type { Pt, Quad } from '../core/geometry';
import { LiveLoop } from '../live/loop';
import { AutoTracker, SPEEDS, type LiveState, type Speed } from '../live/tracker';

const AUTO_KEY = 'pdf-scanner.auto', SPEED_KEY = 'pdf-scanner.autospeed';
const readPref = (k: string): string | null => { try { return localStorage.getItem(k); } catch { return null; } };
const writePref = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode: the choice just isn't remembered */ } };
const SPEED_ORDER: Speed[] = ['fast', 'normal', 'careful'];

export interface CameraOptions {
  /** Current Single page / Book spread mode and a way to change it from the camera screen. */
  mode?: { get: () => CaptureMode; set: (m: CaptureMode) => void };
  /** One shot only (a retake): the camera closes after it. */
  single?: boolean;
}

/**
 * Live in-page camera. `onShot` receives each captured JPEG. If the browser blocks the camera the dialog says why
 * and the user can still use "Take photo" (the phone's own camera app) or import images.
 */
export function openCamera(onShot: (blob: Blob, meta: { foldOnGuide: boolean }) => Promise<void>, fallback: () => void, opts: CameraOptions = {}): void {
  let stream: MediaStream | null = null;
  let shots = 0;
  const video = h('video', { autoplay: true, playsinline: true, muted: true, 'aria-label': 'Camera preview' });
  const msg = h('div', { class: 'msg', hidden: true, role: 'alert' });
  const shutter = h('button', { class: 'shutter', 'aria-label': 'Capture page', disabled: true });
  const done = h('button', { class: 'btn' }, 'Done');
  const last = h('img', { class: 'last-shot', alt: '', hidden: true });
  const flash = h('div', { class: 'flash', 'aria-hidden': 'true' });
  let lastUrl = '';
  let busy = false;
  let capturePage: () => Promise<void> = async () => undefined;
  const guide = h('div', { class: 'guide', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'));
  const hint = h('div', { class: 'cam-hint', role: 'status' });
  const count = h('span', { class: 'shot-count' });
  const overlay = h('canvas', { class: 'live-overlay', 'aria-hidden': 'true' });
  let auto = readPref(AUTO_KEY) !== 'off';
  let speed: Speed = (SPEED_ORDER as string[]).includes(readPref(SPEED_KEY) ?? '') ? (readPref(SPEED_KEY) as Speed) : 'normal';
  const tracker = new AutoTracker(speed);
  let live: LiveLoop | null = null;
  let liveState: LiveState = 'searching';
  /** Spread mode: 'both' = outline and fold found, 'one' = an outline without a fold (one page, or the fold is hidden). */
  let spreadSeen: 'none' | 'one' | 'both' = 'none';
  const spreadNote = h('div', { class: 'spread-note', role: 'status' });
  const autoBtn = h('button', { class: 'chip auto-toggle', type: 'button', role: 'switch', 'aria-label': 'Auto-capture' }, h('span', { class: 'dot' }), 'Auto');
  const speedBtn = h('button', { class: 'chip auto-speed', type: 'button', 'aria-label': 'Auto-capture speed' });
  const paintAuto = () => {
    autoBtn.setAttribute('aria-checked', String(auto));
    speedBtn.hidden = !auto;
    speedBtn.textContent = SPEEDS[speed].label;
    overlay.hidden = !auto;
    if (!auto) paint();
  };
  const paintCount = () => { const n = state.pages.length; count.textContent = n ? `${n} page${n === 1 ? '' : 's'}` : ''; };
  const paint = () => {
    const m = opts.mode?.get() ?? 'single';
    guide.className = `guide ${m}`;
    const base = opts.single ? 'Retake: fit both pages in the frame' : m === 'spread' ? 'Fit both pages in the frame' : 'Fit the page in the frame';
    const spread = m === 'spread' && !opts.single;
    guide.classList.toggle('fold-live', auto && spread && spreadSeen === 'both');
    hint.classList.toggle('cam-warn', auto && spread && spreadSeen === 'one');
    hint.textContent = !auto ? base
      : liveState === 'cooldown' ? 'Captured. Turn the page'
      : spread && spreadSeen === 'one' ? 'Fold not confirmed. Put the fold on the line, or capture anyway'
      : liveState === 'steady' ? (spread ? 'Both pages found. Hold steady…' : 'Hold steady…')
      : base;
    const a = state.pages.length + 1;
    spreadNote.hidden = !spread;
    spreadNote.textContent = `Spread ${(state.spreads?.length ?? 0) + 1} · will be pages ${a} & ${a + 1}`;
    segs.forEach(([id, b]) => b.setAttribute('aria-checked', String(id === m)));
    if (live) live.mode = m;
  };
  const segs = opts.mode && !opts.single ? (['single', 'spread'] as const).map((id) => [id, h('button', { class: 'chip', role: 'radio', type: 'button', onclick: () => { opts.mode!.set(id); tracker.reset(); paint(); } }, id === 'single' ? 'Single page' : 'Book spread')] as const) : [];
  const modeBar = h('div', { class: 'chips cam-modes', role: 'radiogroup', 'aria-label': 'Capture mode' }, ...segs.map(([, b]) => b));
  const stop = () => stream?.getTracks().forEach((t) => t.stop());
  // Page count and "will be pages N & M" follow the page list, so Undo (or anything else) is reflected here at once.
  const unsubscribe = subscribe(() => { paintCount(); paint(); });

  const dialog = openDialog((close) => {
    done.addEventListener('click', close);
    const capture = async () => {
      if (!video.videoWidth || busy) return;
      busy = true;
      shutter.disabled = true;
      try {
        const c = document.createElement('canvas');
        c.width = video.videoWidth; c.height = video.videoHeight;
        c.getContext('2d')!.drawImage(video, 0, 0);
        const raw = await canvasToBlob(c, 'image/jpeg', 0.95);
        const { blob } = await normalize(raw);
        await onShot(blob, { foldOnGuide: opts.mode?.get() === 'spread' && !opts.single });
        shots++;
        done.textContent = `Done (${shots})`;
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = URL.createObjectURL(blob);
        last.src = lastUrl; last.alt = `Last captured page (page ${shots} of this session)`; last.hidden = false;
        paintCount();
        flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
        if (opts.mode?.get() !== 'spread' || opts.single) toast(`Page ${shots} saved. Take the next one, or tap Done.`);
        paint();
        if (opts.single) dialog.close();
      } catch { toast('Could not capture the photo. Please try again.'); }
      finally { busy = false; shutter.disabled = false; }
    };
    capturePage = capture;
    shutter.addEventListener('click', capture);
    autoBtn.addEventListener('click', () => {
      auto = !auto; writePref(AUTO_KEY, auto ? 'on' : 'off');
      tracker.reset(); liveState = 'searching'; drawQuad(null, 'searching', 0); paintAuto(); paint(); startLive();
    });
    speedBtn.addEventListener('click', () => {
      speed = SPEED_ORDER[(SPEED_ORDER.indexOf(speed) + 1) % SPEED_ORDER.length];
      tracker.speed = speed; writePref(SPEED_KEY, speed); paintAuto();
    });
    paintAuto();
    paint();
    paintCount();
    return h('div', { class: 'camera' }, video, overlay, guide, flash,
      h('div', { class: 'cam-top' }, h('button', { class: 'cam-close', type: 'button', 'aria-label': 'Close', onclick: close }, icon('close', 20)), modeBar),
      h('div', { class: 'cam-auto' }, autoBtn, speedBtn),
      hint, spreadNote, msg,
      h('div', { class: 'controls' }, h('div', { class: 'shots' }, last, count), shutter, done));
  }, 'Camera', () => { unsubscribe(); live?.stop(); stop(); if (lastUrl) URL.revokeObjectURL(lastUrl); });
  dialog.classList.add('full');

  /** The video is letterboxed (object-fit: contain), so map frame coordinates onto the visible picture. */
  const drawQuad = (q: Quad | null, st: LiveState, progress: number, fold?: [Pt, Pt], spread?: 'one' | 'both') => {
    const dpr = window.devicePixelRatio || 1;
    const cw = overlay.clientWidth, ch = overlay.clientHeight;
    if (overlay.width !== Math.round(cw * dpr) || overlay.height !== Math.round(ch * dpr)) { overlay.width = Math.round(cw * dpr); overlay.height = Math.round(ch * dpr); }
    const g = overlay.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cw, ch);
    if (!q || !video.videoWidth) return;
    const vb = video.getBoundingClientRect(), ob = overlay.getBoundingClientRect();
    const k = Math.min(vb.width / video.videoWidth, vb.height / video.videoHeight);
    const ox = vb.left - ob.left + (vb.width - video.videoWidth * k) / 2, oy = vb.top - ob.top + (vb.height - video.videoHeight * k) / 2;
    const pt = (p: { x: number; y: number }) => [ox + p.x * video.videoWidth * k, oy + p.y * video.videoHeight * k] as const;
    g.beginPath();
    q.forEach((p, i) => { const [x, y] = pt(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.closePath();
    const col = spread === 'one' ? '255,204,0' : spread === 'both' || st === 'cooldown' ? '52,199,89' : st === 'steady' ? '255,204,0' : '255,255,255';
    g.fillStyle = `rgba(${col},${st === 'cooldown' ? 0.28 : 0.14 + 0.16 * progress})`; g.fill();
    g.lineWidth = 3; g.strokeStyle = `rgba(${col},0.95)`; g.lineJoin = 'round'; g.stroke();
    if (fold) {
      // Dark core with white edges, so the fold line stays visible on bright pages and dark desks alike.
      const [a, b] = fold.map(pt);
      const line = (w: number, c: string) => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineWidth = w; g.strokeStyle = c; g.lineCap = 'butt'; g.stroke(); };
      line(10, '#fff'); line(6, '#0b0c10');
      for (const [x, y] of [a, b]) { g.beginPath(); g.arc(x, y, 11, 0, 7); g.fillStyle = spread === 'one' ? '#ffcc00' : '#34c759'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); }
    }
  };
  const startLive = () => {
    live?.stop(); live = null;
    if (!auto || !stream) { drawQuad(null, 'searching', 0); return; }
    live = new LiveLoop(video, (r) => {
      const spread = live!.mode === 'spread' && !opts.single;
      const seen = !spread ? 'none' : !r.quad ? 'none' : r.both ? 'both' : 'one';
      // A spread only counts (and only auto-captures) once the fold is found; an outline alone is one page.
      const res = tracker.push({ t: r.t, quad: spread && seen !== 'both' ? null : r.quad, sharp: r.sharp });
      if (res.state !== liveState || seen !== spreadSeen) { liveState = res.state; spreadSeen = seen; paint(); }
      drawQuad(spread ? r.quad : res.quad, res.state, res.progress, spread && seen === 'both' ? r.fold : undefined, spread && seen !== 'none' ? seen : undefined);
      shutter.style.setProperty('--p', String(res.state === 'steady' ? res.progress : 0));
      overlay.dataset.state = res.state;
      if (res.fire) void capturePage();
    }, () => { auto = false; live = null; paintAuto(); toast('Auto-capture is not available on this device. Use the shutter button.'); });
    live.mode = opts.mode?.get() ?? 'single';
    live.start();
  };
  const fail = (text: string) => { msg.hidden = false; msg.textContent = text; shutter.disabled = true;
    msg.append(' ', h('button', { class: 'btn', onclick: () => { dialog.close(); fallback(); } }, 'Use phone camera instead')); };

  if (!navigator.mediaDevices?.getUserMedia) { fail('This browser cannot open the camera here (it needs a secure https page).'); return; }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false })
    .then((s) => {
      stream = s; video.srcObject = s;
      if (!dialog.open) { stop(); return; }
      // The shutter only works once the first frame has arrived (a tap before that would silently do nothing).
      video.addEventListener('loadeddata', () => { shutter.disabled = false; }, { once: true });
      startLive();
    })
    .catch((e: DOMException) => fail(e.name === 'NotAllowedError' ? 'Camera access was denied. Allow it in the browser settings, or use the phone camera.' : 'The camera could not be started.'));
}
