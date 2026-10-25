import { FILTERS, type FilterName } from '../core/filters';
import { fullQuad, isFullFrame, isValidCrop } from '../core/geometry';
import { askText, download, formatBytes, h, openDialog, toast } from '../dom';
import { analysisImage, decode, detectCorners, detectSpreadIn, normalize } from '../imaging';
import { detectPage, detectSpread } from '../core/detect';
import { detectInBackground } from '../live/detectOnce';
import * as store from '../store';
import { state, subscribe, type PageModel } from '../store';
import { GUIDE_X, isValidSpread, type SpreadGeometry } from '../core/spread';
import { openCamera } from './camera';
import { openCombine } from './combineDialog';
import { openEditor, type PageDraftData } from './editor';
import { openExport } from './exportDialog';
import { openResize } from './resizeDialog';
import { openSettings } from './settingsDialog';
import { openTrash } from './trashDialog';
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

interface CaptureMeta { foldOnGuide?: boolean; anchored?: boolean; /** The photo is already upright and size-capped (it came from the in-app camera). */ w?: number; h?: number }

/**
 * Finding the crop of a new photo takes a moment, so a photo is added at once with a default crop and the detection runs one
 * after another in the background; the page is only updated if the person has not touched it in the meantime.
 */
let refining: Promise<void> = Promise.resolve();
const refineLater = (task: () => Promise<void>): void => { refining = refining.then(task).catch(() => undefined); };

const INSET = 0.03;
const defaultSpread = (): SpreadGeometry => ({ outer: [{ x: INSET, y: INSET }, { x: 1 - INSET, y: INSET }, { x: 1 - INSET, y: 1 - INSET }, { x: INSET, y: 1 - INSET }], tTop: 0.5, tBottom: 0.5 });
const sameSpread = (s: store.Spread): boolean => { const d = defaultSpread(); return s.tTop === d.tTop && s.tBottom === d.tBottom && s.outer.every((p, i) => p.x === d.outer[i].x && p.y === d.outer[i].y); };

/**
 * A spread photo is added at once as two pages (fold in the middle, flagged "Check") and the real fold and outline are
 * filled in a moment later. Undo removes both pages.
 */
function addSpreadFast(blob: Blob, w: number, ph: number, foldOnGuide: boolean): void {
  const before = state.pages.length;
  const spread = store.addSpread(blob, w, ph, defaultSpread(), true);
  const ids = state.pages.filter((p) => p.spread?.id === spread.id).map((p) => p.id);
  const last = state.pages[state.pages.length - 1]; if (last) highlight(last.id);
  const a = before + 1;
  toast(`Pages ${a} & ${a + 1} added`, { label: 'Undo', run: () => store.removePages(ids) });
  refineLater(async () => {
    const img = await analysisImage(blob);
    const found = (await detectInBackground(img, { mode: 'spread', anchored: false, foldOnGuide }))?.spread ?? (() => { const d = detectSpread(img, foldOnGuide ? GUIDE_X : undefined); return d; })();
    const cur = state.spreads.find((x) => x.id === spread.id);
    if (!cur || cur.independent || !sameSpread(cur)) return; // removed or already adjusted by the person
    const geo = { outer: found.outer, tTop: found.tTop, tBottom: found.tBottom };
    if (isValidSpread(geo)) store.updateSpread(spread.id, { ...geo, check: found.uncertain || found.outlineGuessed });
  });
}

/** A page is added at once as the full photo; the crop is found a moment later (and checked before it is used). */
function addPageFast(blob: Blob, w: number, ph: number, autoCrop: boolean, anchored: boolean): PageModel {
  const page = store.addPage(blob, w, ph, fullQuad());
  if (autoCrop) refineLater(async () => {
    const img = await analysisImage(blob);
    const r = await detectInBackground(img, { mode: 'single', anchored, foldOnGuide: false });
    const quad = r ? r.quad : detectPage(img);
    const cur = state.pages.find((p) => p.id === page.id);
    if (!cur || !isFullFrame(cur.corners) || !quad || !isValidCrop(quad)) return; // removed, edited meanwhile, or nothing convincing
    store.editPages([page.id], (p) => ({ ...p, corners: quad }));
  });
  return page;
}

