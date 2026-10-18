import { FILTERS, type FilterName } from '../core/filters';
import { fullQuad } from '../core/geometry';
import { h, toast } from '../dom';
import { canvasToBlob, detectCorners, normalize, renderPage } from '../imaging';
import * as store from '../store';
import { state, subscribe, type PageModel } from '../store';
import { openCamera } from './camera';
import { openCombine } from './combineDialog';
import { openEditor } from './editor';
import { openExport } from './exportDialog';
import { openSettings } from './settingsDialog';

declare const __APP_VERSION__: string;

/** Adds image files/blobs as pages, normalising them and (if the setting is on) auto-cropping. */
async function ingest(files: Blob[], source: 'camera' | 'import', names: string[] = []): Promise<void> {
  const auto = source === 'camera' ? state.settings.autoCropCamera : state.settings.autoCropImport;
  let failed = 0;
  for (let i = 0; i < files.length; i++) {
    try {
      const { blob, w, h: ph } = await normalize(files[i]);
      const corners = auto ? (await detectCorners(blob)) ?? fullQuad() : fullQuad();
      store.addPage(blob, w, ph, corners);
    } catch { failed++; if (names[i]) toast(`${names[i]} could not be read as an image.`); }
  }
  if (failed && !names.length) toast(`${failed} image(s) could not be added.`);
}

const thumbs = new Map<string, Promise<string>>();
const thumbKey = (p: PageModel) => `${p.id}|${p.rotation}|${p.filter}|${p.corners.map((c) => `${c.x.toFixed(4)},${c.y.toFixed(4)}`).join(';')}`;
function thumbUrl(p: PageModel): Promise<string> {
  const key = thumbKey(p);
  let hit = thumbs.get(key);
  if (!hit) {
    hit = renderPage(p, 360).then((c) => canvasToBlob(c, 'image/jpeg', 0.8)).then((b) => URL.createObjectURL(b));
    thumbs.set(key, hit);
  }
  return hit;
}

