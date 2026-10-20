import { FILTERS, type FilterName } from '../core/filters';
import { fullQuad } from '../core/geometry';
import { h, openDialog, toast } from '../dom';
import { decode, detectAnchoredIn, detectCorners, detectSpreadIn, normalize } from '../imaging';
import * as store from '../store';
import { state, subscribe, type PageModel } from '../store';
import { GUIDE_X } from '../core/spread';
import { openCamera } from './camera';
import { openCombine } from './combineDialog';
import { openEditor, type PageDraftData } from './editor';
import { openExport } from './exportDialog';
import { openResize } from './resizeDialog';
import { openSettings } from './settingsDialog';
import { openSpreadEditor, type SpreadDraftData } from './spreadEditor';
import { thumbUrl } from './thumbs';
import { icon, type IconName } from './icons';
import { openViewer } from './viewer';

declare const __APP_VERSION__: string;

let highlight: (id: string) => void = () => {};
/** Set while a retake is waiting for its photo. */
let retaking: string | null = null;

/** Reviews one spread photo; the pages are added (or the spread replaced) only when the user applies it. */
async function reviewSpread(blob: Blob): Promise<boolean> {
  const { blob: normal, w, h: ph } = await normalize(blob);
  const d = await detectSpreadIn(normal);
  const spreadId = retaking;
  const applied = await openSpreadEditor({
    mode: spreadId ? 'retake' : 'new', spreadId: spreadId ?? undefined, blob: normal, w, h: ph,
    start: { outer: d.outer, tTop: d.tTop, tBottom: d.tBottom }, uncertain: d.uncertain, outlineGuessed: d.outlineGuessed, draftId: store.newId(),
  });
  if (applied && !spreadId) { const last = state.pages[state.pages.length - 1]; if (last) highlight(last.id); }
  return applied;
}

/**
 * A camera capture of a spread is added at once with the detected split (no review screen in the middle of scanning).
 * Unsure captures get a "Check" badge in the page list; Undo removes both pages.
 */
async function addSpreadQuietly(blob: Blob, foldOnGuide: boolean): Promise<void> {
  const { blob: normal, w, h: ph } = await normalize(blob);
  // From the in-app camera the fold was placed on the centre guide, so it is used as the fold; otherwise it is searched for.
  const d = await detectSpreadIn(normal, foldOnGuide ? GUIDE_X : undefined);
  const before = state.pages.length;
  const spread = store.addSpread(normal, w, ph, { outer: d.outer, tTop: d.tTop, tBottom: d.tBottom }, d.uncertain || d.outlineGuessed);
  const ids = state.pages.filter((p) => p.spread?.id === spread.id).map((p) => p.id);
  const last = state.pages[state.pages.length - 1]; if (last) highlight(last.id);
  const a = before + 1;
  toast(spread.check ? `Pages ${a} & ${a + 1} added. Check the split later.` : `Pages ${a} & ${a + 1} added`, { label: 'Undo', run: () => store.removePages(ids) });
}

/** Adds image files/blobs, honouring Single page / Book spread mode. */
async function ingest(files: Blob[], source: 'camera' | 'import', names: string[] = [], meta: { foldOnGuide?: boolean; anchored?: boolean } = {}): Promise<void> {
  const foldOnGuide = !!meta.foldOnGuide;
  const mode = state.settings.captureMode;
  let failed = 0, added = 0;
  for (let i = 0; i < files.length; i++) {
    try {
      if (mode === 'spread' && source === 'camera') { await addSpreadQuietly(files[i], foldOnGuide); continue; }
      if (mode === 'spread') { if (await reviewSpread(files[i])) added += 2; continue; }
      const auto = source === 'camera' ? state.settings.autoCropCamera : state.settings.autoCropImport;
      const { blob, w, h: ph } = await normalize(files[i]);
      // From the in-app camera with guide lines, the page edge placed on a line is used; otherwise (or if no line was used) the normal search.
      const corners = auto ? (meta.anchored ? await detectAnchoredIn(blob) : null) ?? (await detectCorners(blob)) ?? fullQuad() : fullQuad();
      const page = store.addPage(blob, w, ph, corners);
      highlight(page.id); added++;
    } catch { failed++; if (names[i]) toast(`${names[i]} could not be read as an image.`); }
  }
  if (added && source !== 'camera' && mode === 'single') toast(`${added} page${added === 1 ? '' : 's'} added.`);
  if (failed && !names.length) toast(`${failed} image(s) could not be added.`);
}

