import type { FilterName } from './core/filters';
import { fullQuad, type Quad } from './core/geometry';
import { splitSpread, type SpreadGeometry } from './core/spread';

/** A page of the document. Its pixels come from a shared source image (`sourceId`); everything else is a non-destructive edit. */
export interface PageModel {
  id: string; sourceId: string; w: number; h: number; corners: Quad; rotation: number; filter: FilterName;
  /** Set for the two pages cut from a book spread: which spread, and which side. */
  spread?: { id: string; side: 'L' | 'R' };
}
/** A book-spread source: one shared image that produces a left and a right page. */
export interface Spread extends SpreadGeometry {
  id: string; sourceId: string; w: number; h: number;
  /** True once the user adjusted the two pages on their own; the pages then keep their corners instead of following the spread. */
  independent: boolean;
  /** Set when a camera capture was added without the fold or outline being certain; cleared once the user adjusts it. */
  check?: boolean;
}
/** A saved PDF made from a document; the file itself is kept on this device (key `pdf:<id>`). */
export interface ExportRecord { id: string; name: string; bytes: number; pages: number; at: number }
/**
 * One scan session = one document = (eventually) one PDF. A document stays a "draft" until its first PDF is made and is saved
 * automatically all the time. The open document's pages live in `state.pages` / `state.spreads`; the others are kept here.
 */
export interface Doc {
  id: string; name: string; createdAt: number; updatedAt: number; status: 'draft' | 'done';
  pages: PageModel[]; spreads: Spread[]; exports: ExportRecord[];
  /** Set when the document was deleted: it stays in "Recently deleted" for a while and can be restored. */
  deletedAt?: number;
}
export type CaptureMode = 'single' | 'spread';
export interface Settings { autoCropCamera: boolean; autoCropImport: boolean; defaultFilter: 'original' | 'enhanced'; captureMode: CaptureMode; /** Right-to-left books: the right page of a spread comes first. */ bookRtl: boolean; /** Two guide lines on the single-page camera; the edge on a line is the page's anchor. */ guideLines: boolean }
/** Unsaved editor state, kept so a reload or crash does not lose it. */
export interface Draft { kind: 'page' | 'spread' | 'newSpread'; id: string; data: unknown; savedAt: number }

const DEFAULT_SETTINGS: Settings = { autoCropCamera: true, autoCropImport: false, defaultFilter: 'original', captureMode: 'single', bookRtl: false, guideLines: false };
const SETTINGS_KEY = 'pdf-scanner.settings';

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());
export const subscribe = (l: Listener): (() => void) => { listeners.add(l); return () => listeners.delete(l); };

export const state = {
  pages: [] as PageModel[],
  spreads: [] as Spread[],
  selection: new Set<string>(),
  settings: loadSettings(),
  /** False when IndexedDB is unavailable (e.g. some private modes): scans then live only until the tab closes. */
  persistent: true,
  /** 'full' when the browser refused a save for lack of space: the document is still in memory and can be exported. */
  storage: 'ok' as 'ok' | 'full',
  /** Unsaved editor state found at startup (or saved while editing). */
  draft: null as Draft | null,
  /** Every document (the open one's pages are in `pages`/`spreads` above). */
  docs: [] as Doc[],
  /** The open document, or null on the documents list. */
  currentId: null as string | null,
  /** Whether the browser promises to keep the scans (persistent storage or an installed app); null until known. */
  protectedStorage: null as boolean | null,
};
/** Source images by source id (several pages can share one). */
const blobs = new Map<string, Blob>();

function loadSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }; } catch { return { ...DEFAULT_SETTINGS }; }
}
export function updateSettings(patch: Partial<Settings>): void {
  state.settings = { ...state.settings, ...patch };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); } catch { /* storage unavailable */ }
  notify();
}

/** The source image behind a page. */
export const blobOf = (pageId: string): Blob | undefined => {
  const page = state.pages.find((p) => p.id === pageId);
  return page ? blobs.get(page.sourceId) : undefined;
};
export const sourceBlob = (sourceId: string): Blob | undefined => blobs.get(sourceId);
export const pagesOfSpread = (spreadId: string): PageModel[] => state.pages.filter((p) => p.spread?.id === spreadId);
export const newId = (): string => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

// ---------------------------------------------------------------- persistence (IndexedDB)

const DB = 'pdf-scanner';
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('blobs'); req.result.createObjectStore('meta'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });

