import { FILTERS, type FilterName } from '../core/filters';
import { cloneQuad, fullQuad, isValidCrop, clamp01, type Pt, type Quad } from '../core/geometry';
import { askConfirm, h, openDialog, toast } from '../dom';
import { findCorners } from '../engine';
import { decode, renderPage } from '../imaging';
import { icon, type IconName } from './icons';
import { blobOf, clearDraft, editPages, saveDraft, state, type PageModel } from '../store';

export interface PageDraftData { corners: Quad; rotation: number; filter: FilterName }

const CORNER_NAMES = ['Top left corner', 'Top right corner', 'Bottom right corner', 'Bottom left corner'];

/** Page editor: Crop (draggable, keyboard-adjustable corners, auto-detect) and Enhance (filter, rotate). */
export function openEditor(page: PageModel, resume?: PageDraftData): void {
  const blob = blobOf(page.id);
  if (!blob) { toast('Page image is missing.'); return; }
  let corners: Quad = cloneQuad(resume?.corners ?? page.corners);
  let rotation = resume?.rotation ?? page.rotation;
  let filter: FilterName = resume?.filter ?? page.filter;
  let tab: 'crop' | 'enhance' = 'crop';  // 'crop' = move the corners on the photo, 'enhance' = look at the corrected page
  let bitmap: ImageBitmap | null = null;
  let dirty = !!resume;
  let saved = false;
  let draftTimer: number | undefined;
  const flush = () => { window.clearTimeout(draftTimer); if (dirty && !saved) saveDraft({ kind: 'page', id: page.id, data: { corners, rotation, filter } satisfies PageDraftData }); };
  /** Marks unsaved edits and remembers them, so a reload or an app update does not lose them. */
  const touch = () => { dirty = true; window.clearTimeout(draftTimer); draftTimer = window.setTimeout(flush, 400); };

  const stageInner = h('div', { class: 'stage-inner' });
  const stage = h('div', { class: 'stage' }, stageInner);
  const tools = h('div', { class: 'tools4' });
  const filterRow = h('div', { class: 'flt', role: 'radiogroup', 'aria-label': 'Look' });
  const overlayBtns = h('div', { class: 'stage-actions' });
  let save!: HTMLButtonElement;
  let dlg!: HTMLDialogElement;
  const index = Math.max(0, state.pages.findIndex((p) => p.id === page.id)) + 1;

  const body = (close: () => void) => {
    save = h('button', { class: 'txt-btn strong', type: 'button', onclick: () => {
      if (!isValidCrop(corners)) { toast('Corners must form a four-sided shape.'); return; }
      editPages([page.id], (p) => ({ ...p, corners: cloneQuad(corners), rotation, filter, check: undefined }));
      saved = true; clearDraft();
      close();
    } }, 'Save');
    return h('div', { class: 'editor' },
      h('div', { class: 'nav' }, h('button', { class: 'txt-btn', type: 'button', 'aria-label': 'Back', onclick: () => requestClose(close) }, 'Cancel'), h('div', { class: 'titles' }, h('h2', { class: 'ttl' }, `Edit page ${index}`)), save),
      stage, h('div', { class: 'bottomtools' }, tools, filterRow));
  };
  const discard = () => askConfirm('Discard your changes?', 'Your edits to this page have not been saved.', 'Discard');
  const requestClose = async (close: () => void) => { if (!dirty || await discard()) close(); };

  window.addEventListener('app-flush-drafts', flush);
  dlg = openDialog(body, 'Edit page', () => { bitmap?.close(); window.removeEventListener('app-flush-drafts', flush); window.clearTimeout(draftTimer); if (!saved) clearDraft(); });
  dlg.classList.add('full');
  dlg.addEventListener('cancel', (e) => { if (dirty) { e.preventDefault(); void discard().then((yes) => { if (yes) dlg.close(); }); } });

  function setTab(t: 'crop' | 'enhance') {
    if (t === 'enhance' && !isValidCrop(corners)) { toast('Fix the crop corners first.'); return; }
    tab = t; render();
  }

  let screenSeq = 0; // a newer render supersedes an older one still waiting on the image decode
  /** The tool is the current mode (`on`, filled) or has just been applied (`done`, outlined with a tick). */
  const toolBtn = (ic: IconName, label: string, aria: string, on: boolean, run: () => void, done = false) =>
    h('button', { type: 'button', class: on ? 'on' : done ? 'done' : '', 'aria-label': aria, 'aria-pressed': String(on || done), onclick: run }, h('i', {}, icon(done ? 'check' : ic, 22)), label);
  function paintTools() {
    tools.replaceChildren(
      toolBtn('crop', 'Crop', 'Crop', tab === 'crop', () => setTab('crop')),
      toolBtn('rotate', 'Rotate', 'Rotate right', false, () => { rotation = (rotation + 90) % 360; touch(); if (tab !== 'enhance') setTab('enhance'); else { void drawResult?.(); } paintThumbs(); }),
      toolBtn('wand', autoBusy ? 'Auto…' : 'Auto', 'Auto-detect', false, async () => {
        if (autoBusy) return;
        autoBusy = true; paintTools();
        try {
          const f = await findCorners(blob!);
          if (f.quad) { corners = f.quad; autoDone = true; touch(); if (tab === 'crop') redrawCorners?.(); else void drawResult?.(); paintThumbs(); if (f.confidence !== 'high') toast('Check the corners.'); } else toast('No page found. Move the corners.');
        } catch { toast('Auto-detect failed. Move the corners.'); }
        finally { autoBusy = false; paintTools(); }
      }, autoDone),
      toolBtn('tune', 'Look', 'Look', tab === 'enhance', () => setTab('enhance')));
  }
  let autoDone = false, autoBusy = false; // Auto stays marked until the corners are moved by hand
  let redrawCorners: (() => void) | null = null;
  let drawResult: (() => Promise<void>) | null = null;
  const thumbToken = { n: 0 };
  async function paintThumbs() {
    const mine = ++thumbToken.n;
    filterRow.replaceChildren(...FILTERS.map((f) => {
      const t = h('div', { class: 't' });
      const b = h('button', { type: 'button', class: f.id === filter ? 'on' : '', role: 'radio', 'aria-checked': String(f.id === filter), 'aria-label': f.label,
        onclick: () => { filter = f.id; showOriginal = false; touch(); filterRow.querySelectorAll('button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', String(x === b)); }); if (tab === 'enhance') void drawResult?.(); else setTab('enhance'); } }, t, h('span', {}, f.label));
      if (isValidCrop(corners)) renderPage({ ...page, corners, rotation, filter: f.id }, 120).then((c) => { if (mine !== thumbToken.n) return; c.style.width = '100%'; c.style.height = '100%'; c.style.objectFit = 'cover'; t.replaceChildren(c); }).catch(() => undefined);
      return b;
    }));
  }
  async function render() {
    const mine = ++screenSeq;
    // A relayout rebuilds the handles; keep keyboard focus on the same one.
    const focusedLabel = stageInner.contains(document.activeElement) ? (document.activeElement as HTMLElement).getAttribute('aria-label') : null;
    stageInner.replaceChildren(); overlayBtns.replaceChildren();
    paintTools();
    if (tab === 'crop') await renderCrop(mine); else await renderEnhance();
    if (focusedLabel && mine === screenSeq) [...stageInner.querySelectorAll<HTMLElement>('[aria-label]')].find((e) => e.getAttribute('aria-label') === focusedLabel)?.focus();
  }

  const fit = () => {
    const maxW = stage.clientWidth - 24, maxH = stage.clientHeight - 24;
    return { maxW: Math.max(100, maxW), maxH: Math.max(100, maxH) };
  };

  async function renderCrop(mine: number) {
    bitmap ??= await decode(blob!);
    if (mine !== screenSeq) return;
    const { maxW, maxH } = fit();
    fitted = { w: maxW, h: maxH };
    const s = Math.min(maxW / bitmap.width, maxH / bitmap.height);
    const w = Math.round(bitmap.width * s), h2 = Math.round(bitmap.height * s);
    const c = document.createElement('canvas'); c.width = w; c.height = h2;
    c.getContext('2d')!.drawImage(bitmap, 0, 0, w, h2);
    c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Page photo with crop outline');
    const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlay.setAttribute('class', 'overlay'); overlay.setAttribute('width', String(w)); overlay.setAttribute('height', String(h2));
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    poly.setAttribute('fill-rule', 'evenodd'); poly.setAttribute('fill', 'rgba(0,0,0,.45)'); poly.setAttribute('stroke', '#fff'); poly.setAttribute('stroke-width', '2');
    overlay.append(poly);
    stageInner.style.width = `${w}px`; stageInner.style.height = `${h2}px`;
    stageInner.append(c, overlay);

    const handles = corners.map((_, i) => {
      const el = h('button', { class: 'handle', type: 'button', 'aria-label': `${CORNER_NAMES[i]}. Use arrow keys to move.` });
      let dragging = false;
      el.addEventListener('pointerdown', (e) => { dragging = true; el.setPointerCapture(e.pointerId); e.preventDefault(); });
      el.addEventListener('pointerup', () => { dragging = false; });
      el.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const r = stageInner.getBoundingClientRect();
        move(i, { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
      });
      el.addEventListener('keydown', (e) => {
        const step = e.shiftKey ? 0.05 : 0.01;
        const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (d[e.key]) { e.preventDefault(); move(i, { x: corners[i].x + d[e.key][0], y: corners[i].y + d[e.key][1] }); }
      });
      stageInner.append(el);
      return el;
    });
    const draw = () => {
      const pts = corners.map((p) => `${p.x * w},${p.y * h2}`);
      poly.setAttribute('d', `M0,0H${w}V${h2}H0Z M${pts.join(' L')}Z`);
      handles.forEach((el, i) => { el.style.left = `${corners[i].x * w}px`; el.style.top = `${corners[i].y * h2}px`; });
    };
    const move = (i: number, p: Pt) => { corners[i] = { x: clamp01(p.x), y: clamp01(p.y) }; touch(); draw(); if (autoDone) { autoDone = false; paintTools(); } };
    draw();

    redrawCorners = draw;
    stage.append(overlayBtns);
    overlayBtns.replaceChildren(h('button', { class: 'pill-btn', type: 'button', onclick: () => { corners = fullQuad(); autoDone = false; paintTools(); touch(); draw(); void paintThumbs(); } }, 'Full image'));
  }

  let renderToken = 0;
  let showOriginal = false;
  async function renderEnhance() {
    const preview = h('div', { class: 'hint' }, 'Rendering…');
    stageInner.style.width = ''; stageInner.style.height = '';
    stageInner.append(preview);
    const draw = async () => {
      const token = ++renderToken;
      const { maxW, maxH } = fit();
      const shown = showOriginal ? { ...page, corners: fullQuad(), rotation: 0, filter: 'original' as FilterName } : { ...page, corners, rotation, filter };
      const canvas = await renderPage(shown, Math.round(Math.max(maxW, maxH) * (window.devicePixelRatio || 1)));
      if (token !== renderToken || tab !== 'enhance') return;
      canvas.style.maxWidth = `${maxW}px`; canvas.style.maxHeight = `${maxH}px`;
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', showOriginal ? 'Original photo' : 'Preview of the corrected page');
      stageInner.replaceChildren(canvas);
    };
    const compare = h('button', { class: 'pill-btn', type: 'button', 'aria-pressed': String(showOriginal), onclick: () => {
      showOriginal = !showOriginal; compare.setAttribute('aria-pressed', String(showOriginal)); compare.textContent = showOriginal ? 'Show result' : 'Show original'; void draw();
    } }, showOriginal ? 'Show result' : 'Show original');
    drawResult = draw;
    stage.append(overlayBtns);
    overlayBtns.replaceChildren(compare);
    await draw();
  }

  // The stage shrinks when the tool row below it fills in or a phone toolbar appears; refit so no corner is clipped.
  let fitted = { w: 0, h: 0 };
  const watch = new ResizeObserver(() => {
    const now = fit();
    if (tab !== 'crop' || (Math.abs(now.maxW - fitted.w) < 3 && Math.abs(now.maxH - fitted.h) < 3)) return;
    void render();
  });
  watch.observe(stage);
  dlg.addEventListener('close', () => watch.disconnect());
  void render();
  void paintThumbs();
  void save;
}