/** Opens the right editor for a page: the spread editor for spread pages, the page editor otherwise. */
async function editPage(p: PageModel): Promise<void> {
  if (p.spread) {
    const spread = state.spreads.find((s) => s.id === p.spread!.id);
    const blob = spread && store.sourceBlob(spread.sourceId);
    if (!spread || !blob) { toast('This spread image is missing.'); return; }
    await openSpreadEditor({ mode: 'edit', spreadId: spread.id, blob, w: spread.w, h: spread.h, start: spread, uncertain: false, draftId: spread.id });
  } else openEditor(p);
}

export function mountApp(root: HTMLElement): void {
  const fileInput = (accept: string, multiple: boolean, capture?: string) =>
    h('input', { type: 'file', accept, multiple, capture, class: 'visually-hidden', tabindex: '-1', 'aria-hidden': 'true' });
  const importInput = fileInput('image/*', true);
  const captureInput = fileInput('image/*', false, 'environment');
  importInput.addEventListener('change', async () => { const f = Array.from(importInput.files ?? []); importInput.value = ''; await ingest(f, 'import', f.map((x) => x.name)); });
  captureInput.addEventListener('change', async () => {
    const f = Array.from(captureInput.files ?? []); captureInput.value = '';
    if (retaking) { try { for (const x of f) await reviewSpread(x); } finally { retaking = null; } return; }
    await ingest(f, 'camera', f.map((x) => x.name));
  });

  const modeSwitch = h('div', { class: 'chips mode-switch', role: 'radiogroup', 'aria-label': 'Capture mode' });
  const modeHint = h('p', { class: 'hint' });
  const paintMode = () => {
    const m = state.settings.captureMode;
    modeSwitch.replaceChildren(...(['single', 'spread'] as const).map((id) => h('button', {
      class: 'chip', role: 'radio', type: 'button', 'aria-checked': String(id === m),
      onclick: () => store.updateSettings({ captureMode: id }),
    }, id === 'single' ? 'Single page' : 'Book spread')));
    modeHint.hidden = m !== 'spread';
    modeHint.textContent = 'One photo of an open book becomes two pages, left then right. You check the split before it is added.';
  };

  const cameraMode = { get: () => state.settings.captureMode, set: (m: 'single' | 'spread') => store.updateSettings({ captureMode: m }) };
  /** Opens the camera; with `retake` (a spread id) it takes one photo and sends it to that spread's retake review. */
  const scan = (retake?: string) => openCamera(async (blob, meta) => {
    if (!retake) { await ingest([blob], 'camera', [], meta); return; }
    retaking = retake;
    try { await reviewSpread(blob); } finally { retaking = null; }
  }, () => { retaking = retake ?? null; captureInput.click(); },
  retake ? { mode: { get: () => 'spread', set: () => undefined }, single: true, onEditPage: editPage } : { mode: cameraMode, onEditPage: editPage });
  const scanBtn = h('button', { class: 'btn primary scan', type: 'button', onclick: () => scan() }, icon('scan', 30), 'Scan pages');
  const tiles = h('div', { class: 'tiles', role: 'group', 'aria-label': 'More ways to add pages and tools' },
    tile('image', 'Import images', () => importInput.click()),
    tile('camera', 'Take photo', () => captureInput.click()),
    tile('combine', 'Combine PDFs', () => openCombine()),
    tile('resize', 'Resize images', () => openResize()));
  const list = h('ul', { class: 'grid', 'aria-label': 'Pages' });
  const empty = h('div', { class: 'empty' }, h('div', { class: 'empty-icon' }, icon('document', 56)), h('h2', {}, 'No pages yet'),
    h('p', {}, 'Tap Scan, or import photos. Then make one PDF. Nothing leaves this device.'));
  const docHead = h('div', { class: 'doc-head' });
  const bar = h('div', { class: 'bar' });
  const notice = h('p', { class: 'notice', hidden: true });

  root.append(
    h('header', { class: 'top' },
      h('div', { class: 'brand' }, h('h1', {}, 'PDF Scanner', h('span', { class: 'beta' }, `beta ${__APP_VERSION__}`)),
        h('p', { class: 'sub' }, icon('lock', 16), ' Private, saved on this device')),
      h('button', { class: 'icon-btn', 'aria-label': 'Settings', onclick: openSettings }, icon('gear'))),
    h('main', {}, notice, scanBtn, modeSwitch, modeHint, tiles, docHead, list, empty), bar, importInput, captureInput);

  function render() {
    const pages = state.pages;
    paintMode();
    notice.hidden = state.persistent && state.storage === 'ok';
    notice.textContent = state.storage === 'full'
      ? 'Your browser has no space left, so recent changes are not saved. Export your PDF now, or delete pages to free space. Your pages are still here until you close this tab.'
      : 'Your browser is not keeping scans between visits (private mode?). Export before closing this tab.';
    empty.hidden = pages.length > 0;
    list.hidden = pages.length === 0;
    list.replaceChildren(...pages.map((p, i) => card(p, i, pages.length)));
    renderDocHead();
    renderBar();
  }

  function renderDocHead() {
    docHead.replaceChildren();
    docHead.hidden = state.pages.length === 0;
    if (docHead.hidden) return;
    const n = state.selection.size;
    if (n > 0 || selectMode) {
      docHead.append(h('strong', { role: 'status' }, `${n} selected`),
        h('button', { class: 'btn', onclick: store.selectAll }, 'Select all'),
        h('button', { class: 'btn', onclick: () => { selectMode = false; store.clearSelection(); } }, 'Done'));
      return;
    }
    const spreads = state.spreads.length;
    docHead.append(h('div', { class: 'titles' }, h('h2', {}, 'Your pages'),
        h('span', { class: 'hint' }, `${state.pages.length} page${state.pages.length === 1 ? '' : 's'}${spreads ? ` · ${spreads} spread${spreads === 1 ? '' : 's'}` : ''}`)),
      h('button', { class: 'btn', onclick: () => { selectMode = true; render(); } }, 'Select'),
      h('button', { class: 'icon-btn', 'aria-label': 'Start over', onclick: () => { if (confirm('Remove all pages and start over?')) store.clearAll(); } }, icon('trash')));
  }

  /** Small action sheet for one page. */
  function openMenu(p: PageModel, index: number, total: number) {
    openDialog((close) => {
      const item = (label: string, fn: () => void, disabled = false, danger = false) =>
        h('button', { class: `btn${danger ? ' danger' : ''}`, type: 'button', disabled, onclick: () => { close(); fn(); } }, label);
      return h('div', { class: 'dlg menu' }, h('h2', {}, `Page ${index + 1}`),
        item('Preview', () => openViewer(p.id)),
        item(p.spread ? 'Edit spread' : 'Edit page', () => void editPage(p)),
        p.spread ? item('Retake spread', () => scan(p.spread!.id)) : null,
        item('Move earlier', () => store.movePage(p.id, -1), index === 0),
        item('Move later', () => store.movePage(p.id, 1), index === total - 1),
        item('Select', () => { selectMode = true; store.toggleSelect(p.id); }),
        item('Delete page', () => { if (confirm(`Delete page ${index + 1}?`)) store.removePages([p.id]); }, false, true),
        h('button', { class: 'btn', onclick: close }, 'Close'));
    }, `Page ${index + 1} menu`);
  }

  let selectMode = false;

  function card(p: PageModel, index: number, total: number): HTMLElement {
    const selecting = selectMode || state.selection.size > 0;
    const selected = state.selection.has(p.id);
    const img = h('img', { alt: `Page ${index + 1} of ${total}`, draggable: 'false' });
    thumbUrl(p).then((url) => { img.src = url; }).catch(() => { img.alt = `Page ${index + 1} (preview unavailable)`; });
    let timer: number | undefined, longPressed = false;
    const thumb = h('button', { class: 'thumb', type: 'button', 'aria-pressed': selecting ? String(selected) : undefined,
      'aria-label': selecting ? `Select page ${index + 1}` : `${p.spread ? 'Edit spread for page' : 'Edit page'} ${index + 1}`,
      onclick: () => { if (longPressed) { longPressed = false; return; } if (selecting) store.toggleSelect(p.id); else void editPage(p); },
      onpointerdown: () => { longPressed = false; timer = window.setTimeout(() => { longPressed = true; selectMode = true; store.toggleSelect(p.id); }, 500); },
      onpointerup: () => clearTimeout(timer), onpointerleave: () => clearTimeout(timer), onpointercancel: () => clearTimeout(timer),
      oncontextmenu: (e: Event) => e.preventDefault() }, img, selecting ? h('span', { class: 'check', 'aria-hidden': 'true' }, selected ? icon('check', 16) : null) : null);
    const spreadNo = p.spread ? state.spreads.findIndex((s) => s.id === p.spread!.id) + 1 : 0;
    const label = h('span', {}, `${index + 1}`, p.spread ? h('small', { class: 'badge' }, `Spread ${spreadNo} · ${p.spread.side}`) : null,
      p.spread && state.spreads.find((s) => s.id === p.spread!.id)?.check ? h('small', { class: 'badge check-badge' }, 'Check') : null);
    const bar = h('div', { class: 'card-bar' }, label,
      selecting ? null : h('button', { class: 'icon-btn', 'aria-label': `Page ${index + 1} menu`, onclick: () => openMenu(p, index, total) }, icon('more')));
    return h('li', { class: 'card', 'data-id': p.id, 'data-selected': String(selected) }, thumb, bar);
  }

  function renderBar() {
    bar.replaceChildren();
    const n = state.selection.size;
    if (state.pages.length === 0) { bar.hidden = true; return; }
    bar.hidden = false;
    if (n === 0 && !selectMode) {
      bar.append(h('button', { class: 'btn primary', onclick: openExport }, `Make PDF (${state.pages.length})`),
        h('button', { class: 'btn', onclick: () => openViewer(state.pages[0].id) }, 'Preview'));
      return;
    }
    if (n === 0) { bar.append(h('span', { class: 'hint' }, 'Tap pages to select them.')); return; }
    const ids = [...state.selection];
    const single = ids.filter((id) => !state.pages.find((p) => p.id === id)?.spread);
    const filterSel = h('select', { class: 'btn', 'aria-label': 'Filter for selected pages' }, h('option', { value: '' }, 'Filter…'),
      ...FILTERS.map((f) => h('option', { value: f.id }, f.label)));
    filterSel.addEventListener('change', () => { if (filterSel.value) store.editPages(ids, (p) => ({ ...p, filter: filterSel.value as FilterName })); });
    const skipped = ids.length - single.length;
    const note = skipped ? ` Spread pages (${skipped}) are adjusted in the spread editor and were skipped.` : '';
    bar.append(
      h('button', { class: 'btn', onclick: async () => {
        let found = 0;
        for (const id of single) {
          const blob = store.blobOf(id); const q = blob ? await detectCorners(blob) : null;
          if (q) { found++; store.editPages([id], (p) => ({ ...p, corners: q })); }
        }
        toast(`Auto-crop adjusted ${found} of ${single.length} pages. Pages with no clear edges were left unchanged.${note}`);
      } }, 'Auto-crop'),
      h('button', { class: 'btn', onclick: () => { store.editPages(single, (p) => ({ ...p, corners: fullQuad() })); if (skipped) toast(`Remove crop skipped ${skipped} spread page(s).`); } }, 'Remove crop'),
      h('button', { class: 'btn', onclick: () => store.editPages(ids, (p) => ({ ...p, rotation: (p.rotation + 90) % 360 })) }, 'Rotate'),
      filterSel,
      h('button', { class: 'btn danger', onclick: () => { if (confirm(`Delete ${n} page(s)?`)) { selectMode = false; store.removePages(ids); } } }, 'Delete'));
  }

  highlight = (id) => {
    const el = list.querySelector(`[data-id="${id}"]`);
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.add('fresh'); }
  };
  subscribe(() => { if (state.selection.size === 0 && selectMode && state.pages.length === 0) selectMode = false; render(); });
  render();
  void offerDraftResume();
}

