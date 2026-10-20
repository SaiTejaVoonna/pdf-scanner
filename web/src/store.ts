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
export type CaptureMode = 'single' | 'spread';
export interface Settings { autoCropCamera: boolean; autoCropImport: boolean; defaultFilter: 'original' | 'enhanced'; captureMode: CaptureMode; /** Two guide lines on the single-page camera; the edge on a line is the page's anchor. */ anchorLines: boolean }
/** Unsaved editor state, kept so a reload or crash does not lose it. */
export interface Draft { kind: 'page' | 'spread' | 'newSpread'; id: string; data: unknown; savedAt: number }

const DEFAULT_SETTINGS: Settings = { autoCropCamera: true, autoCropImport: false, defaultFilter: 'original', captureMode: 'single', anchorLines: true };
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

/** Restores the working document from the previous visit (and migrates older saves, where the page id was the image key). */
export async function restore(): Promise<void> {
  try {
    const d = await db();
    const tx = d.transaction(['blobs', 'meta'], 'readonly');
    const meta = tx.objectStore('meta').get('pages');
    const spreadMeta = tx.objectStore('meta').get('spreads');
    const draftMeta = tx.objectStore('meta').get('draft');
    const keys = tx.objectStore('blobs').getAllKeys();
    const vals = tx.objectStore('blobs').getAll();
    await done(tx);
    const ids = keys.result as string[];
    ids.forEach((k, i) => blobs.set(k, vals.result[i] as Blob));
    const stored = ((meta.result as PageModel[] | undefined) ?? []).map((p) => ({ ...p, sourceId: p.sourceId ?? p.id }));
    state.pages = stored.filter((p) => blobs.has(p.sourceId));
    const spreads = (spreadMeta.result as Spread[] | undefined) ?? [];
    state.spreads = spreads.filter((s) => blobs.has(s.sourceId) && state.pages.some((p) => p.spread?.id === s.id));
    const draft = draftMeta.result as Draft | undefined;
    state.draft = draft && (draft.kind === 'newSpread' ? blobs.has(draftBlobKey(draft.id)) : state.pages.some((p) => p.id === draft.id || p.spread?.id === draft.id)) ? draft : null;
    d.close();
    notify();
  } catch { state.persistent = false; }
}

let saving: Promise<void> = Promise.resolve();
function persist(addedBlobIds: string[] = [], removedBlobIds: string[] = [], includeDraft = false): void {
  saving = saving.then(async () => {
    try {
      const d = await db();
      const tx = d.transaction(['blobs', 'meta'], 'readwrite');
      for (const id of addedBlobIds) { const b = blobs.get(id); if (b) tx.objectStore('blobs').put(b, id); }
      for (const id of removedBlobIds) tx.objectStore('blobs').delete(id);
      tx.objectStore('meta').put(JSON.parse(JSON.stringify(state.pages)), 'pages');
      tx.objectStore('meta').put(JSON.parse(JSON.stringify(state.spreads)), 'spreads');
      if (includeDraft) {
        if (state.draft) tx.objectStore('meta').put(JSON.parse(JSON.stringify(state.draft)), 'draft'); else tx.objectStore('meta').delete('draft');
      }
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
  state.pages = [...state.pages, ...pages];
  persist([sourceId]);
  notify();
  return spread;
}

const cloneGeometry = (g: SpreadGeometry): SpreadGeometry => ({ outer: g.outer.map((p) => ({ ...p })) as Quad, tTop: g.tTop, tBottom: g.tBottom });

/**
 * Changes a spread's outer corners / gutter. Unless the pages are independent, the surviving pages follow the new
 * geometry; a deleted side stays deleted.
 */
export function updateSpread(id: string, patch: Partial<SpreadGeometry & { independent: boolean }>): void {
  const current = state.spreads.find((s) => s.id === id);
  if (!current) return;
  const next: Spread = { ...current, ...patch, check: undefined, outer: patch.outer ? (patch.outer.map((p) => ({ ...p })) as Quad) : current.outer };
  state.spreads = state.spreads.map((s) => (s.id === id ? next : s));
  if (!next.independent) {
    const [left, right] = splitSpread(next);
    state.pages = state.pages.map((p) => (p.spread?.id === id ? { ...p, corners: p.spread.side === 'L' ? left : right } : p));
  }
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

/** Removes sources that no page uses any more; returns their ids. */
function dropOrphans(): string[] {
  const used = new Set(state.pages.map((p) => p.sourceId));
  const orphans = [...blobs.keys()].filter((k) => !used.has(k) && !k.startsWith(DRAFT_PREFIX));
  orphans.forEach((k) => blobs.delete(k));
  state.spreads = state.spreads.filter((s) => state.pages.some((p) => p.spread?.id === s.id));
  return orphans;
}

export function removePages(ids: Iterable<string>): void {
  const set = new Set(ids);
  state.pages = state.pages.filter((p) => !set.has(p.id));
  set.forEach((id) => state.selection.delete(id));
  persist([], dropOrphans());
  notify();
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

export function clearAll(): void {
  state.pages = [];
  state.spreads = [];
  state.selection = new Set();
  const removed = [...blobs.keys()];
  state.draft = null;
  blobs.clear();
  persist([], removed, true);
  notify();
}

// ---------------------------------------------------------------- drafts (unsaved editor state)

const DRAFT_PREFIX = 'draft:';
const draftBlobKey = (id: string): string => `${DRAFT_PREFIX}${id}`;

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