const TRASH_DAYS = 30;
const PDF_PREFIX = 'pdf:';
const DRAFT_PREFIX = 'draft:';
const draftBlobKey = (id: string): string => `${DRAFT_PREFIX}${id}`;
const scanName = (d = new Date()): string => { const p = (n: number) => String(n).padStart(2, '0'); return `Scan ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}.${p(d.getMinutes())}`; };

/** Restores the documents from the previous visit (and migrates older saves: one working list, or a page id used as the image key). */
export async function restore(): Promise<void> {
  try {
    const d = await db();
    const tx = d.transaction(['blobs', 'meta'], 'readonly');
    const docsMeta = tx.objectStore('meta').get('docs');
    const currentMeta = tx.objectStore('meta').get('current');
    const meta = tx.objectStore('meta').get('pages');
    const spreadMeta = tx.objectStore('meta').get('spreads');
    const draftMeta = tx.objectStore('meta').get('draft');
    const keys = tx.objectStore('blobs').getAllKeys();
    const vals = tx.objectStore('blobs').getAll();
    await done(tx);
    d.close();
    (keys.result as string[]).forEach((k, i) => blobs.set(k, vals.result[i] as Blob));
    let docs = (docsMeta.result as Doc[] | undefined) ?? [];
    if (docs.length === 0) {
      // Older versions kept one list of pages: it becomes the first document.
      const stored = ((meta.result as PageModel[] | undefined) ?? []).map((p) => ({ ...p, sourceId: p.sourceId ?? p.id }));
      if (stored.length) docs = [{ id: newId(), name: 'Earlier scans', createdAt: Date.now(), updatedAt: Date.now(), status: 'draft', pages: stored, spreads: (spreadMeta.result as Spread[] | undefined) ?? [], exports: [] }];
    }
    const now = Date.now();
    docs = docs.filter((x) => !x.deletedAt || now - x.deletedAt < TRASH_DAYS * 86400000).map((x) => {
      const pages = x.pages.filter((p) => blobs.has(p.sourceId));
      return { ...x, exports: x.exports ?? [], pages, spreads: x.spreads.filter((sp) => blobs.has(sp.sourceId) && pages.some((p) => p.spread?.id === sp.id)) };
    });
    state.docs = docs;
    const legacy = docsMeta.result === undefined && docs.length > 0; // first start after the upgrade: open the migrated document as before
    const cur = legacy ? docs[0].id : (currentMeta.result as string | null | undefined) ?? null;
    const open = docs.find((x) => x.id === cur && !x.deletedAt);
    state.currentId = open?.id ?? null;
    state.pages = open?.pages ?? [];
    state.spreads = open?.spreads ?? [];
    const draft = draftMeta.result as Draft | undefined;
    state.draft = draft && (draft.kind === 'newSpread' ? blobs.has(draftBlobKey(draft.id)) : state.pages.some((p) => p.id === draft.id || p.spread?.id === draft.id)) ? draft : null;
    // Photos nobody uses any more (left behind by a closed tab during an undo window, or by an old version) are freed.
    const orphans = dropOrphans();
    if (orphans.length || (docsMeta.result === undefined && docs.length)) persist([], orphans);
    notify();
  } catch { state.persistent = false; }
}

/** Copies the open document's live arrays back into its record. */
function syncCurrent(): void {
  const d = state.docs.find((x) => x.id === state.currentId);
  if (d) { d.pages = state.pages; d.spreads = state.spreads; d.updatedAt = Date.now(); }
}

let saving: Promise<void> = Promise.resolve();
function persist(addedBlobIds: string[] = [], removedBlobIds: string[] = [], includeDraft = false): void {
  syncCurrent();
  const docs = JSON.parse(JSON.stringify(state.docs)) as Doc[];
  const draft = state.draft ? (JSON.parse(JSON.stringify(state.draft)) as Draft) : null;
  const currentId = state.currentId;
  saving = saving.then(async () => {
    try {
      const d = await db();
      const tx = d.transaction(['blobs', 'meta'], 'readwrite');
      for (const id of addedBlobIds) { const b = blobs.get(id); if (b) tx.objectStore('blobs').put(b, id); }
      for (const id of removedBlobIds) tx.objectStore('blobs').delete(id);
      tx.objectStore('meta').put(docs, 'docs');
      tx.objectStore('meta').put(currentId, 'current');
      tx.objectStore('meta').delete('pages');
      tx.objectStore('meta').delete('spreads');
      if (includeDraft) { if (draft) tx.objectStore('meta').put(draft, 'draft'); else tx.objectStore('meta').delete('draft'); }
      await done(tx);
      d.close();
      if (state.storage !== 'ok') { state.storage = 'ok'; notify(); }
    } catch (e) {
      const name = (e as { name?: string } | null)?.name;
      if (name === 'QuotaExceededError') state.storage = 'full'; else state.persistent = false;
      notify();
    }
  });
}
export const whenSaved = (): Promise<void> => saving;

