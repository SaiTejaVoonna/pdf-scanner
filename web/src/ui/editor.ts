import { FILTERS, type FilterName } from '../core/filters';
import { cloneQuad, fullQuad, isValidCrop, clamp01, type Pt, type Quad } from '../core/geometry';
import { chips, h, openDialog, toast } from '../dom';
import { decode, detectCorners, renderPage } from '../imaging';
import { blobOf, editPages, type PageModel } from '../store';

const CORNER_NAMES = ['Top left corner', 'Top right corner', 'Bottom right corner', 'Bottom left corner'];

/** Page editor: Crop (draggable, keyboard-adjustable corners, auto-detect) and Enhance (filter, rotate). */
export function openEditor(page: PageModel): void {
  const blob = blobOf(page.id);
  if (!blob) { toast('This page image is missing.'); return; }
  let corners: Quad = cloneQuad(page.corners);
  let rotation = page.rotation;
  let filter: FilterName = page.filter;
  let tab: 'crop' | 'enhance' = 'crop';
  let bitmap: ImageBitmap | null = null;
  let dirty = false;

  const stageInner = h('div', { class: 'stage-inner' });
  const stage = h('div', { class: 'stage' }, stageInner);
  const tools = h('div', { class: 'tools' });
  const cropTab = h('button', { class: 'tab', role: 'tab' }, 'Crop');
  const enhTab = h('button', { class: 'tab', role: 'tab' }, 'Enhance');
  let save!: HTMLButtonElement;
  let dlg!: HTMLDialogElement;

  const body = (close: () => void) => {
    const back = h('button', { class: 'icon-btn', 'aria-label': 'Back', onclick: () => requestClose(close) }, '←');
    save = h('button', { class: 'btn primary', onclick: () => {
      if (!isValidCrop(corners)) { toast('The corners must form a convex shape that covers part of the page.'); return; }
      editPages([page.id], (p) => ({ ...p, corners: cloneQuad(corners), rotation, filter }));
      close();
    } }, 'Save');
    cropTab.onclick = () => setTab('crop');
    enhTab.onclick = () => setTab('enhance');
    return h('div', { class: 'editor' },
      h('div', { class: 'head' }, back, h('h2', {}, 'Edit page'), save),
      h('div', { class: 'tabs', role: 'tablist' }, cropTab, enhTab), stage, tools);
  };
  const requestClose = (close: () => void) => { if (!dirty || confirm('Discard your changes to this page?')) close(); };

  dlg = openDialog(body, 'Edit page', () => bitmap?.close());
  dlg.classList.add('full');
  dlg.addEventListener('cancel', (e) => { if (dirty && !confirm('Discard your changes to this page?')) e.preventDefault(); });

  function setTab(t: 'crop' | 'enhance') {
    if (t === 'enhance' && !isValidCrop(corners)) { toast('Fix the crop corners first.'); return; }
    tab = t; render();
  }

  let screenSeq = 0; // a newer render supersedes an older one still waiting on the image decode
  async function render() {
    cropTab.setAttribute('aria-selected', String(tab === 'crop')); enhTab.setAttribute('aria-selected', String(tab === 'enhance'));
    // Keep the tool row's height while it is rebuilt so the stage is measured at its final size.
    const toolsHeight = tools.offsetHeight;
    stageInner.replaceChildren(); tools.replaceChildren();
    if (toolsHeight) tools.style.minHeight = `${toolsHeight}px`;
    const mine = ++screenSeq;
    if (tab === 'crop') await renderCrop(mine); else await renderEnhance();
    if (mine === screenSeq) tools.style.minHeight = '';
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
    const move = (i: number, p: Pt) => { corners[i] = { x: clamp01(p.x), y: clamp01(p.y) }; dirty = true; draw(); };
    draw();

    const auto = h('button', { class: 'btn', onclick: async () => {
      auto.disabled = true; auto.textContent = 'Detecting…';
      try {
        const q = await detectCorners(blob!);
        if (q) { corners = q; dirty = true; draw(); } else toast('No page edges found. Adjust the corners manually.');
      } finally { auto.disabled = false; auto.textContent = 'Auto-detect'; }
    } }, 'Auto-detect');
    const reset = h('button', { class: 'btn', onclick: () => { corners = fullQuad(); dirty = true; draw(); } }, 'Full image');
    tools.append(h('p', { class: 'hint' }, 'Drag the corners to match the page edges (or use the arrow keys).'), h('div', { class: 'row' }, auto, reset));
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
    const rot = (d: number) => h('button', { class: 'btn', 'aria-label': d > 0 ? 'Rotate right' : 'Rotate left', onclick: () => { rotation = (rotation + d + 360) % 360; dirty = true; void draw(); } }, d > 0 ? '⟳ Rotate right' : '⟲ Rotate left');
    const compare = h('button', { class: 'btn', 'aria-pressed': 'false', onclick: () => {
      showOriginal = !showOriginal; compare.setAttribute('aria-pressed', String(showOriginal)); compare.textContent = showOriginal ? 'Show result' : 'Show original'; void draw();
    } }, showOriginal ? 'Show result' : 'Show original');
    compare.setAttribute('aria-pressed', String(showOriginal));
    tools.append(chips(FILTERS, filter, (id) => { filter = id; showOriginal = false; compare.setAttribute('aria-pressed', 'false'); compare.textContent = 'Show original'; dirty = true; void draw(); }), h('div', { class: 'row' }, rot(-90), rot(90), compare));
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
  void save;
}