export function mountApp(root: HTMLElement): void {
  const fileInput = (accept: string, multiple: boolean, capture?: string) =>
    h('input', { type: 'file', accept, multiple, capture, class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });
  const importInput = fileInput('image/*', true);
  const captureInput = fileInput('image/*', false, 'environment');
  importInput.addEventListener('change', async () => { const f = Array.from(importInput.files ?? []); importInput.value = ''; await ingest(f, 'import', f.map((x) => x.name)); });
  captureInput.addEventListener('change', async () => { const f = Array.from(captureInput.files ?? []); captureInput.value = ''; await ingest(f, 'camera', f.map((x) => x.name)); });

  const actions = h('div', { class: 'actions' },
    action('📷', 'Scan with camera', () => openCamera((blob) => ingest([blob], 'camera'), () => captureInput.click())),
    action('📸', 'Take photo', () => captureInput.click()),
    action('🖼️', 'Import images', () => importInput.click()),
    action('📑', 'Combine PDFs', () => openCombine()));
  const list = h('ul', { class: 'grid', 'aria-label': 'Pages' });
  const empty = h('div', { class: 'empty' }, h('div', { style: 'font-size:2.5rem' }, '📄'), h('h2', {}, 'No pages yet'),
    h('p', {}, 'Scan with the camera or import images, then export one PDF. Everything stays on this device.'));
  const bar = h('div', { class: 'bar' });
  const notice = h('p', { class: 'notice', hidden: true }, 'Your browser is not keeping scans between visits (private mode?). Export before closing this tab.');

  root.append(
    h('header', { class: 'top' }, h('h1', {}, 'PDF Scanner', h('span', { class: 'beta' }, `beta ${__APP_VERSION__}`)),
      h('button', { class: 'icon-btn', 'aria-label': 'Settings', onclick: openSettings }, '⚙️')),
    h('main', {}, notice, actions, list, empty), bar, importInput, captureInput);

  function render() {
    const pages = state.pages;
    notice.hidden = state.persistent;
    empty.hidden = pages.length > 0;
    list.hidden = pages.length === 0;
    list.replaceChildren(...pages.map((p, i) => card(p, i, pages.length)));
    renderBar();
  }

  function card(p: PageModel, index: number, total: number): HTMLElement {
    const selecting = state.selection.size > 0;
    const selected = state.selection.has(p.id);
    const img = h('img', { alt: `Page ${index + 1} of ${total}`, draggable: 'false' });
    thumbUrl(p).then((url) => { img.src = url; }).catch(() => { img.alt = `Page ${index + 1} (preview unavailable)`; });
    let timer: number | undefined, longPressed = false;
    const thumb = h('button', { class: 'thumb', type: 'button', 'aria-pressed': selecting ? String(selected) : undefined,
      'aria-label': selecting ? `Select page ${index + 1}` : `Edit page ${index + 1}`,
      onclick: () => { if (longPressed) { longPressed = false; return; } selecting ? store.toggleSelect(p.id) : openEditor(p); },
      onpointerdown: () => { longPressed = false; timer = window.setTimeout(() => { longPressed = true; store.toggleSelect(p.id); }, 500); },
      onpointerup: () => clearTimeout(timer), onpointerleave: () => clearTimeout(timer), onpointercancel: () => clearTimeout(timer),
      oncontextmenu: (e: Event) => e.preventDefault() }, img, selecting ? h('span', { class: 'check', 'aria-hidden': 'true' }, selected ? '✓' : '') : null);
    const bar = selecting ? h('div', { class: 'card-bar' }, h('span', {}, `Page ${index + 1}`)) :
      h('div', { class: 'card-bar' }, h('span', {}, `Page ${index + 1}`),
        h('button', { class: 'icon-btn', 'aria-label': `Select page ${index + 1}`, onclick: () => store.toggleSelect(p.id) }, '☐'),
        h('button', { class: 'icon-btn', 'aria-label': `Move page ${index + 1} earlier`, disabled: index === 0, onclick: () => store.movePage(p.id, -1) }, '←'),
        h('button', { class: 'icon-btn', 'aria-label': `Move page ${index + 1} later`, disabled: index === total - 1, onclick: () => store.movePage(p.id, 1) }, '→'),
        h('button', { class: 'icon-btn', 'aria-label': `Delete page ${index + 1}`, onclick: () => { if (confirm(`Delete page ${index + 1}?`)) store.removePages([p.id]); } }, '🗑'));
    return h('li', { class: 'card', 'data-selected': String(selected) }, thumb, bar);
  }

  function renderBar() {
    bar.replaceChildren();
    const n = state.selection.size;
    if (state.pages.length === 0) { bar.hidden = true; return; }
    bar.hidden = false;
    if (n === 0) {
      bar.append(h('button', { class: 'btn primary', onclick: openExport }, 'Export PDF'),
        h('button', { class: 'btn danger', onclick: () => { if (confirm('Remove all pages and start over?')) store.clearAll(); } }, 'Start over'));
      return;
    }
    const ids = [...state.selection];
    const filterSel = h('select', { class: 'btn', 'aria-label': 'Filter for selected pages' }, h('option', { value: '' }, 'Filter…'),
      ...FILTERS.map((f) => h('option', { value: f.id }, f.label)));
    filterSel.addEventListener('change', () => { if (filterSel.value) store.editPages(ids, (p) => ({ ...p, filter: filterSel.value as FilterName })); });
    bar.append(h('div', { class: 'count', role: 'status' }, `${n} selected`),
      h('button', { class: 'btn', onclick: async () => {
        let found = 0;
        for (const id of ids) {
          const blob = store.blobOf(id); const q = blob ? await detectCorners(blob) : null;
          if (q) { found++; store.editPages([id], (p) => ({ ...p, corners: q })); }
        }
        toast(`Auto-crop adjusted ${found} of ${ids.length} pages. Pages with no clear edges were left unchanged.`);
      } }, 'Auto-crop'),
      h('button', { class: 'btn', onclick: () => store.editPages(ids, (p) => ({ ...p, corners: fullQuad() })) }, 'Remove crop'),
      h('button', { class: 'btn', onclick: () => store.editPages(ids, (p) => ({ ...p, rotation: (p.rotation + 90) % 360 })) }, 'Rotate'),
      filterSel,
      h('button', { class: 'btn danger', onclick: () => { if (confirm(`Delete ${n} page(s)?`)) store.removePages(ids); } }, 'Delete'),
      h('button', { class: 'btn', onclick: store.selectAll }, 'Select all'),
      h('button', { class: 'btn', onclick: store.clearSelection }, 'Done'));
  }

  subscribe(render);
  render();
}

function action(icon: string, label: string, onClick: () => void): HTMLElement {
  return h('button', { class: 'btn action', type: 'button', onclick: onClick }, h('span', { class: 'big', 'aria-hidden': 'true' }, icon), label);
}