// ---------------------------------------------------------------- operations

export function addPage(blob: Blob, w: number, h: number, corners: Quad = fullQuad()): PageModel {
  ensureDoc();
  const sourceId = newId();
  const page: PageModel = { id: newId(), sourceId, w, h, corners, rotation: 0, filter: state.settings.defaultFilter };
  blobs.set(sourceId, blob);
  state.pages = [...state.pages, page];
  persist([sourceId]);
  notify();
  return page;
}

/** Adds one shared source and its two derived pages (left, then right) to the end of the document. */
export function addSpread(blob: Blob, w: number, h: number, geometry: SpreadGeometry, check = false): Spread {
  ensureDoc();
  const sourceId = newId();
  const spread: Spread = { id: newId(), sourceId, w, h, ...cloneGeometry(geometry), independent: false, ...(check ? { check: true } : {}) };
  const [left, right] = splitSpread(spread);
  const filter = state.settings.defaultFilter;
  const pages: PageModel[] = [
    { id: newId(), sourceId, w, h, corners: left, rotation: 0, filter, spread: { id: spread.id, side: 'L' } },
    { id: newId(), sourceId, w, h, corners: right, rotation: 0, filter, spread: { id: spread.id, side: 'R' } },
  ];
  blobs.set(sourceId, blob);
  state.spreads = [...state.spreads, spread];
  state.pages = [...state.pages, ...(state.settings.bookRtl ? [pages[1], pages[0]] : pages)];
  persist([sourceId]);
  notify();
  return spread;
}

const cloneGeometry = (g: SpreadGeometry): SpreadGeometry => ({ outer: g.outer.map((p) => ({ ...p })) as Quad, tTop: g.tTop, tBottom: g.tBottom });

/**
 * Changes a spread's outer corners / gutter. Unless the pages are independent, the surviving pages follow the new
 * geometry; a deleted side stays deleted.
 */
export function updateSpread(id: string, patch: Partial<SpreadGeometry & { independent: boolean; check: boolean }>): void {
  const current = state.spreads.find((s) => s.id === id);
  if (!current) return;
  const next: Spread = { ...current, ...patch, check: patch.check ? true : undefined, outer: patch.outer ? (patch.outer.map((p) => ({ ...p })) as Quad) : current.outer };
  state.spreads = state.spreads.map((s) => (s.id === id ? next : s));
  if (!next.independent) {
    const [left, right] = splitSpread(next);
    state.pages = state.pages.map((p) => (p.spread?.id === id ? { ...p, corners: p.spread.side === 'L' ? left : right } : p));
  }
  persist();
  notify();
}

/** Marks or clears the "Check" flag of a spread without touching its geometry. */
export function setSpreadCheck(id: string, check: boolean): void {
  const s = state.spreads.find((x) => x.id === id);
  if (!s || !!s.check === check) return;
  state.spreads = state.spreads.map((x) => (x.id === id ? { ...x, check: check || undefined } : x));
  persist();
  notify();
}

/**
 * Replaces the source of an existing spread with a new capture, keeping its pages (ids, positions, filters). Pages that
 * were deleted are not brought back. Call this only once the user has confirmed the new capture; cancelling a retake
 * simply never calls it.
 */
export function retakeSpread(id: string, blob: Blob, w: number, h: number, geometry: SpreadGeometry): void {
  const current = state.spreads.find((s) => s.id === id);
  if (!current) return;
  blobs.set(current.sourceId, blob);
  const next: Spread = { ...current, w, h, ...cloneGeometry(geometry), independent: false };
  state.spreads = state.spreads.map((s) => (s.id === id ? next : s));
  const [left, right] = splitSpread(next);
  state.pages = state.pages.map((p) => (p.spread?.id === id ? { ...p, w, h, corners: p.spread.side === 'L' ? left : right, rotation: 0 } : p));
  persist([current.sourceId]);
  notify();
}

/** Applies `fn` to the given pages (all pages when `ids` is omitted). */
export function editPages(ids: Iterable<string>, fn: (p: PageModel) => PageModel): void {
  const set = new Set(ids);
  state.pages = state.pages.map((p) => (set.has(p.id) ? fn(p) : p));
  persist();
  notify();
}

/** Source images (and photos) kept alive for a moment so that a delete can still be undone. */
const holds = new Map<string, number>();
const hold = (ids: string[]) => ids.forEach((k) => holds.set(k, (holds.get(k) ?? 0) + 1));
const release = (ids: string[]) => ids.forEach((k) => { const n = (holds.get(k) ?? 0) - 1; if (n > 0) holds.set(k, n); else holds.delete(k); });

