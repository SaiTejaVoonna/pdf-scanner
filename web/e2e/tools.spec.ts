import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { PDFDocument } from 'pdf-lib';
import { pagePng } from './helpers';

test.beforeEach(async ({ page }) => { await page.goto('/'); });

async function openTool(page: Page, name: string) {
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('dialog', { name: 'Tools' }).getByRole('button', { name: new RegExp(name) }).click();
}
async function readDownload(dl: import('@playwright/test').Download): Promise<Buffer> {
  const chunks: Buffer[] = []; for await (const c of await dl.createReadStream()) chunks.push(c as Buffer); return Buffer.concat(chunks);
}
/** A "scan": a PDF whose pages are big, noisy JPEGs (made with the browser's own encoder). */
async function scanPdf(page: Page, pages: number): Promise<Buffer> {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 1600;
    const g = c.getContext('2d')!; const d = g.createImageData(1200, 1600);
    for (let i = 0; i < d.data.length; i += 4) { const v = 120 + Math.floor(Math.random() * 120); d.data[i] = v; d.data[i + 1] = v - 10; d.data[i + 2] = v - 20; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
    const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.95));
    const bytes = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (const x of bytes) s += String.fromCharCode(x); return btoa(s);
  });
  const doc = await PDFDocument.create();
  const jpg = await doc.embedJpg(Buffer.from(b64, 'base64'));
  for (let i = 0; i < pages; i++) doc.addPage([300, 400]).drawImage(jpg, { x: 0, y: 0, width: 300, height: 400 });
  return Buffer.from(await doc.save());
}

test('the Tools hub lists the four tools, and each one opens', async ({ page }) => {
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  const hub = page.getByRole('dialog', { name: 'Tools' });
  for (const t of ['Compress PDF', 'Resize photo', 'Combine PDFs', 'Split PDF']) await expect(hub.getByRole('button', { name: new RegExp(t) })).toBeVisible();
  await hub.getByRole('button', { name: /Split PDF/ }).click();
  await expect(page.getByRole('dialog', { name: 'Split PDF' })).toBeVisible();
});

test('Compress PDF makes a scanned PDF smaller, keeps every page, and says so honestly for a text-only PDF', async ({ page }) => {
  const pdf = await scanPdf(page, 2);
  await openTool(page, 'Compress PDF');
  const dlg = page.getByRole('dialog', { name: 'Compress PDF' });
  await dlg.locator('input[type=file]').setInputFiles({ name: 'scan.pdf', mimeType: 'application/pdf', buffer: pdf });
  await dlg.getByRole('radio', { name: '500 KB' }).click();
  await dlg.getByRole('button', { name: 'Make smaller' }).click();
  await expect(dlg.getByRole('status')).toContainText('→', { timeout: 60_000 });
  const [dl] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Download' }).click()]);
  expect(dl.suggestedFilename()).toBe('scan-smaller.pdf');
  const out = await readDownload(dl);
  expect(out.length).toBeLessThan(pdf.length);
  expect((await PDFDocument.load(out)).getPageCount()).toBe(2);

  const text = await PDFDocument.create(); text.addPage([100, 100]);
  await dlg.locator('input[type=file]').setInputFiles({ name: 'text.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await text.save()) });
  await dlg.getByRole('button', { name: 'Make smaller' }).click();
  await expect(dlg.getByRole('status')).toContainText('no photos to shrink');
});

test('Split PDF keeps the chosen pages, rejects pages that do not exist, and can save every page in a ZIP', async ({ page }) => {
  const doc = await PDFDocument.create(); for (let i = 0; i < 4; i++) doc.addPage([200 + i, 300]);
  const buffer = Buffer.from(await doc.save());
  await openTool(page, 'Split PDF');
  const dlg = page.getByRole('dialog', { name: 'Split PDF' });
  await dlg.locator('input[type=file]').setInputFiles({ name: 'four.pdf', mimeType: 'application/pdf', buffer });
  await expect(dlg).toContainText('4 pages');
  await dlg.getByLabel('Pages to keep').fill('9');
  await dlg.getByRole('button', { name: 'Save' }).click();
  await expect(dlg.getByRole('status')).toContainText('outside it');
  await dlg.getByLabel('Pages to keep').fill('2-3');
  const [dl] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Save' }).click()]);
  const out = await PDFDocument.load(await readDownload(dl));
  expect(out.getPageCount()).toBe(2);
  expect(out.getPage(0).getWidth()).toBe(201);
  await dlg.getByRole('radio', { name: 'Every page on its own' }).click();
  const [zip] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Save' }).click()]);
  expect(execFileSync('unzip', ['-t', await zip.path()]).toString()).toContain('No errors detected');
});

test('Resize photo: a form preset gives the exact size, millimetres use the DPI, and a minimum file size is reached', async ({ page }) => {
  await openTool(page, 'Resize photo');
  const dlg = page.getByRole('dialog', { name: 'Resize photo' });
  await dlg.locator('input[type=file]').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: pagePng(900, 1200) });
  await dlg.getByRole('radio', { name: 'Exact size' }).click();
  await dlg.getByRole('radio', { name: /Passport 35×45 mm/ }).click();
  await expect(dlg.getByLabel('DPI (dots per inch)')).toBeVisible();
  await dlg.getByLabel('Smallest file (KB)').fill('20');
  await dlg.getByLabel('Largest file (KB)').fill('60');
  await dlg.getByRole('button', { name: 'Resize', exact: true }).click();
  const row = dlg.getByRole('list', { name: 'Resized images' }).locator('li').first();
  await expect(row).toContainText('413×531');
  const [dl] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Download me-resized.jpg' }).click()]);
  const jpg = await readDownload(dl);
  expect(jpg.length).toBeGreaterThanOrEqual(20 * 1024);
  expect(jpg.length).toBeLessThanOrEqual(60 * 1024);
  expect([jpg[0], jpg[1]]).toEqual([0xff, 0xd8]);
});