/** Adds image files/blobs, honouring Single page / Book spread mode. */
async function ingest(files: Blob[], source: 'camera' | 'import', names: string[] = [], meta: CaptureMeta = {}): Promise<void> {
  const mode = state.settings.captureMode;
  let failed = 0, added = 0;
  const startedHere = files.length > 0 && state.currentId === null;
  if (files.length) store.ensureDoc(); // photos added from the list start a new document
  for (let i = 0; i < files.length; i++) {
    try {
      if (mode === 'spread' && source === 'import') { if (await reviewSpread(files[i])) added += 2; continue; }
      const src = meta.w && meta.h ? { blob: files[i], w: meta.w, h: meta.h } : await normalize(files[i]);
      if (mode === 'spread') { addSpreadFast(src.blob, src.w, src.h, !!meta.foldOnGuide); continue; }
      const auto = source === 'camera' ? state.settings.autoCropCamera : state.settings.autoCropImport;
      const page = addPageFast(src.blob, src.w, src.h, auto, !!meta.anchored);
      highlight(page.id); added++;
    } catch { failed++; if (names[i]) toast(`${names[i]} could not be read as an image.`); }
  }
  if (startedHere && state.pages.length === 0) store.closeDoc(); // nothing could be added: do not leave an empty document behind
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
    modeHint.textContent = 'One photo of an open book becomes two pages, left then right. Camera photos are added at once (a yellow Check badge marks an unsure split); imported photos open a review first.';
  };

  const cameraMode = { get: () => state.settings.captureMode, set: (m: 'single' | 'spread') => store.updateSettings({ captureMode: m }) };
  /** Opens the camera; with `retake` (a spread id) it takes one photo and sends it to that spread's retake review. */
  const scan = (retake?: string) => { if (!retake) store.ensureDoc(); openCamera(async (blob, meta) => {
    if (!retake) { await ingest([blob], 'camera', [], meta); return; }
    retaking = retake;
    try { await reviewSpread(blob); } finally { retaking = null; }
  }, () => { retaking = retake ?? null; captureInput.click(); },
  retake ? { mode: { get: () => 'spread', set: () => undefined }, single: true, onEditPage: editPage } : { mode: cameraMode, onEditPage: editPage, onClosed: () => { if (state.pages.length === 0 && !retake) store.closeDoc(); } }); };
  const homeScan = h('button', { class: 'btn primary entry-scan', type: 'button', 'aria-label': 'Scan pages', onclick: () => scan() }, icon('scan', 26), 'Scan');
  const entry = h('div', { class: 'entry', role: 'group', 'aria-label': 'Start' }, homeScan,
    h('button', { class: 'btn entry-btn', type: 'button', 'aria-label': 'Import images', onclick: () => openImport() }, icon('image', 24), 'Import'),
    h('button', { class: 'btn entry-btn', type: 'button', 'aria-label': 'Tools', onclick: () => openTools() }, icon('combine', 24), 'Tools'));
  const drafts = h('div', { class: 'drafts' });
  const pdfSearch = h('input', { type: 'search', class: 'pdf-search', placeholder: 'Search PDFs', 'aria-label': 'Search PDFs' });
  pdfSearch.addEventListener('input', () => renderPdfList());
  const pdfList = h('ul', { class: 'pdf-list', 'aria-label': 'PDFs' });
  const list = h('ul', { class: 'grid', 'aria-label': 'Pages' });
  const empty = h('div', { class: 'empty' }, h('div', { class: 'empty-icon' }, icon('document', 56)), h('h2', {}, 'No pages yet'),
    h('p', {}, 'Tap Add to scan or import photos. Then make one PDF. Nothing leaves this device.'));
  const docHead = h('div', { class: 'doc-head' });
  const bar = h('div', { class: 'bar' });
  const notice = h('p', { class: 'notice', hidden: true });
  // Documents list (home) and the bar of the open document.
  const docsHead = h('div', { class: 'doc-head' });
  const docsEmpty = h('div', { class: 'empty' }, h('div', { class: 'empty-icon' }, icon('document', 56)), h('h2', {}, 'No PDFs yet'),
    h('p', {}, 'Tap Scan, or import photos, then make a PDF. It appears here. Nothing leaves this device.'));
  const tipKey = 'pdf-scanner.tip-keep';
  const tip = h('div', { class: 'notice tip', hidden: true });
  const trashLink = h('button', { class: 'btn trash-link', type: 'button', onclick: openTrash });
  const docBar = h('div', { class: 'doc-bar' });
  const exportsBox = h('div', { class: 'exports', hidden: true });

  const main = h('main', {});
  const topBar = h('header', { class: 'top' },
      h('div', { class: 'brand' }, h('h1', {}, 'PDF Scanner', h('span', { class: 'beta' }, `beta ${__APP_VERSION__}`)),
        h('p', { class: 'sub' }, icon('lock', 16), ' Private, saved on this device')),
      h('button', { class: 'icon-btn', 'aria-label': 'Settings', onclick: openSettings }, icon('gear')));
  root.append(topBar, main, bar, importInput, captureInput);

  function render() {
    const pages = state.pages;
    const inDoc = state.currentId !== null;
    paintMode();
    notice.hidden = state.persistent && state.storage === 'ok';
    notice.textContent = state.storage === 'full'
      ? 'Your browser has no space left, so recent changes are not saved. Export your PDF now, or delete pages to free space. Your pages are still here until you close this tab.'
      : 'Your browser is not keeping scans between visits (private mode?). Export before closing this tab.';
    main.replaceChildren(...(inDoc
      ? [notice, docBar, docHead, list, empty, exportsBox]
      : [notice, tip, entry, drafts, docsHead, pdfSearch, pdfList, docsEmpty, trashLink]));
    topBar.hidden = inDoc; // an open document has its own bar (back, name, menu)
    if (inDoc) {
      empty.hidden = pages.length > 0;
      list.hidden = pages.length === 0;
      list.replaceChildren(...pages.map((p, i) => card(p, i, pages.length)));
      renderDocBar();
      renderDocHead();
      renderExports();
    } else renderHome();
    renderTip();
    renderBar();
  }

  function renderTip() {
    let dismissed = false;
    try { dismissed = localStorage.getItem(tipKey) === '1'; } catch { /* ignore */ }
    tip.hidden = state.protectedStorage !== false || dismissed || store.liveDocs().length === 0;
    tip.replaceChildren(h('span', {}, 'Tip: your browser may delete saved scans if you do not open the app for a few days. Install it (Share → Add to Home Screen), or back up from Settings.'),
      h('button', { class: 'btn', type: 'button', onclick: () => { try { localStorage.setItem(tipKey, '1'); } catch { /* ignore */ } renderTip(); } }, 'Got it'));
  }

  const when = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

  const sizeOf = (d: store.Doc): number => d.exports[d.exports.length - 1]?.bytes ?? 0;
  function renderHome() {
    const pdfs = store.pdfDocs();
    const ds = store.draftDocs();
    drafts.hidden = ds.length === 0;
    drafts.replaceChildren(...ds.map((d) => {
      const n = store.docPageCount(d);
      const img = h('img', { alt: '', draggable: 'false' });
      const first = d.pages[0];
      if (first) thumbUrl(first).then((u) => { img.src = u; }).catch(() => undefined);
      return h('div', { class: 'draft-banner', 'data-doc': d.id },
        h('span', { class: 'draft-thumb' }, first ? img : icon('document', 28)),
        h('div', { class: 'draft-text' }, h('strong', {}, 'Continue scanning'), h('span', { class: 'hint' }, `${n} page${n === 1 ? '' : 's'} · auto-saved`)),
        h('button', { class: 'btn draft-open', type: 'button', 'aria-label': 'Open draft', onclick: () => store.openDoc(d.id) }, 'Open'),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Discard draft', onclick: () => { const undo = store.deleteDoc(d.id); toast('Draft discarded.', { label: 'Undo', run: undo }); } }, icon('trash')));
    }));
    docsEmpty.hidden = pdfs.length > 0 || ds.length > 0;
    docsHead.hidden = pdfs.length === 0;
    pdfSearch.hidden = pdfs.length < 4;
    docsHead.replaceChildren(h('div', { class: 'titles' }, h('h2', {}, 'PDFs'), h('span', { class: 'hint' }, `${pdfs.length} file${pdfs.length === 1 ? '' : 's'}`)));
    renderPdfList();
    const trash = store.trashedDocs().length;
    trashLink.hidden = trash === 0;
    trashLink.textContent = `Recently deleted (${trash})`;
  }

  function renderPdfList() {
    const q = pdfSearch.value.trim().toLowerCase();
    const pdfs = store.pdfDocs().filter((d) => !q || d.name.toLowerCase().includes(q));
    pdfList.hidden = pdfs.length === 0;
    pdfList.replaceChildren(...pdfs.map((d) => {
      const n = store.docPageCount(d);
      const first = d.pages[0];
      const img = h('img', { alt: '', draggable: 'false' });
      if (first) thumbUrl(first).then((u) => { img.src = u; }).catch(() => undefined);
      return h('li', { class: 'pdf-row', 'data-doc': d.id },
        h('button', { class: 'pdf-open', type: 'button', 'aria-label': `Open ${d.name}`, onclick: () => store.openDoc(d.id) },
          h('span', { class: 'pdf-thumb' }, first ? img : icon('document', 28)),
          h('span', { class: 'pdf-text' }, h('strong', { class: 'doc-name' }, d.name),
            h('span', { class: 'hint' }, `${n} page${n === 1 ? '' : 's'} · ${formatBytes(sizeOf(d))} · ${when(d.updatedAt)}`),
            store.isEdited(d) ? h('span', { class: 'doc-status edited' }, 'Edited, save to update') : null)),
        h('button', { class: 'icon-btn doc-menu', type: 'button', 'aria-label': `${d.name} menu`, onclick: () => openDocMenu(d) }, icon('more')));
    }));
  }

  /** Import from the home screen: pick whether the photos are single pages or book spreads, then choose them. */
  function openImport() {
    openDialog((close) => h('div', { class: 'dlg menu' }, h('h2', {}, 'Import images'), modeSwitch, modeHint,
      h('button', { class: 'btn primary tool-item', type: 'button', onclick: () => { close(); importInput.click(); } }, icon('image', 22), 'Choose photos'),
      h('button', { class: 'btn', type: 'button', onclick: close }, 'Close')), 'Import images');
  }

  /** Tools sheet (the Tools hub replaces it later). */
  function openTools() {
    openDialog((close) => {
      const item = (label: string, ic: IconName, fn: () => void) => h('button', { class: 'btn tool-item', type: 'button', onclick: () => { close(); fn(); } }, icon(ic, 22), label);
      return h('div', { class: 'dlg menu' }, h('h2', {}, 'Tools'),
        item('Combine PDFs', 'combine', () => openCombine()),
        item('Resize images', 'resize', () => openResize()),
        h('button', { class: 'btn', type: 'button', onclick: close }, 'Close'));
    }, 'Tools');
  }

  function renderDocBar() {
    const d = store.currentDoc();
    docBar.replaceChildren(
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to documents', onclick: () => store.closeDoc() }, icon('arrow-left')),
      h('div', { class: 'doc-title' },
        h('button', { class: 'doc-rename', type: 'button', 'aria-label': 'Rename document', onclick: () => d && void renameFlow(d.id, d.name) }, h('strong', {}, d?.name ?? 'Document')),
        h('span', { class: 'hint' }, d ? (d.status === 'done' ? (store.isEdited(d) ? 'PDF made · edited, make it again to update' : 'PDF made') : 'Draft, saved automatically') : '')),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Document menu', onclick: () => d && openDocMenu(d) }, icon('more')));
  }

  async function renameFlow(id: string, name: string) {
    const v = await askText('Rename document', name);
    if (v) store.renameDoc(id, v);
  }

  function openDocMenu(d: store.Doc) {
    openDialog((close) => {
      const item = (label: string, fn: () => void, danger = false) => h('button', { class: `btn${danger ? ' danger' : ''}`, type: 'button', onclick: () => { close(); fn(); } }, label);
      return h('div', { class: 'dlg menu' }, h('h2', {}, d.name),
        d.exports.length ? item('Download PDF', () => { const e = d.exports[d.exports.length - 1]; const b = store.pdfBlob(e.id); if (b) download(b, `${e.name}.pdf`); else toast('That PDF is no longer stored.'); }) : null,
        item('Rename', () => void renameFlow(d.id, d.name)),
        item('Delete', () => { const undo = store.deleteDoc(d.id); toast(`Deleted "${d.name}". It stays in Recently deleted for 30 days.`, { label: 'Undo', run: undo }); }, true),
        h('button', { class: 'btn', type: 'button', onclick: close }, 'Close'));
    }, `${d.name} menu`);
  }

  function renderExports() {
    const d = store.currentDoc();
    const list2 = d?.exports ?? [];
    exportsBox.hidden = list2.length === 0;
    exportsBox.replaceChildren(h('h3', {}, 'Saved PDFs'), ...list2.slice().reverse().map((e) => h('div', { class: 'export-row' },
      h('div', {}, h('strong', {}, `${e.name}.pdf`), h('div', { class: 'hint' }, `${e.pages} page${e.pages === 1 ? '' : 's'} · ${formatBytes(e.bytes)} · ${when(e.at)}`)),
      h('button', { class: 'btn', type: 'button', 'aria-label': `Download ${e.name}`, onclick: () => { const b = store.pdfBlob(e.id); if (b) download(b, `${e.name}.pdf`); else toast('That PDF is no longer stored.'); } }, 'Download'),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Remove saved ${e.name}`, onclick: () => store.removeExport(d!.id, e.id) }, icon('trash')))));
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
    const toCheck = state.spreads.filter((x) => x.check).length;
    docHead.append(h('div', { class: 'titles' }, h('h2', {}, 'Your pages'),
        h('span', { class: 'hint' }, `${state.pages.length} page${state.pages.length === 1 ? '' : 's'}${spreads ? ` · ${spreads} spread${spreads === 1 ? '' : 's'}` : ''}${toCheck ? ` · ${toCheck} to check` : ''}`)),
      h('button', { class: 'btn', onclick: () => { selectMode = true; render(); } }, 'Select'));
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
        item('Delete page', () => { const r = store.removePages([p.id]); toast(`Page ${index + 1} deleted.`, { label: 'Undo', run: r.undo }); }, false, true),
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
    const pair = p.spread ? (state.pages[index + 1]?.spread?.id === p.spread.id && state.pages[index - 1]?.spread?.id !== p.spread.id ? 'first' : state.pages[index - 1]?.spread?.id === p.spread.id ? 'second' : undefined) : undefined;
    return h('li', { class: 'card', 'data-id': p.id, 'data-selected': String(selected), 'data-pair': pair }, thumb, bar);
  }

  /** The add sheet of an open document: scan, import or take a photo, and the single page / book spread switch. */
  function openAdd() {
    openDialog((close) => {
      const item = (label: string, ic: IconName, fn: () => void) => h('button', { class: `btn tool-item${label === 'Scan pages' ? ' primary' : ''}`, type: 'button', onclick: () => { close(); fn(); } }, icon(ic, 22), label);
      return h('div', { class: 'dlg menu' }, h('h2', {}, 'Add pages'), modeSwitch, modeHint,
        item('Scan pages', 'scan', () => scan()),
        item('Import images', 'image', () => importInput.click()),
        item('Take photo', 'camera', () => captureInput.click()),
        h('button', { class: 'btn', type: 'button', onclick: close }, 'Close'));
    }, 'Add pages');
  }

  function renderBar() {
    bar.replaceChildren();
    const n = state.selection.size;
    if (state.currentId === null) { bar.hidden = true; return; }
    bar.hidden = false;
    if (state.pages.length === 0) { bar.append(h('button', { class: 'btn primary', type: 'button', onclick: openAdd }, icon('plus', 22), 'Add pages')); return; }
    if (n === 0 && !selectMode) {
      bar.append(h('button', { class: 'btn add-btn', type: 'button', 'aria-label': 'Add pages', onclick: openAdd }, icon('plus', 22)),
        h('button', { class: 'btn', onclick: () => openViewer(state.pages[0].id) }, 'Preview'),
        h('button', { class: 'btn primary make-pdf', onclick: openExport }, `Make PDF (${state.pages.length})`));
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
      h('button', { class: 'btn danger', onclick: () => { selectMode = false; const r = store.removePages(ids); toast(`${n} page${n === 1 ? '' : 's'} deleted.`, { label: 'Undo', run: r.undo }); } }, 'Delete'));
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