/** Removes sources that no page of any document, no saved PDF and no draft uses any more; returns their ids. */
function dropOrphans(): string[] {
  syncCurrent();
  const used = new Set<string>();
  for (const d of state.docs) for (const p of d.pages) used.add(p.sourceId);
  for (const p of state.pages) used.add(p.sourceId);
  const orphans = [...blobs.keys()].filter((k) => !used.has(k) && !holds.has(k) && !k.startsWith(DRAFT_PREFIX) && !k.startsWith(PDF_PREFIX));
  orphans.forEach((k) => blobs.delete(k));
  state.spreads = state.spreads.filter((s) => state.pages.some((p) => p.spread?.id === s.id));
  return orphans;
}
/** Undo window after a delete: the photos are only freed once it has passed. */
export const UNDO_MS = 15_000;
const pendingSweeps = new Set<() => void>();
/** Frees what is still held for undo right away (used by tests and when the tab is closing). */
export const flushRemovals = (): void => { [...pendingSweeps].forEach((f) => f()); };

export interface Removal { /** Puts the removed pages back where they were. */ undo: () => void }

export function removePages(ids: Iterable<string>): Removal {
  const set = new Set(ids);
  const gone = state.pages.map((p, i) => ({ p, i })).filter((x) => set.has(x.p.id));
  const spreadsBefore = state.spreads;
  const docId = state.currentId;
  const sources = [...new Set(gone.map((x) => x.p.sourceId))];
  hold(sources);
  state.pages = state.pages.filter((p) => !set.has(p.id));
  state.spreads = state.spreads.filter((s) => state.pages.some((p) => p.spread?.id === s.id));
  set.forEach((id) => state.selection.delete(id));
  persist();
  notify();
  let settled = false;
  const sweep = () => { if (settled) return; settled = true; clearTimeout(timer); pendingSweeps.delete(sweep); release(sources); const orphans = dropOrphans(); if (orphans.length) persist([], orphans); };
  const timer = setTimeout(sweep, UNDO_MS);
  pendingSweeps.add(sweep);
  return {
    undo: () => {
      if (settled || state.currentId !== docId) return;
      settled = true; clearTimeout(timer); pendingSweeps.delete(sweep); release(sources);
      const pages = [...state.pages];
      for (const { p, i } of gone) pages.splice(Math.min(i, pages.length), 0, p);
      state.pages = pages;
      const have = new Set(state.spreads.map((s) => s.id));
      state.spreads = [...state.spreads, ...spreadsBefore.filter((s) => !have.has(s.id) && pages.some((p) => p.spread?.id === s.id))];
      persist();
      notify();
    },
  };
}

export function movePage(id: string, delta: number): void {
  const from = state.pages.findIndex((p) => p.id === id);
  const to = Math.min(state.pages.length - 1, Math.max(0, from + delta));
  if (from < 0 || from === to) return;
  const next = [...state.pages];
  next.splice(to, 0, next.splice(from, 1)[0]);
  state.pages = next;
  persist();
  notify();
}

export function toggleSelect(id: string): void {
  if (!state.selection.delete(id)) state.selection.add(id);
  notify();
}
export const selectAll = (): void => { state.selection = new Set(state.pages.map((p) => p.id)); notify(); };
export const clearSelection = (): void => { state.selection = new Set(); notify(); };

/** Wipes everything on this device: all documents, photos and saved PDFs. */
export function clearAll(): void {
  state.pages = [];
  state.spreads = [];
  state.selection = new Set();
  state.docs = [];
  state.currentId = null;
  const removed = [...blobs.keys()];
  state.draft = null;
  blobs.clear();
  holds.clear();
  persist([], removed, true);
  notify();
}

// ---------------------------------------------------------------- documents

const current = (): Doc | undefined => state.docs.find((d) => d.id === state.currentId);
export const liveDocs = (): Doc[] => state.docs.filter((d) => !d.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt);
export const trashedDocs = (): Doc[] => state.docs.filter((d) => d.deletedAt).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
export const currentDoc = (): Doc | undefined => { const d = current(); if (d) syncCurrent(); return d; };
/** Page count of any document (the open one is read live). */
export const docPageCount = (d: Doc): number => (d.id === state.currentId ? state.pages.length : d.pages.length);

function resetOpen(): void { state.pages = []; state.spreads = []; state.selection = new Set(); }

