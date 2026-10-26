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

const draftCard = (page: Page) => page.getByRole('button', { name: 'Open draft' });
async function makePdf(page: Page) {
  await page.getByRole('button', { name: /Make PDF|Save changes/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Export PDF' });
  await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Create PDF' }).click()]);
  await dlg.getByRole('button', { name: 'Keep scanning' }).click();
}

test('one draft at a time: scans go into it until the PDF is made, then the PDF is listed and the next scan starts a new draft', async ({ page }) => {
  await importN(page, 2);
  await expect(page.getByRole('button', { name: 'Rename document' })).toContainText('Scan ');
  await page.getByRole('button', { name: 'Back to documents' }).click();
  await expect(draftCard(page)).toHaveCount(1);
  await expect(page.getByText('2 pages · auto-saved')).toBeVisible();
  await expect(page.getByRole('list', { name: 'PDFs' }).locator('li')).toHaveCount(0);
  await page.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [1, 2, 3].map((i) => png(`more-${i}.png`))); // from home: continues the same draft
  await expect(page.getByRole('list', { name: 'Pages' }).locator('li')).toHaveCount(5);
  await makePdf(page);
  await page.getByRole('button', { name: 'Back to documents' }).click();
  await expect(draftCard(page)).toHaveCount(0);
  const pdfs = page.getByRole('list', { name: 'PDFs' }).locator('li');
  await expect(pdfs).toHaveCount(1);
  await expect(pdfs.first()).toContainText('5 pages');
  await importN(page, 1); // a finished PDF is closed: this starts a new draft
  await page.getByRole('button', { name: 'Back to documents' }).click();
  await expect(page.getByText('1 page · auto-saved')).toBeVisible();
  await expect(pdfs).toHaveCount(1);
  await pdfs.first().getByRole('button', { name: /^Open / }).click();
  await expect(page.getByRole('list', { name: 'Pages' }).locator('li')).toHaveCount(5);
});

test('editing a finished PDF is flagged until it is made again, and making it again replaces the file', async ({ page }) => {
  await importN(page, 2);
  await makePdf(page);
  await page.getByRole('button', { name: 'Back to documents' }).click();
  await expect(page.getByText('Edited', { exact: true })).toHaveCount(0);
  await page.getByRole('list', { name: 'PDFs' }).getByRole('button', { name: /^Open / }).click();
  await page.getByRole('button', { name: 'Page 1 menu' }).click();
  await page.getByRole('dialog', { name: 'Page 1 menu' }).getByRole('button', { name: 'Delete page' }).click();
  await page.getByRole('button', { name: 'Back to documents' }).click();
  await expect(page.getByText('Edited', { exact: true })).toBeVisible();
  await page.getByRole('list', { name: 'PDFs' }).getByRole('button', { name: /^Open / }).click();
  await makePdf(page);
  await page.getByRole('button', { name: 'Back to documents' }).click();
  await expect(page.getByRole('list', { name: 'PDFs' }).locator('li')).toHaveCount(1);
  await expect(page.getByText('Edited', { exact: true })).toHaveCount(0);
});

test('a draft can be discarded and brought back with Undo', async ({ page }) => {
  await importN(page, 2);
  await page.getByRole('button', { name: 'Back to documents' }).click();
  await page.getByRole('button', { name: 'Discard draft' }).click();
  await expect(draftCard(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(draftCard(page)).toHaveCount(1);
});

test('rename, delete with undo, recently deleted: restore and delete for good', async ({ page }) => {
  await importN(page, 1);
  await page.getByRole('button', { name: 'Rename document' }).click();
  const dlg = page.getByRole('dialog', { name: 'Rename document' });
  await dlg.getByRole('textbox').fill('Biology notes');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: 'Rename document' })).toContainText('Biology notes');
  await makePdf(page);
  await page.getByRole('button', { name: 'Back to documents' }).click();
  await page.getByRole('button', { name: 'Biology notes menu' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByText('No PDFs yet')).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /^Recently deleted/ }).click();
  const trash = page.getByRole('dialog', { name: 'Recently deleted' });
  await expect(trash.getByText('Biology notes')).toBeVisible();
  await trash.getByRole('button', { name: 'Restore' }).click();
  await trash.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: 'PDFs', exact: true }).click();
  await expect(page.getByRole('list', { name: 'PDFs' }).locator('li')).toHaveCount(1);
  // delete again and remove it for good (asks first)
  await page.getByRole('button', { name: 'Biology notes menu' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /^Recently deleted/ }).click();
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
  await expect(dlg.getByText('PDF saved')).toBeVisible();
  await dlg.getByRole('button', { name: 'Keep scanning' }).click();
  await page.getByRole('button', { name: 'Back to documents' }).click();
  await page.getByRole('list', { name: 'PDFs' }).getByRole('button', { name: / menu$/ }).click();
  const [again] = await Promise.all([page.waitForEvent('download'), page.getByRole('dialog').getByRole('button', { name: 'Download' }).click()]);
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
