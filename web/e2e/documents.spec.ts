import { expect, test, type Page } from '@playwright/test';
import { pagesPersisted } from './persist';
import { pagePng } from './helpers';

const png = (name: string) => ({ name, mimeType: 'image/png', buffer: pagePng() });
async function importN(page: Page, n: number) {
  await page.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', Array.from({ length: n }, (_, i) => png(`scan-${i + 1}.png`)));
  await expect(page.getByRole('list', { name: 'Pages' }).locator('li')).toHaveCount(n);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('pdf-scanner.auto', 'off'); } catch { /* ignore */ } });
  await page.goto('/');
});

test('each scan session is its own document: they do not mix, and the list shows them', async ({ page }) => {
  await importN(page, 2);
  await expect(page.getByRole('button', { name: 'Rename document' })).toContainText('Scan ');
  await page.getByRole('button', { name: 'Back to documents' }).click();
  await expect(page.getByRole('list', { name: 'Documents' }).locator('li')).toHaveCount(1);
  await importN(page, 3); // from the list: a new document, not added to the old one
  await page.getByRole('button', { name: 'Back to documents' }).click();
  const docs = page.getByRole('list', { name: 'Documents' }).locator('li');
  await expect(docs).toHaveCount(2);
  await expect(docs.filter({ hasText: '2 pages' })).toHaveCount(1);
  await expect(docs.filter({ hasText: '3 pages' })).toHaveCount(1);
  await docs.filter({ hasText: '2 pages' }).getByRole('button', { name: /^Open / }).click();
  await expect(page.getByRole('list', { name: 'Pages' }).locator('li')).toHaveCount(2);
});

test('rename, delete with undo, recently deleted: restore and delete for good', async ({ page }) => {
  await importN(page, 1);
  await page.getByRole('button', { name: 'Rename document' }).click();
  const dlg = page.getByRole('dialog', { name: 'Rename document' });
  await dlg.getByRole('textbox').fill('Biology notes');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Rename document' })).toContainText('Biology notes');
  await page.getByRole('button', { name: 'Back to documents' }).click();
  await page.getByRole('button', { name: 'Biology notes menu' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete document' }).click();
  await expect(page.getByText('No documents yet')).toBeVisible();
  await page.getByRole('button', { name: /Recently deleted \(1\)/ }).click();
  const trash = page.getByRole('dialog', { name: 'Recently deleted' });
  await expect(trash.getByText('Biology notes')).toBeVisible();
  await trash.getByRole('button', { name: 'Restore' }).click();
  await trash.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('list', { name: 'Documents' }).locator('li')).toHaveCount(1);
  // delete again and remove it for good (asks first)
  await page.getByRole('button', { name: 'Biology notes menu' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete document' }).click();
  await page.getByRole('button', { name: /Recently deleted \(1\)/ }).click();
  await page.getByRole('dialog', { name: 'Recently deleted' }).getByRole('button', { name: /Delete Biology notes for good/ }).click();
  await page.getByRole('dialog', { name: 'Delete for good?' }).getByRole('button', { name: 'Delete for good' }).click();
  await expect(page.getByRole('dialog', { name: 'Recently deleted' }).getByText('Nothing here.')).toBeVisible();
});

test('deleting a page can be undone (no browser pop-up)', async ({ page }) => {
  await importN(page, 3);
  await page.getByRole('button', { name: 'Page 2 menu' }).click();
  await page.getByRole('dialog', { name: 'Page 2 menu' }).getByRole('button', { name: 'Delete page' }).click();
  await expect(page.getByRole('list', { name: 'Pages' }).locator('li')).toHaveCount(2);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('list', { name: 'Pages' }).locator('li')).toHaveCount(3);
});

test('the PDF that was made is kept with its document and can be downloaded again', async ({ page }) => {
  await importN(page, 2);
  await page.getByRole('button', { name: /Make PDF/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Export PDF' });
  const [first] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Create PDF' }).click()]);
  expect(first.suggestedFilename()).toMatch(/\.pdf$/);
  await dlg.getByRole('button', { name: 'Keep scanning' }).click();
  await expect(page.getByText('Saved PDFs')).toBeVisible();
  await expect(page.getByText('PDF made').first()).toBeVisible();
  const [again] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Download / }).click()]);
  expect(again.suggestedFilename()).toBe(first.suggestedFilename());
});

test('scans saved by the previous version (one list of pages) become the first document', async ({ page }) => {
  // Write the old storage format, then reload.
  await page.evaluate(async (b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('pdf-scanner', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(['blobs', 'meta'], 'readwrite');
      tx.objectStore('blobs').put(new Blob([bytes], { type: 'image/png' }), 'old1');
      tx.objectStore('meta').delete('docs'); tx.objectStore('meta').delete('current');
      tx.objectStore('meta').put([{ id: 'p1', sourceId: 'old1', w: 600, h: 800, corners: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }], rotation: 0, filter: 'original' }], 'pages');
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, pagePng().toString('base64'));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Rename document' })).toContainText('Earlier scans');
  await expect(page.getByRole('list', { name: 'Pages' }).locator('li')).toHaveCount(1);
  await pagesPersisted(page, 1);
});
