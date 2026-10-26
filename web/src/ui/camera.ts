import { h, openDialog, toast } from '../dom';
import { icon } from './icons';
import { frameToSource } from '../imaging';
import { movePage, removePages, state, subscribe, type CaptureMode, type PageModel } from '../store';
import { thumbUrl } from './thumbs';
import type { Quad } from '../core/geometry';
import { LiveLoop } from '../live/loop';
import { AutoTracker, MIN_SHARP_ABS, type LiveState } from '../live/tracker';
import { getAuto, getSpeed, setAuto } from '../prefs';

export interface CameraOptions {
  /** Current Single page / Book spread mode and a way to change it from the camera screen. */
  mode?: { get: () => CaptureMode; set: (m: CaptureMode) => void };
  /** Opens a page's editor (crop, filter) from the pages sheet. */
  onEditPage?: (p: PageModel) => void | Promise<void>;
  /** Called after the camera screen has closed. */
  onClosed?: () => void;
  /** Offers the photo picker when the camera cannot be used. */
  onImport?: () => void;
  /** One shot only (a retake): the camera closes after it. */
  single?: boolean;
}

/**
 * Live in-page camera. `onShot` receives each captured JPEG. If the browser blocks the camera the dialog says why
 * and the user can still use "Take photo" (the phone's own camera app) or import images.
 */