/** Starts a new document and opens it. */
export function newDoc(name = scanName()): Doc {
  syncCurrent();
  const d: Doc = { id: newId(), name, createdAt: Date.now(), updatedAt: Date.now(), status: 'draft', pages: [], spreads: [], exports: [] };
  state.docs = [...state.docs, d];
  state.currentId = d.id;
  resetOpen();
  persist();
  notify();
  return d;
}
/** The open document, creating one when none is open (so adding a photo from the list starts a new document). */
export function ensureDoc(): Doc { return current() ?? newDoc(); }

export function openDoc(id: string): void {
  const d = state.docs.find((x) => x.id === id && !x.deletedAt);
  if (!d) return;
  syncCurrent();
  state.currentId = d.id;
  state.pages = d.pages; state.spreads = d.spreads; state.selection = new Set();
  persist();
  notify();
}

/** Back to the list. An empty document that was never exported is dropped instead of left behind. */
export function closeDoc(): void {
  syncCurrent();
  const d = current();
  if (d && d.pages.length === 0 && d.exports.length === 0) state.docs = state.docs.filter((x) => x.id !== d.id);
  state.currentId = null;
  resetOpen();
  persist([], dropOrphans());
  notify();
}

export function renameDoc(id: string, name: string): void {
  const d = state.docs.find((x) => x.id === id);
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 100);
  if (!d || !clean) return;
  d.name = clean; d.updatedAt = Date.now();
  persist();
  notify();
}

/** Moves a document to "Recently deleted"; the returned function brings it back. */
export function deleteDoc(id: string): () => void {
  if (id === state.currentId) { syncCurrent(); state.currentId = null; resetOpen(); }
  const d = state.docs.find((x) => x.id === id);
  if (d) d.deletedAt = Date.now();
  persist();
  notify();
  return () => restoreDoc(id);
}
export function restoreDoc(id: string): void {
  const d = state.docs.find((x) => x.id === id);
  if (d) { delete d.deletedAt; persist(); notify(); }
}
/** Deletes a document for good, with its photos and saved PDFs. */
export function purgeDoc(id: string): void {
  const d = state.docs.find((x) => x.id === id);
  if (!d) return;
  state.docs = state.docs.filter((x) => x.id !== id);
  const pdfKeys = d.exports.map((e) => `${PDF_PREFIX}${e.id}`);
  pdfKeys.forEach((k) => blobs.delete(k));
  persist([], [...dropOrphans(), ...pdfKeys]);
  notify();
}
export function emptyTrash(): void { trashedDocs().forEach((d) => purgeDoc(d.id)); }

/** Keeps the PDF that was just made with its document, which is no longer a draft. */
export function recordExport(name: string, bytes: Uint8Array, pages: number): void {
  const d = ensureDoc();
  const id = newId();
  blobs.set(`${PDF_PREFIX}${id}`, new Blob([bytes as BlobPart], { type: 'application/pdf' }));
  d.exports = [...d.exports, { id, name, bytes: bytes.length, pages, at: Date.now() }];
  d.status = 'done';
  if (/^Scan \d{4}-\d{2}-\d{2}/.test(d.name)) d.name = name; // a document still called by its date takes the PDF's name
  persist([`${PDF_PREFIX}${id}`]);
  notify();
}
export const pdfBlob = (exportId: string): Blob | undefined => blobs.get(`${PDF_PREFIX}${exportId}`);
export function removeExport(docId: string, exportId: string): void {
  const d = state.docs.find((x) => x.id === docId);
  if (!d) return;
  d.exports = d.exports.filter((e) => e.id !== exportId);
  const key = `${PDF_PREFIX}${exportId}`;
  blobs.delete(key);
  persist([], [key]);
  notify();
}

// ---------------------------------------------------------------- drafts (unsaved editor state)

/** Remembers an editor's unsaved state. For a brand-new spread capture the shot itself is kept too. */
export function saveDraft(draft: Omit<Draft, 'savedAt'>, source?: Blob): void {
  state.draft = { ...draft, savedAt: Date.now() };
  const added: string[] = [];
  if (source) { blobs.set(draftBlobKey(draft.id), source); added.push(draftBlobKey(draft.id)); }
  persist(added, [], true);
}

export function clearDraft(): void {
  const old = state.draft;
  state.draft = null;
  const removed = old?.kind === 'newSpread' ? [draftBlobKey(old.id)] : [];
  removed.forEach((k) => blobs.delete(k));
  persist([], removed, true);
}

export const draftSource = (id: string): Blob | undefined => blobs.get(draftBlobKey(id));

export function setProtectedStorage(v: boolean): void { state.protectedStorage = v; notify(); }
