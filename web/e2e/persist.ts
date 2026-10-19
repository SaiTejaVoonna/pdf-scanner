import { expect, type Page } from '@playwright/test';

/** Waits until IndexedDB really holds `count` pages (saving is asynchronous, and a reload right after an edit can beat it on a slow runner). */
export async function pagesPersisted(page: Page, count: number) {
  await expect.poll(() => page.evaluate(() => new Promise<number>((res) => {
    const r = indexedDB.open('pdf-scanner', 1);
    r.onsuccess = () => { const g = r.result.transaction('meta').objectStore('meta').get('pages'); g.onsuccess = () => { r.result.close(); res(Array.isArray(g.result) ? g.result.length : 0); }; g.onerror = () => res(-1); };
    r.onerror = () => res(-1);
  })), { timeout: 15_000 }).toBe(count);
}

/** Waits until the saved editor draft has been deleted from IndexedDB. */
export async function draftGone(page: Page) {
  await expect.poll(() => page.evaluate(() => new Promise<boolean>((res) => {
    const r = indexedDB.open('pdf-scanner', 1);
    r.onsuccess = () => { const g = r.result.transaction('meta').objectStore('meta').get('draft'); g.onsuccess = () => { r.result.close(); res(g.result === undefined); }; g.onerror = () => res(false); };
    r.onerror = () => res(false);
  })), { timeout: 15_000 }).toBe(true);
}