export function openCamera(onShot: (blob: Blob, meta: { foldOnGuide: boolean; anchored: boolean; w: number; h: number }) => Promise<void>, fallback: () => void, opts: CameraOptions = {}): void {
  let stream: MediaStream | null = null;
  let shots = 0;
  const video = h('video', { autoplay: true, playsinline: true, muted: true, 'aria-label': 'Camera preview' });
  const msg = h('div', { class: 'msg', hidden: true, role: 'alert' });
  const shutter = h('button', { class: 'shutter', 'aria-label': 'Capture page', disabled: true });
  const done = h('button', { class: 'cam-done dk', type: 'button' }, 'Done');
  const last = h('img', { class: 'last-shot', alt: '', hidden: true });
  const flash = h('div', { class: 'flash', 'aria-hidden': 'true' });
  let lastUrl = '';
  let busy = false;
  let capturePage: () => Promise<void> = async () => undefined;
  /** The preview fills the screen (cover), so some of the picture is cropped away: detection, overlays and the saved photo all use only what is visible. */
  const viewRect = () => {
    const vw = video.videoWidth, vh = video.videoHeight, bw = video.clientWidth, bh = video.clientHeight;
    if (!vw || !vh || !bw || !bh) return null;
    const k = Math.max(bw / vw, bh / vh), sw = bw / k, sh = bh / k;
    return { sx: (vw - sw) / 2, sy: (vh - sh) / 2, sw, sh };
  };
  const guide = h('div', { class: 'guide', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'));
  const hint = h('span', { class: 'cam-hint', role: 'status' });
  const pill = h('button', { class: 'cam-pill dk', type: 'button', role: 'switch', 'aria-label': 'Auto-capture', title: 'Tap to turn auto-capture on or off' }, h('span', { class: 'dot' }), hint);
  const count = h('span', { class: 'shot-count' });
  const overlay = h('canvas', { class: 'live-overlay', 'aria-hidden': 'true' });
  let auto = getAuto();
  const speed = getSpeed();
  const tracker = new AutoTracker(speed);
  let live: LiveLoop | null = null;
  let liveState: LiveState = 'searching';
  /** Spread mode: 'both' = outline and fold found, 'one' = an outline without a fold (one page, or the fold is hidden). */
  let spreadSeen: 'none' | 'one' | 'both' = 'none';
  const spreadNote = h('div', { class: 'spread-note', role: 'status' });
  /** What the last live frame said about a found outline that is not a sure page. */
  let unsure: 'dark' | 'plain' | 'blank' | null = null;
  const paintAuto = () => {
    pill.setAttribute('aria-checked', String(auto));
    if (!auto) paint();
  };
  const paintCount = () => { const n = state.pages.length; count.textContent = n ? String(n) : ''; count.hidden = !n; };
  const paint = () => {
    const m = opts.mode?.get() ?? 'single';
    guide.className = `guide ${m}`;
    const base = opts.single ? 'Retake: fit both pages in the frame' : m === 'spread' ? 'Fit both pages in the frame' : 'Fit the page in the frame';
    const spread = m === 'spread' && !opts.single;
    // The fold bar never moves: it only changes colour (green = both pages and fold confirmed, amber = not confirmed).
    guide.classList.toggle('fold-ok', auto && spread && spreadSeen === 'both');
    guide.classList.toggle('fold-warn', auto && spread && spreadSeen === 'one');
    const why = unsure === 'dark' ? 'Too dark. Add light' : unsure === 'blank' ? 'Blank page? Tap the shutter' : null;
    let text = base, warn = false;
    if (auto) {
      if (liveState === 'cooldown') text = 'Captured. Turn the page';
      else if (spread && spreadSeen === 'one') { text = 'Line up the fold'; warn = true; }
      else if (why) { text = why; warn = true; }
      else if (liveState === 'steady') text = 'Hold steady';
    }
    hint.textContent = text;
    pill.dataset.tone = warn ? 'warn' : auto && (liveState === 'steady' || liveState === 'cooldown') ? 'ok' : 'idle';
    const a = state.pages.length + 1;
    spreadNote.hidden = !spread;
    spreadNote.textContent = `Spread ${(state.spreads?.length ?? 0) + 1} · will be pages ${a} & ${a + 1}`;
    segs.forEach(([id, b]) => b.setAttribute('aria-checked', String(id === m)));
    if (live) live.mode = m;
  };
  const segs = opts.mode && !opts.single ? (['single', 'spread'] as const).map((id) => [id, h('button', { role: 'radio', type: 'button', 'aria-label': id === 'single' ? 'Single page' : 'Book spread', onclick: () => { opts.mode!.set(id); tracker.reset(); unsure = null; paint(); paintAuto(); if (live) live.mode = id; redraw(); } }, icon(id, 20))] as const) : [];
  const modeBar = h('div', { class: 'cam-seg dk', role: 'radiogroup', 'aria-label': 'Capture mode' }, ...segs.map(([, b]) => b));
  const flashBtn = h('button', { class: 'cam-circle dk', type: 'button', 'aria-label': 'Flashlight', 'aria-pressed': 'false', hidden: true }, icon('bolt', 20));
  let torchOn = false;
  flashBtn.addEventListener('click', async () => {
    const t = stream?.getVideoTracks()[0];
    if (!t) return;
    try { torchOn = !torchOn; await t.applyConstraints({ advanced: [{ torch: torchOn } as MediaTrackConstraintSet] }); flashBtn.setAttribute('aria-pressed', String(torchOn)); }
    catch { torchOn = false; flashBtn.setAttribute('aria-pressed', 'false'); toast('The flashlight is not available on this camera.'); }
  });
  const stop = () => stream?.getTracks().forEach((t) => t.stop());
  // Page count and "will be pages N & M" follow the page list, so Undo (or anything else) is reflected here at once.
  const unsubscribe = subscribe(() => { paintCount(); paint(); paintSheet(); });

  const pagesBtn = h('button', { class: 'shots', type: 'button', 'aria-label': 'Show my pages', onclick: () => toggleSheet(true) }, last, count);
  const sheet = h('div', { class: 'pages-sheet', hidden: true, role: 'region', 'aria-label': 'Your pages' });
  let sheetOpen = false;
  const paintSheet = () => {
    sheet.hidden = !sheetOpen;
    if (!sheetOpen) return;
    const pages = state.pages;
    sheet.replaceChildren(
      h('div', { class: 'ps-head' }, h('b', {}, 'Your pages'), h('span', { class: 'ps-count' }, `${pages.length} total`), h('button', { class: 'btn', type: 'button', onclick: () => toggleSheet(false) }, 'Close')),
      pages.length === 0 ? h('p', { class: 'ps-empty' }, 'No pages yet.') :
      h('ul', { class: 'ps-grid' }, ...pages.map((p, i) => {
        const img = h('img', { alt: `Page ${i + 1}`, draggable: 'false' });
        thumbUrl(p).then((u) => { img.src = u; }).catch(() => undefined);
        return h('li', { class: 'ps-card' },
          h('button', { class: 'ps-thumb', type: 'button', 'aria-label': `Edit page ${i + 1}`, onclick: () => void opts.onEditPage?.(p) }, img),
          h('span', { class: 'ps-n' }, String(i + 1)),
          h('button', { class: 'ps-del', type: 'button', 'aria-label': `Delete page ${i + 1}`, onclick: () => removePages([p.id]) }, icon('minus', 14)),
          h('div', { class: 'ps-move' },
            h('button', { type: 'button', 'aria-label': `Move page ${i + 1} earlier`, disabled: i === 0, onclick: () => movePage(p.id, -1) }, '‹'),
            h('button', { type: 'button', 'aria-label': `Move page ${i + 1} later`, disabled: i === pages.length - 1, onclick: () => movePage(p.id, 1) }, '›')));
      })));
  };
  const toggleSheet = (open: boolean) => { sheetOpen = open; paintSheet(); };

  const dialog = openDialog((close) => {
    done.addEventListener('click', close);
    const capture = async () => {
      if (!video.videoWidth || busy) return;
      busy = true;
      shutter.disabled = true;
      try {
        const v = viewRect() ?? { sx: 0, sy: 0, sw: video.videoWidth, sh: video.videoHeight };
        const { blob, w, h: ph, sharp } = await frameToSource(video, v);
        const before = state.pages.length;
        await onShot(blob, { foldOnGuide: opts.mode?.get() === 'spread' && !opts.single, anchored: false, w, h: ph });
        shots++;
        done.textContent = `Done · ${shots}`;
        if (lastUrl) URL.revokeObjectURL(lastUrl);
        lastUrl = URL.createObjectURL(blob);
        last.src = lastUrl; last.alt = `Last captured page (page ${shots} of this session)`; last.hidden = false;
        paintCount();
        flash.classList.remove('go'); void flash.offsetWidth; flash.classList.add('go');
        const added = state.pages.slice(before).map((p) => p.id);
        if (sharp < MIN_SHARP_ABS && added.length) toast('That photo looks blurry.', { label: 'Remove', run: () => removePages(added) });
        else if (opts.mode?.get() !== 'spread' || opts.single) toast(`Page ${shots} saved.`);
        paint();
        if (opts.single) dialog.close();
      } catch { toast('Capture failed. Try again.'); }
      finally { busy = false; shutter.disabled = false; }
    };
    capturePage = capture;
    shutter.addEventListener('click', capture);
    pill.addEventListener('click', () => {
      auto = !auto; setAuto(auto);
      tracker.reset(); liveState = 'searching'; drawQuad(null, 'searching', 0); paintAuto(); paint(); startLive();
    });
    paintAuto();
    paint();
    paintCount();
    return h('div', { class: 'camera' },
      h('div', { class: 'cam-stage' }, video, overlay, guide, flash),
      h('div', { class: 'cam-top' }, h('button', { class: 'cam-circle dk', type: 'button', 'aria-label': 'Close', onclick: close }, icon('close', 20)), modeBar, flashBtn),
      h('div', { class: 'cam-status' }, pill, spreadNote),
      msg, sheet,
      h('div', { class: 'controls' }, pagesBtn, shutter, done));
  }, 'Camera', () => { unsubscribe(); live?.stop(); stop(); if (lastUrl) URL.revokeObjectURL(lastUrl); opts.onClosed?.(); });
  dialog.classList.add('full');

  /** The video is letterboxed (object-fit: contain), so map frame coordinates onto the visible picture. */
  type Tone = 'sure' | 'unsure';
  const drawQuad = (q: Quad | null, st: LiveState, progress: number, tone?: Tone) => {
    const dpr = window.devicePixelRatio || 1;
    const cw = overlay.clientWidth, ch = overlay.clientHeight;
    if (overlay.width !== Math.round(cw * dpr) || overlay.height !== Math.round(ch * dpr)) { overlay.width = Math.round(cw * dpr); overlay.height = Math.round(ch * dpr); }
    const g = overlay.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, cw, ch);
    if (!video.videoWidth) return;
    // The overlay covers the same box as the (cover-fitted) preview, so normalized coordinates map straight onto it.
    const pt = (p: { x: number; y: number }) => [p.x * cw, p.y * ch] as const;
    if (!q) return;
    g.beginPath();
    q.forEach((p, i) => { const [x, y] = pt(p); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.closePath();
    const col = tone === 'unsure' ? '255,204,0' : tone === 'sure' || st === 'cooldown' ? '52,199,89' : '255,255,255';
    g.fillStyle = `rgba(${col},${st === 'cooldown' ? 0.28 : 0.14 + 0.16 * progress})`; g.fill();
    g.lineWidth = 3; g.strokeStyle = `rgba(${col},0.95)`; g.lineJoin = 'round'; g.stroke();
  };
  const redraw = () => drawQuad(null, 'searching', 0);
  const startLive = () => {
    live?.stop(); live = null;
    unsure = null;
    if (!auto || !stream) { redraw(); return; }
    live = new LiveLoop(video, viewRect, (r) => {
      const spread = live!.mode === 'spread' && !opts.single;
      const seen = !spread ? 'none' : !r.quad ? 'none' : r.both ? 'both' : 'one';
      // Only a real page may auto-capture: a spread also needs its fold confirmed, and any outline must look like a page (not a floor).
      const sure = !!r.quad && r.sure && (!spread || seen === 'both');
      // While the pages sheet or another screen is open on top of the camera, nothing may be captured behind it.
      const covered = sheetOpen || [...document.querySelectorAll('dialog[open]')].pop() !== dialog;
      const res = tracker.push({ t: r.t, quad: sure && !covered ? r.quad : null, sharp: r.sharp });
      const nextUnsure = r.quad && !r.sure && !(spread && seen === 'one') ? r.why : !r.quad && r.why === 'dark' ? 'dark' : null;
      if (res.state !== liveState || seen !== spreadSeen || nextUnsure !== unsure) { liveState = res.state; spreadSeen = seen; unsure = nextUnsure; paint(); }
      drawQuad(r.quad, res.state, res.progress, !r.quad ? undefined : sure ? 'sure' : 'unsure');
      shutter.style.setProperty('--p', String(res.state === 'steady' ? res.progress : 0));
      overlay.dataset.state = res.state;
      if (res.fire) void capturePage();
    }, () => { auto = false; live = null; paintAuto(); toast('Auto-capture is not available here.'); });
    live.mode = opts.mode?.get() ?? 'single';
    live.anchors = false;
    live.start();
  };
  const fail = (text: string) => {
    msg.hidden = false; msg.classList.add('blocked'); shutter.disabled = true;
    msg.replaceChildren(h('span', { class: 'cam-circle dk big', 'aria-hidden': 'true' }, icon('camera', 34)), h('strong', {}, 'Camera is blocked'), h('p', {}, text),
      h('button', { class: 'btn primary', type: 'button', onclick: () => { dialog.close(); fallback(); } }, 'Use phone camera instead'));
    if (opts.onImport) msg.append(h('button', { class: 'btn', type: 'button', onclick: () => { dialog.close(); opts.onImport!(); } }, 'Import photos'));
  };

  if (!navigator.mediaDevices?.getUserMedia) { fail('The camera needs a secure (https) page.'); return; }
  const startStream = () => navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false })
    .then((s) => {
      stream?.getTracks().forEach((t) => t.stop());
      stream = s; video.srcObject = s;
      if (!dialog.open) { stop(); return; }
      // The shutter only works once the first frame has arrived (a tap before that would silently do nothing).
      video.addEventListener('loadeddata', () => { shutter.disabled = false; }, { once: true });
      const caps = s.getVideoTracks()[0]?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      flashBtn.hidden = !caps?.torch;
      startLive();
    })
    .catch((e: DOMException) => fail(e.name === 'NotAllowedError' ? 'Camera access was denied. Allow it in your browser settings.' : 'The camera could not be started.'));
  // Switching to another app can stop the camera; when the person comes back, the preview is started again instead of staying frozen.
  const onVisible = () => {
    if (document.visibilityState !== 'visible' || !dialog.open || !stream) return;
    const t = stream.getVideoTracks()[0];
    if (!t || t.readyState !== 'live') { shutter.disabled = true; void startStream(); }
    else if (video.paused) void video.play().catch(() => undefined);
  };
  document.addEventListener('visibilitychange', onVisible);
  dialog.addEventListener('close', () => document.removeEventListener('visibilitychange', onVisible));
  void startStream();
}
