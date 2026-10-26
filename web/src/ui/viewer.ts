import { h, openDialog, toast } from '../dom';
import { canvasToBlob, renderPage } from '../imaging';
import { state, type PageModel } from '../store';
import { openEditor } from './editor';
import { icon } from './icons';

const ZOOMS = [1, 1.5, 2, 3, 4];

/** Full-screen preview of the pages exactly as they will be exported: swipe or use arrows to page, zoom to read small text. */
export function openViewer(startId: string): void {
  let index = Math.max(0, state.pages.findIndex((p) => p.id === startId));
  let zoom = 0;
  let token = 0;
  const urls: string[] = [];

  const img = h('img', { class: 'viewer-img', alt: '', draggable: 'false' });
  const scroller = h('div', { class: 'viewer-scroll', tabindex: '0' }, img);
  const counter = h('span', { class: 'viewer-count', role: 'status' });
  const prev = h('button', { class: 'icon-btn', 'aria-label': 'Previous page', onclick: () => go(-1) }, icon('chevron-left'));
  const next = h('button', { class: 'icon-btn', 'aria-label': 'Next page', onclick: () => go(1) }, icon('chevron-right'));
  const zoomOut = h('button', { class: 'icon-btn', 'aria-label': 'Zoom out', onclick: () => setZoom(zoom - 1) }, icon('minus'));
  const zoomIn = h('button', { class: 'icon-btn', 'aria-label': 'Zoom in', onclick: () => setZoom(zoom + 1) }, icon('plus'));
  const zoomLabel = h('span', { class: 'viewer-zoom' });

  const page = (): PageModel | undefined => state.pages[index];

  async function show() {
    const p = page();
    if (!p) return;
    const mine = ++token;
    counter.textContent = `Page ${index + 1} of ${state.pages.length}`;
    prev.disabled = index === 0; next.disabled = index >= state.pages.length - 1;
    img.alt = `Page ${index + 1} of ${state.pages.length}`;
    try {
      const url = URL.createObjectURL(await canvasToBlob(await renderPage(p, 2400), 'image/jpeg', 0.9));
      if (mine !== token) { URL.revokeObjectURL(url); return; }
      urls.push(url); img.src = url; scroller.scrollTo(0, 0);
    } catch { if (mine === token) toast('Could not show this page.'); }
  }
  function go(d: number) {
    const n = index + d;
    if (n < 0 || n >= state.pages.length) return;
    index = n; void show();
  }
  function setZoom(z: number) {
    zoom = Math.min(ZOOMS.length - 1, Math.max(0, z));
    img.style.width = zoom === 0 ? 'auto' : `${ZOOMS[zoom] * 100}%`;
    img.style.maxWidth = zoom === 0 ? '100%' : 'none';
    img.style.maxHeight = zoom === 0 ? '100%' : 'none';
    zoomLabel.textContent = `${Math.round(ZOOMS[zoom] * 100)}%`;
    zoomOut.disabled = zoom === 0; zoomIn.disabled = zoom === ZOOMS.length - 1;
    scroller.classList.toggle('zoomed', zoom > 0);
  }

  const dlg = openDialog((close) => h('div', { class: 'editor viewer' },
    h('div', { class: 'nav' }, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close preview', onclick: close }, icon('chevron-left', 26)), h('div', { class: 'titles' }, h('h2', { class: 'ttl' }, 'Preview')),
      h('button', { class: 'txt-btn', type: 'button', onclick: () => { const p = page(); if (p) { close(); openEditor(p); } } }, 'Edit this page')),
    scroller,
    h('div', { class: 'bottomtools viewer-bar' }, prev, counter, next, h('span', { class: 'spacer' }), zoomOut, zoomLabel, zoomIn)), 'Preview',
  () => { urls.forEach((u) => URL.revokeObjectURL(u)); document.removeEventListener('keydown', onKey); });
  dlg.classList.add('full');

  // On document, not the dialog: a button that just became disabled (first/last page) loses focus, and keys must keep working.
  const onKey = (e: KeyboardEvent) => {
    if (!dlg.open || dlg !== [...document.querySelectorAll('dialog[open]')].pop()) return;
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === '+' || e.key === '=') setZoom(zoom + 1);
    else if (e.key === '-') setZoom(zoom - 1);
  };
  document.addEventListener('keydown', onKey);
  // Swipe to change page (only when not zoomed, so panning a zoomed page still works).
  let sx = 0, sy = 0;
  scroller.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  scroller.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (zoom === 0 && Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) go(dx < 0 ? 1 : -1);
  });
  setZoom(0);
  void show();
}
