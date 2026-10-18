import type { FilterName } from './core/filters';
import { fullQuad, type Quad } from './core/geometry';

export interface PageModel { id: string; w: number; h: number; corners: Quad; rotation: number; filter: FilterName }
export interface Settings { autoCropCamera: boolean; autoCropImport: boolean; defaultFilter: 'original' | 'enhanced' }

const DEFAULT_SETTINGS: Settings = { autoCropCamera: true, autoCropImport: false, defaultFilter: 'original' };
const SETTINGS_KEY = 'pdf-scanner.settings';

type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());
export const subscribe = (l: Listener): (() => void) => { listeners.add(l); return () => listeners.delete(l); };

export const state = {
  pages: [] as PageModel[],
  selection: new Set<string>(),
  settings: loadSettings(),
  /** False when IndexedDB is unavailable (e.g. some private modes): scans then live only until the tab closes. */
  persistent: true,
};
const blobs = new Map<string, Blob>();

function loadSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') }; } catch { return { ...DEFAULT_SETTINGS }; }
}
export function updateSettings(patch: Partial<Settings>): void {
  state.settings = { ...state.settings, ...patch };
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings)); } catch { /* storage unavailable */ }
  notify();
}

export const blobOf = (id: string): Blob | undefined => blobs.get(id);
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

/** Restores the working document from the previous visit. */
export async function restore(): Promise<void> {
  try {
    const d = await db();
    const tx = d.transaction(['blobs', 'meta'], 'readonly');
    const meta = tx.objectStore('meta').get('pages');
    const keys = tx.objectStore('blobs').getAllKeys();
    const vals = tx.objectStore('blobs').getAll();
    await done(tx);
    const stored = (meta.result as PageModel[] | undefined) ?? [];
    const ids = keys.result as string[];
    ids.forEach((k, i) => blobs.set(k, vals.result[i] as Blob));
    state.pages = stored.filter((p) => blobs.has(p.id));
    d.close();
    notify();
  } catch { state.persistent = false; }
}

let saving: Promise<void> = Promise.resolve();
function persist(addedBlobIds: string[] = [], removedBlobIds: string[] = []): void {
  saving = saving.then(async () => {
    try {
      const d = await db();
      const tx = d.transaction(['blobs', 'meta'], 'readwrite');
      for (const id of addedBlobIds) { const b = blobs.get(id); if (b) tx.objectStore('blobs').put(b, id); }
      for (const id of removedBlobIds) tx.objectStore('blobs').delete(id);
      tx.objectStore('meta').put(JSON.parse(JSON.stringify(state.pages)), 'pages');
      await done(tx);
      d.close();
    } catch { state.persistent = false; }
  });
}
export const whenSaved = (): Promise<void> => saving;

// ---------------------------------------------------------------- operations

export function addPage(blob: Blob, w: number, h: number, corners: Quad = fullQuad()): PageModel {
  const page: PageModel = { id: newId(), w, h, corners, rotation: 0, filter: state.settings.defaultFilter };
  blobs.set(page.id, blob);
  state.pages = [...state.pages, page];
  persist([page.id]);
  notify();
  return page;
}

/** Applies `fn` to the given pages (all pages when `ids` is omitted). */
export function editPages(ids: Iterable<string>, fn: (p: PageModel) => PageModel): void {
  const set = new Set(ids);
  state.pages = state.pages.map((p) => (set.has(p.id) ? fn(p) : p));
  persist();
  notify();
}

export function removePages(ids: Iterable<string>): void {
  const set = new Set(ids);
  state.pages = state.pages.filter((p) => !set.has(p.id));
  set.forEach((id) => { blobs.delete(id); state.selection.delete(id); });
  persist([], [...set]);
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
  const ids = state.pages.map((p) => p.id);
  state.pages = [];
  state.selection = new Set();
  ids.forEach((id) => blobs.delete(id));
  persist([], ids);
  notify();
}
