import { FILTERS, type FilterName } from '../core/filters';
import { fullQuad, isFullFrame, isValidCrop } from '../core/geometry';
import { askText, chips, download, formatBytes, h, openDialog, openSheet, sheetItem, shareFile, toast } from '../dom';
import { analysisImage, decode, detectSpreadIn, normalize } from '../imaging';
import { detectSpread } from '../core/detect';
import { findCorners } from '../engine';
import { detectInBackground } from '../live/detectOnce';
import * as store from '../store';
import { state, subscribe, type PageModel } from '../store';
import { GUIDE_X, isValidSpread, type SpreadGeometry } from '../core/spread';
import { openCamera } from './camera';
import { openEditor, type PageDraftData } from './editor';
import { openExport } from './exportDialog';
import { openCompress } from './compressDialog';
import { buildSettings } from './settingsPage';
import { buildTools } from './toolsPage';
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
    const f = await findCorners(blob, { anchored });
    const cur = state.pages.find((p) => p.id === page.id);
    if (!cur || !isFullFrame(cur.corners)) return; // removed or edited meanwhile
    if (!f.quad || !isValidCrop(f.quad)) { store.editPages([page.id], (p) => ({ ...p, check: true })); return; } // nothing convincing: keep the photo, say so
    store.editPages([page.id], (p) => ({ ...p, corners: f.quad!, check: f.confidence === 'high' ? undefined : true }));
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
    } catch { failed++; if (names[i]) toast(`${names[i]} is not a readable image.`); }
  }
  if (startedHere && state.pages.length === 0) store.closeDoc(); // nothing could be added: do not leave an empty document behind
  if (added && source !== 'camera' && mode === 'single') toast(`${added} page${added === 1 ? '' : 's'} added.`);
  if (failed && !names.length) toast(`${failed} image${failed === 1 ? '' : 's'} not added.`);
}

/** Opens the right editor for a page: the spread editor for spread pages, the page editor otherwise. */
async function editPage(p: PageModel): Promise<void> {
  if (p.spread) {
    const spread = state.spreads.find((s) => s.id === p.spread!.id);
    const blob = spread && store.sourceBlob(spread.sourceId);
    if (!spread || !blob) { toast('Spread image is missing.'); return; }
    await openSpreadEditor({ mode: 'edit', spreadId: spread.id, blob, w: spread.w, h: spread.h, start: spread, uncertain: false, draftId: spread.id });
  } else openEditor(p);
}