/** If the last session ended with an editor open, offer to continue where it stopped. */
async function offerDraftResume(): Promise<void> {
  const d = state.draft;
  if (!d) return;
  openDialog((close) => h('div', { class: 'dlg' }, h('h2', {}, 'Resume your edit?'),
    h('p', {}, 'The app was closed or reloaded while you were editing. Your changes were saved as a draft.'),
    h('div', { class: 'row end' },
      h('button', { class: 'btn', onclick: () => { close(); store.clearDraft(); } }, 'Discard'),
      h('button', { class: 'btn primary', onclick: async () => {
        close();
        try {
          if (d.kind === 'page') {
            const page = state.pages.find((p) => p.id === d.id);
            if (page) openEditor(page, d.data as PageDraftData);
          } else {
            const data = d.data as SpreadDraftData;
            const isNew = d.kind === 'newSpread';
            const spread = isNew ? undefined : state.spreads.find((s) => s.id === d.id);
            const blob = isNew ? store.draftSource(d.id) : spread && store.sourceBlob(spread.sourceId);
            if (!blob) { store.clearDraft(); return; }
            const bmp = await decode(blob); const [w, ph] = [bmp.width, bmp.height]; bmp.close();
            await openSpreadEditor({ mode: isNew ? 'new' : 'edit', spreadId: spread?.id, blob, w, h: ph, start: data.geo, uncertain: !data.confirmed, draftId: d.id, resume: data });
          }
        } catch { store.clearDraft(); toast('The draft could not be restored.'); }
      } }, 'Resume'))), 'Resume your edit?');
}

function tile(name: IconName, label: string, onClick: () => void): HTMLElement {
  return h('button', { class: 'tile', type: 'button', onclick: onClick }, h('span', { class: 'big' }, icon(name, 26)), h('span', { class: 'label' }, label), h('span', { class: 'chev' }, icon('chevron-right', 22)));
}