type Tab = 'pdfs' | 'tools' | 'settings';
const TABS: { id: Tab; label: string; icon: IconName }[] = [{ id: 'pdfs', label: 'PDFs', icon: 'pdf' }, { id: 'tools', label: 'Tools', icon: 'tools' }, { id: 'settings', label: 'Settings', icon: 'gear' }];

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

  let tab: Tab = 'pdfs';
  let selectMode = false;
  let query = '';

  /** Single page / Book spread, with a line of explanation: shown inside the Import and Add sheets. */
  const modePicker = (): Node[] => [
    Object.assign(chips([{ id: 'single' as const, label: 'Single page' }, { id: 'spread' as const, label: 'Book spread' }], state.settings.captureMode, (id) => store.updateSettings({ captureMode: id })), { className: 'chips seg' }),
    h('p', { class: 'hint', style: 'margin:8px 4px 12px' }, 'One photo of an open book becomes two pages.'),
  ];
  const cameraMode = { get: () => state.settings.captureMode, set: (m: 'single' | 'spread') => store.updateSettings({ captureMode: m }) };
  /** Opens the camera; with `retake` (a spread id) it takes one photo and sends it to that spread's retake review. */
  const scan = (retake?: string) => { if (!retake) store.ensureDoc(); openCamera(async (blob, meta) => {
    if (!retake) { await ingest([blob], 'camera', [], meta); return; }
    retaking = retake;
    try { await reviewSpread(blob); } finally { retaking = null; }
  }, () => { retaking = retake ?? null; captureInput.click(); },
  retake ? { mode: { get: () => 'spread', set: () => undefined }, single: true, onEditPage: editPage } : { mode: cameraMode, onEditPage: editPage, onImport: () => importInput.click(), onClosed: () => { if (state.pages.length === 0 && !retake) store.closeDoc(); } }); };

  const openImport = () => openSheet((close) => [
    h('h2', {}, 'Import images'), ...modePicker(),
    h('div', { class: 'stack' }, h('button', { class: 'btn primary', type: 'button', onclick: () => { close(); importInput.click(); } }, icon('image', 22), 'Choose photos'), h('button', { class: 'btn', type: 'button', onclick: close }, 'Close')),
  ], 'Import images');
  const openAdd = () => openSheet((close) => [
    h('h2', {}, 'Add pages'), ...modePicker(),
    h('div', { class: 'stack' },
      h('button', { class: 'btn primary', type: 'button', onclick: () => { close(); scan(); } }, icon('camera', 22), 'Scan pages'),
      h('button', { class: 'btn', type: 'button', onclick: () => { close(); importInput.click(); } }, icon('image', 22), 'Import images'),
      h('button', { class: 'btn', type: 'button', onclick: () => { close(); captureInput.click(); } }, icon('camera', 22), 'Take photo'),
      h('button', { class: 'btn', type: 'button', onclick: close }, 'Close')),
  ], 'Add pages');

  // ---- shell: sidebar (wide screens), main, dock (phones)
  const tabButton = (t: (typeof TABS)[number], cls: string) => h('button', { class: cls, type: 'button', 'data-tab': t.id, onclick: () => { tab = t.id; if (store.state.currentId !== null) store.closeDoc(); else render(); } }, icon(t.icon, cls === 'tab' ? 22 : 20), cls === 'tab' ? h('span', {}, t.label) : t.label);
  const dock = h('nav', { class: 'dock', 'aria-label': 'Main' },
    h('div', { class: 'cap frost' }, ...TABS.map((t) => tabButton(t, 'tab')),
      h('button', { class: 'tab go', type: 'button', 'aria-label': 'Scan pages', onclick: () => scan() }, icon('camera', 22), h('span', {}, 'Scan'))));
  const sidebar = h('aside', { class: 'sidebar', 'aria-label': 'Main' }, h('h2', {}, 'PDF Scanner'), ...TABS.map((t) => tabButton(t, 'item')),
    h('button', { class: 'btn primary scan-side', type: 'button', 'aria-label': 'Scan pages', onclick: () => scan() }, icon('camera', 20), 'Scan'));
  const main = h('main', { class: 'page' });
  root.append(sidebar, main, dock, importInput, captureInput);

  const when = (t: number) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const sizeOf = (d: store.Doc): number => d.exports[d.exports.length - 1]?.bytes ?? 0;
  const thumbOf = (d: store.Doc): HTMLElement => {
    const first = d.pages[0];
    const img = h('img', { alt: '', draggable: 'false' });
    if (first) thumbUrl(first).then((u) => { img.src = u; }).catch(() => undefined);
    return h('span', { class: 'thumb-mini' }, first ? img : icon('document', 24));
  };

  // ---------------------------------------------------------------- PDFs tab (home)
  const tipKey = 'pdf-scanner.tip-keep';
  const list = h('ul', { class: 'group', 'aria-label': 'PDFs' });
  const search = h('input', { type: 'search', placeholder: 'Search', 'aria-label': 'Search PDFs', oninput: () => { query = search.value; paintList(); } });
  search.value = query;
  const searchBox = h('label', { class: 'search' }, icon('search', 18), search);
  const newest = h('div', { class: 'lab' }, 'Newest');
  const drafts = h('div', { class: 'drafts' });
  const homeHead = h('div', { class: 'page-head' }, h('h1', { class: 'page-title' }, 'PDFs'),
    h('button', { class: 'round frost', type: 'button', 'aria-label': 'Import images', onclick: openImport }, icon('image', 22)));
  const emptyBox = h('div', { class: 'empty' }, h('div', { class: 'big frost' }, icon('pdf', 40)), h('h2', {}, 'No PDFs yet'),
    h('p', {}, 'Scan a page or import photos. Everything stays on this device.'),
    h('button', { class: 'btn primary', type: 'button', onclick: () => scan() }, icon('camera', 22), 'Scan'),
    h('button', { class: 'btn', type: 'button', onclick: openImport }, icon('image', 22), 'Import photos'));
  const notice = h('p', { class: 'notice', hidden: true });
  const tip = h('div', { class: 'cont frost', hidden: true });

  function paintList() {
    const q = query.trim().toLowerCase();
    const pdfs = store.pdfDocs().filter((d) => !q || d.name.toLowerCase().includes(q));
    list.hidden = pdfs.length === 0; newest.hidden = list.hidden;
    list.replaceChildren(...pdfs.map((d) => {
      const n = store.docPageCount(d);
      return h('li', { class: 'row', 'data-doc': d.id }, thumbOf(d),
        h('div', { class: 'grow' }, h('b', { class: 'doc-name' }, d.name), h('small', {}, `${n} page${n === 1 ? '' : 's'} · ${formatBytes(sizeOf(d))} · ${when(d.updatedAt)}`), store.isEdited(d) ? h('span', { class: 'tag' }, 'Edited') : null),
        h('button', { class: 'open', type: 'button', 'aria-label': `Open ${d.name}`, onclick: () => store.openDoc(d.id) }),
        h('button', { class: 'icon-btn menu-btn', type: 'button', 'aria-label': `${d.name} menu`, onclick: () => openDocMenu(d) }, icon('more', 22)));
    }));
    if (q && pdfs.length === 0) list.replaceChildren(h('li', { class: 'row' }, h('div', { class: 'grow hint' }, 'No results.'))), list.hidden = false;
  }

  function renderHome(): Node[] {
    const pdfs = store.pdfDocs();
    const ds = store.draftDocs();
    drafts.replaceChildren(...ds.map((d) => {
      const n = store.docPageCount(d);
      return h('div', { class: 'cont frost', 'data-doc': d.id }, thumbOf(d),
        h('div', { class: 'grow' }, h('strong', {}, 'Continue scanning'), h('small', {}, `${n} page${n === 1 ? '' : 's'} · auto-saved`)),
        h('button', { class: 'btn', type: 'button', 'aria-label': 'Open draft', onclick: () => store.openDoc(d.id) }, 'Open'),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Discard draft', onclick: () => { const undo = store.deleteDoc(d.id); toast('Draft discarded.', { label: 'Undo', run: undo }); } }, icon('trash', 22)));
    }));
    drafts.hidden = ds.length === 0;
    searchBox.hidden = pdfs.length === 0;
    emptyBox.hidden = pdfs.length > 0 || ds.length > 0;
    paintList();
    let dismissed = false;
    try { dismissed = localStorage.getItem(tipKey) === '1'; } catch { /* ignore */ }
    tip.hidden = state.protectedStorage !== false || dismissed || store.liveDocs().length === 0;
    tip.replaceChildren(h('div', { class: 'grow' }, h('strong', {}, 'Keep your scans safe'), h('small', {}, 'Install the app (Share → Add to Home Screen) so the browser keeps your scans.')),
      h('button', { class: 'btn', type: 'button', onclick: () => { try { localStorage.setItem(tipKey, '1'); } catch { /* ignore */ } tip.hidden = true; } }, 'Got it'));
    return [homeHead, notice, tip, searchBox, drafts, newest, list, emptyBox];
  }

  // ---------------------------------------------------------------- menus
  async function renameFlow(id: string, name: string) {
    const v = await askText('Rename document', name);
    if (v) store.renameDoc(id, v);
  }
  function openDocMenu(d: store.Doc) {
    const exp = d.exports[d.exports.length - 1];
    const blob = exp ? store.pdfBlob(exp.id) : undefined;
    openSheet((close) => {
      const it = (ic: IconName, label: string, run: () => void, danger = false) => sheetItem(icon(ic, 22), label, run, close, danger);
      const n = store.docPageCount(d);
      return [h('h2', {}, d.name, h('small', {}, `${n} page${n === 1 ? '' : 's'}${exp ? ` · ${formatBytes(exp.bytes)}` : ' · draft'}`)),
        exp && blob ? it('share', 'Share', () => void shareFile(blob, `${exp.name}.pdf`)) : null,
        exp && blob ? it('download', 'Download', () => download(blob, `${exp.name}.pdf`)) : null,
        it('edit', 'Rename', () => void renameFlow(d.id, d.name)),
        exp && blob ? it('compress', 'Make smaller', () => openCompress({ file: new File([blob], `${exp.name}.pdf`, { type: 'application/pdf' }) })) : null,
        it('trash', exp ? 'Delete' : 'Discard draft', () => { const undo = store.deleteDoc(d.id); toast(`Deleted "${d.name}".`, { label: 'Undo', run: undo }); }, true)].filter(Boolean) as Node[];
    }, `${d.name} menu`);
  }
  function openPageMenu(p: PageModel, index: number, total: number) {
    openSheet((close) => {
      const it = (ic: IconName, label: string, run: () => void, danger = false, disabled = false) => { const b = sheetItem(icon(ic, 22), label, run, close, danger); b.disabled = disabled; return b; };
      return [h('h2', {}, `Page ${index + 1}`),
        it('image', 'Preview', () => openViewer(p.id)),
        it('edit', p.spread ? 'Edit spread' : 'Edit page', () => void editPage(p)),
        p.spread ? it('camera', 'Retake spread', () => scan(p.spread!.id)) : null,
        it('arrow-up', 'Move earlier', () => store.movePage(p.id, -1), false, index === 0),
        it('arrow-down', 'Move later', () => store.movePage(p.id, 1), false, index === total - 1),
        it('check-circle', 'Select', () => { selectMode = true; store.toggleSelect(p.id); }),
        it('trash', 'Delete page', () => { const r = store.removePages([p.id]); toast(`Page ${index + 1} deleted.`, { label: 'Undo', run: r.undo }); }, true)].filter(Boolean) as Node[];
    }, `Page ${index + 1} menu`);
  }
  function openFilterSheet(ids: string[]) {
    openSheet((close) => [h('h2', {}, 'Filter', h('small', {}, `${ids.length} page${ids.length === 1 ? '' : 's'}`)),
      ...FILTERS.map((f) => h('button', { class: 'item', type: 'button', onclick: () => { close(); store.editPages(ids, (p) => ({ ...p, filter: f.id as FilterName })); } }, f.label))], 'Filter for selected pages');
  }

  // ---------------------------------------------------------------- open document
  const grid = h('ul', { class: 'grid', 'aria-label': 'Pages' });
  const docEmpty = h('div', { class: 'empty' }, h('div', { class: 'big frost' }, icon('document', 40)), h('h2', {}, 'No pages yet'), h('p', {}, 'Tap Add to scan or import photos.'));
  const bar = h('div', { class: 'bar' });

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
      oncontextmenu: (e: Event) => e.preventDefault() }, img, selecting ? h('span', { class: `check${selected ? ' on' : ''}`, 'aria-hidden': 'true' }, selected ? icon('check', 14) : null) : null);
    const spreadNo = p.spread ? state.spreads.findIndex((sp) => sp.id === p.spread!.id) + 1 : 0;
    const unsure = p.spread ? !!state.spreads.find((sp) => sp.id === p.spread!.id)?.check : !!p.check;
    const pair = p.spread ? (state.pages[index + 1]?.spread?.id === p.spread.id && state.pages[index - 1]?.spread?.id !== p.spread.id ? 'first' : state.pages[index - 1]?.spread?.id === p.spread.id ? 'second' : undefined) : undefined;
    const numText = pair === 'first' ? `${index + 1}–${index + 2}` : pair === 'second' ? '' : String(index + 1);
    const label = h('span', { class: `num${numText ? '' : ' none'}` }, numText, p.spread ? h('small', { class: 'badge' }, `Spread ${spreadNo} · ${p.spread.side}`) : null, unsure ? h('small', { class: 'badge check-badge' }, 'Check') : null);
    const bar2 = h('div', { class: 'card-bar' }, label,
      selecting ? null : h('button', { class: 'icon-btn menu-btn', 'aria-label': `Page ${index + 1} menu`, onclick: () => openPageMenu(p, index, total) }, icon('more', 20)));
    return h('li', { class: 'card', 'data-id': p.id, 'data-selected': String(selected), 'data-pair': pair }, thumb, unsure ? h('span', { class: 'flag', 'aria-hidden': 'true' }) : null, bar2);
  }

  function renderBar() {
    bar.replaceChildren();
    const n = state.selection.size;
    if (state.currentId === null) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.classList.toggle('selecting', n > 0 || selectMode);
    if (state.pages.length === 0) { bar.append(h('button', { class: 'go', type: 'button', onclick: openAdd }, icon('plus', 22), 'Add pages')); return; }
    if (n === 0 && !selectMode) {
      const d = store.currentDoc();
      const edited = !!d && store.isEdited(d);
      bar.append(h('button', { class: 'add frost', type: 'button', 'aria-label': 'Add pages', onclick: openAdd }, icon('plus', 24)),
        h('button', { class: 'go', type: 'button', onclick: openExport }, edited ? 'Save changes' : `Make PDF (${state.pages.length})`));
      return;
    }
    if (n === 0) { bar.append(h('span', { class: 'hint pick' }, 'Tap pages to select them.')); return; }
    const ids = [...state.selection];
    const single = ids.filter((id) => !state.pages.find((p) => p.id === id)?.spread);
    const skipped = ids.length - single.length;
    const act = (ic: IconName, label: string, run: () => void, danger = false) => h('button', { class: `act${danger ? ' danger' : ''}`, type: 'button', onclick: run }, icon(ic, 22), label);
    bar.append(h('div', { class: 'acts frost' },
      act('crop', 'Auto-crop', async () => {
        let found = 0;
        for (const id of single) {
          const blob = store.blobOf(id); const f = blob ? await findCorners(blob) : null;
          if (f?.quad) { found++; const q = f.quad; store.editPages([id], (p) => ({ ...p, corners: q, check: f.confidence === 'high' ? undefined : true })); }
        }
        toast(`Auto-crop: ${found} of ${single.length} pages${skipped ? ', spreads skipped' : ''}.`);
      }),
      act('minus', 'Remove crop', () => { store.editPages(single, (p) => ({ ...p, corners: fullQuad(), check: undefined })); if (skipped) toast('Spreads skipped.'); }),
      act('rotate', 'Rotate', () => store.editPages(ids, (p) => ({ ...p, rotation: (p.rotation + 90) % 360 }))),
      act('tune', 'Filter', () => openFilterSheet(ids)),
      act('trash', 'Delete', () => { selectMode = false; const r = store.removePages(ids); toast(`${n} page${n === 1 ? '' : 's'} deleted.`, { label: 'Undo', run: r.undo }); }, true)));
  }

  function renderDoc(): Node[] {
    const d = store.currentDoc();
    const n = state.selection.size;
    const toCheck = state.spreads.filter((x) => x.check).length + state.pages.filter((p) => !p.spread && p.check).length;
    const sub = d ? `${state.pages.length} page${state.pages.length === 1 ? '' : 's'}${toCheck ? ` · ${toCheck} to check` : ''}${d.status === 'draft' ? ' · draft, auto-saved' : ''}` : '';
    const selecting = n > 0 || selectMode;
    const nav = h('div', { class: 'nav' },
      selecting
        ? h('button', { class: 'txt-btn', type: 'button', onclick: () => { selectMode = false; store.clearSelection(); } }, 'Done')
        : h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back to documents', onclick: () => store.closeDoc() }, icon('chevron-left', 26)),
      selecting
        ? h('div', { class: 'titles' }, h('strong', { role: 'status' }, `${n} selected`))
        : h('div', { class: 'titles' }, h('button', { class: 'rename', type: 'button', 'aria-label': 'Rename document', onclick: () => d && void renameFlow(d.id, d.name) }, h('strong', {}, d?.name ?? 'Document')), h('small', {}, sub)),
      selecting
        ? h('button', { class: 'txt-btn', type: 'button', onclick: store.selectAll }, 'Select all')
        : h('span', { class: 'nav-right' },
            state.pages.length ? h('button', { class: 'txt-btn', type: 'button', onclick: () => { selectMode = true; render(); } }, 'Select') : null,
            h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Document menu', onclick: () => d && openDocMenu(d) }, icon('more', 24))));
    const edited = d && store.isEdited(d) && !selecting
      ? h('div', { class: 'edited frost', role: 'status' }, icon('warning', 20), h('span', {}, 'Pages changed. Save to update.'), h('button', { class: 'txt-btn', type: 'button', onclick: openExport }, 'Save'))
      : null;
    grid.hidden = state.pages.length === 0; docEmpty.hidden = state.pages.length > 0;
    grid.replaceChildren(...state.pages.map((p, i) => card(p, i, state.pages.length)));
    return [nav, notice, edited, grid, docEmpty].filter(Boolean) as Node[];
  }

  function render() {
    const inDoc = state.currentId !== null;
    notice.hidden = state.persistent && state.storage === 'ok';
    notice.textContent = state.storage === 'full'
      ? 'Storage is full. Recent changes are not saved. Make your PDF now.'
      : 'Private mode: scans are lost when you close this tab. Make your PDF first.';
    main.classList.toggle('in-doc', inDoc);
    dock.hidden = inDoc;
    sidebar.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.toggleAttribute('aria-current', b.dataset.tab === tab && !inDoc));
    dock.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => { if (b.dataset.tab === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    sidebar.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => { if (b.dataset.tab === tab && !inDoc) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (inDoc) main.replaceChildren(...renderDoc());
    else if (tab === 'tools') main.replaceChildren(buildTools());
    else if (tab === 'settings') main.replaceChildren(buildSettings());
    else main.replaceChildren(...renderHome());
    renderBar();
    if (!main.contains(bar)) main.after(bar);
  }

  highlight = (id) => {
    const el = grid.querySelector(`[data-id="${id}"]`);
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
    h('p', {}, 'Your changes were saved as a draft.'),
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
        } catch { store.clearDraft(); toast('Draft could not be restored.'); }
      } }, 'Resume'))), 'Resume your edit?');
}
