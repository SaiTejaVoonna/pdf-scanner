import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { pagePng } from './helpers';
import { firstPageCropped, pagesPersisted } from './persist';

const png = (name: string, w?: number, h?: number) => ({ name, mimeType: 'image/png', buffer: pagePng(w, h) });

async function importImages(page: Page, count: number) {
  await page.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', Array.from({ length: count }, (_, i) => png(`scan-${i + 1}.png`)));
  await expect(page.getByRole('list', { name: 'Pages' }).locator('li')).toHaveCount(count);
}

test.beforeEach(async ({ page }) => {
  // Auto-capture is on by default; these tests press the shutter themselves (live.spec.ts covers auto-capture).
  await page.addInitScript(() => { try { localStorage.setItem('pdf-scanner.auto', 'off'); } catch { /* ignore */ } });
  // E2E_CPU_THROTTLE=6 runs the page 6x slower, to flush out timing assumptions that only fail on slow CI runners.
  const rate = Number(process.env.E2E_CPU_THROTTLE ?? 1);
  if (rate > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate });
  await page.goto('/');
});

async function openTool(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
}

test('starts empty, with the privacy-friendly basics in place', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'PDFs', exact: true })).toBeVisible();
  await expect(page.getByText('No PDFs yet')).toBeVisible();
  await expect(page.getByRole('button', { name: /Make PDF/ })).toBeHidden();
  // The app never talks to another origin.
  const external: string[] = [];
  page.on('request', (r) => { if (new URL(r.url()).origin !== 'http://localhost:4173' && !r.url().startsWith('blob:') && !r.url().startsWith('data:')) external.push(r.url()); });
  await importImages(page, 1);
  expect(external).toEqual([]);
});

test('imports images, edits a page, reorders, and exports a valid multipage PDF', async ({ page }) => {
  await importImages(page, 3);
  // Imported images keep the full frame by default; open the editor and auto-detect the page.
  await page.getByRole('button', { name: 'Edit page 1' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit page' });
  await expect(editor.getByRole('button', { name: /Top left corner/ })).toBeVisible();
  let before: { x: number } | null = null;
  await expect.poll(async () => { before = await editor.getByRole('button', { name: /Top left corner/ }).boundingBox(); return before !== null; }).toBe(true);
  await editor.getByRole('button', { name: 'Auto-detect' }).click();
  await expect.poll(async () => (await editor.getByRole('button', { name: /Top left corner/ }).boundingBox())?.x).not.toBe(before!.x);
  // keyboard nudge works
  const tl = editor.getByRole('button', { name: /Top left corner/ });
  const x0 = (await tl.boundingBox())!.x;
  await tl.focus(); await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await tl.boundingBox())!.x).toBeGreaterThan(x0);
  // Enhance tab: pick a filter and rotate.
  await editor.getByRole('button', { name: 'Look' }).click();
  await editor.getByRole('radio', { name: 'Black & white' }).click();
  await editor.getByRole('button', { name: 'Rotate right' }).click();
  await expect(editor.getByRole('img', { name: 'Preview of the corrected page' })).toBeVisible();
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect(editor).toBeHidden();

  // Reorder: move page 1 later.
  await page.getByRole('button', { name: 'Page 1 menu' }).click();
  await page.getByRole('dialog', { name: 'Page 1 menu' }).getByRole('button', { name: 'Move later' }).click();

  await page.getByRole('button', { name: /Make PDF/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Export PDF' });
  await dlg.getByText('More options').click();
  await dlg.getByLabel('File name').fill('My: test/scan');
  await dlg.getByRole('radio', { name: 'US Letter' }).click();
  await dlg.getByRole('radio', { name: 'Balanced' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Create PDF' }).click()]);
  expect(download.suggestedFilename()).toBe('My test scan.pdf');
  const path = await download.path();
  const doc = await PDFDocument.load(readFileSync(path));
  expect(doc.getPageCount()).toBe(3);
  doc.getPages().forEach((p) => { const { width, height } = p.getSize(); expect([Math.round(width), Math.round(height)].sort()).toEqual([612, 792]); });
});

test('export shows the estimated size of each quality and can pick one that fits a limit', async ({ page }) => {
  await importImages(page, 2);
  await page.getByRole('button', { name: /Make PDF/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Export PDF' });
  // Estimates appear on the quality cards ("≈ 180 KB" and so on), getting smaller down the list.
  await expect(dlg.getByRole('radio', { name: /Tiny.*≈ [\d.]+ (KB|MB)/ })).toBeVisible();
  const kb = async (label: RegExp) => { const t = await dlg.getByRole('radio', { name: label }).textContent(); const m = t!.match(/≈ ([\d.]+) (KB|MB|B)/)!; return parseFloat(m[1]) * (m[2] === 'MB' ? 1024 : m[2] === 'KB' ? 1 : 1 / 1024); };
  const [high, tiny] = [await kb(/^High/), await kb(/^Tiny/)];
  expect(tiny).toBeLessThan(high);
  // A generous limit keeps High; an impossible one says so and falls back to Tiny.
  await dlg.getByText('More options').click();
  await dlg.getByLabel(/Keep under \(MB\)/).fill('50');
  await expect(dlg.getByRole('radio', { name: /^High/ })).toHaveAttribute('aria-checked', 'true');
  await expect(dlg.getByText(/High fits under 50 MB/)).toBeVisible();
  await dlg.getByLabel(/Keep under \(MB\)/).fill('0.001');
  await expect(dlg.getByRole('radio', { name: /^Tiny/ })).toHaveAttribute('aria-checked', 'true');
  await expect(dlg.getByText(/Even Tiny is about/)).toBeVisible();
  // The real PDF is then built and its true size is shown.
  const [download] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Create PDF' }).click()]);
  await download.path();
  await expect(dlg.getByText(/\.pdf · [\d.]+ (KB|MB|B)/)).toBeVisible();
});

test('selection mode applies bulk actions to the selected pages only', async ({ page }) => {
  await importImages(page, 3);
  await page.getByRole('button', { name: 'Select', exact: true }).click();
  await page.getByRole('button', { name: 'Select page 1' }).click();
  await expect(page.getByRole('status').filter({ hasText: '1 selected' })).toBeVisible();
  await page.getByRole('button', { name: 'Select page 3' }).click(); // thumb toggles in selection mode
  await expect(page.getByRole('status').filter({ hasText: '2 selected' })).toBeVisible();
  await page.getByRole('button', { name: 'Filter' }).click();
  await page.getByRole('dialog', { name: 'Filter for selected pages' }).getByRole('button', { name: 'Enhanced' }).click();
  await page.getByRole('button', { name: 'Rotate' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('list', { name: 'Pages' }).locator('li')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Make PDF/ })).toBeVisible();
});

test('unreadable files are reported and do not break the app', async ({ page }) => {
  await page.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [{ name: 'notes.png', mimeType: 'image/png', buffer: Buffer.from('not an image') }]);
  await expect(page.getByText('notes.png could not be read as an image.')).toBeVisible();
  await expect(page.getByText('No PDFs yet')).toBeVisible(); // no empty document is left behind
});

test('scans are kept across a reload', async ({ page }) => {
  await importImages(page, 2);
  await pagesPersisted(page, 2); // the IndexedDB write is asynchronous
  await page.reload();
  await expect(page.getByRole('list', { name: 'Pages' }).locator('li')).toHaveCount(2);
  await page.getByRole('button', { name: 'Document menu' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Discard draft' }).click();
  await expect(page.getByText('No PDFs yet')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click(); // a delete can always be undone
  await expect(page.getByRole('button', { name: 'Open draft' })).toHaveCount(1);
});

test('settings are stored and auto-crop on import crops the page', async ({ page }) => {
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Auto-crop imported images').check();
  await page.getByRole('radio', { name: 'Enhanced' }).click();
  await page.getByRole('button', { name: 'PDFs', exact: true }).click();
  await importImages(page, 1);
  await firstPageCropped(page); // the crop is found in the background after the photo is added
  await page.getByRole('button', { name: 'Edit page 1' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit page' })).toBeVisible();
  // With auto-crop the top-left handle sits well inside the photo instead of at its corner. Measure the handle and
  // the stage in the same instant, and wait for the editor to finish laying out.
  await expect.poll(() => page.evaluate(() => {
    // The editor builds its stage asynchronously (it decodes the photo first): report -1 until it exists.
    const stageEl = document.querySelector('.stage-inner'), handleEl = document.querySelector('.handle');
    if (!stageEl || !handleEl) return -1;
    const stage = stageEl.getBoundingClientRect(), h = handleEl.getBoundingClientRect();
    return stage.width > 50 ? (h.left + h.width / 2 - stage.left) / stage.width : -1;
  }), { message: 'top-left handle should move inside the photo after auto-crop' }).toBeGreaterThan(0.08);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pdf-scanner.settings')!).defaultFilter)).toBe('enhanced');
});

test('live camera captures pages (fake camera) and shows a clear message if blocked', async ({ page }) => {
  await page.getByRole('button', { name: 'Scan pages', exact: true }).click();
  const cam = page.getByRole('dialog', { name: 'Camera' });
  const shutter = cam.getByRole('button', { name: 'Capture page' });
  await expect(shutter).toBeEnabled();
  await page.waitForFunction(() => (document.querySelector('video') as HTMLVideoElement).videoWidth > 0);
  await shutter.click();
  await expect(cam.getByRole('button', { name: 'Done · 1' })).toBeVisible();
  await shutter.click();
  await expect(cam.getByRole('button', { name: 'Done · 2' })).toBeVisible();
  await cam.getByRole('button', { name: /Done/ }).click();
  await expect(page.getByRole('list', { name: 'Pages' }).locator('li')).toHaveCount(2);
});

test('camera denied shows guidance and a fallback', async ({ browser }) => {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('no', 'NotAllowedError')); });
  await p.goto('/');
  await p.getByRole('button', { name: 'Scan pages', exact: true }).click();
  await expect(p.getByRole('alert')).toContainText('Camera access was denied');
  await expect(p.getByRole('button', { name: 'Use phone camera instead' })).toBeVisible();
  await ctx.close();
});

test('combines PDFs in order without re-rendering them', async ({ page }) => {
  const make = async (pages: number, w: number) => { const d = await PDFDocument.create(); for (let i = 0; i < pages; i++) d.addPage([w, 400]); return Buffer.from(await d.save()); };
  await openTool(page, 'Combine PDFs');
  const dlg = page.getByRole('dialog', { name: 'Combine PDFs' });
  await dlg.locator('input[type=file]').setInputFiles([
    { name: 'a.pdf', mimeType: 'application/pdf', buffer: await make(1, 300) },
    { name: 'b.pdf', mimeType: 'application/pdf', buffer: await make(2, 500) },
    { name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('nope') },
  ]);
  // The error toast must be visible even though a modal dialog is open.
  await expect(page.getByText(/bad.pdf is password protected or not a readable PDF/)).toBeVisible();
  await expect(dlg.locator('li')).toHaveCount(2);
  await dlg.getByRole('button', { name: 'Move a.pdf down' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Combine & download' }).click()]);
  const doc = await PDFDocument.load(readFileSync((await download.path())!));
  expect(doc.getPages().map((p) => Math.round(p.getWidth()))).toEqual([500, 500, 300]);
});

test('works offline after the first visit (service worker)', async ({ page, context }) => {
  await page.reload();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller); // the worker must be controlling this page
  await page.waitForFunction(async () => (await caches.keys()).length > 0 && (await (await caches.open((await caches.keys())[0])).keys()).length >= 3);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'PDFs', exact: true })).toBeVisible();
  await importImages(page, 1);
  await page.getByRole('button', { name: /Make PDF/ }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('dialog', { name: 'Export PDF' }).getByRole('button', { name: 'Create PDF' }).click()]);
  expect((await PDFDocument.load(readFileSync((await download.path())!))).getPageCount()).toBe(1);
  await context.setOffline(false);
});

test('preview pages through the scans, zoom, and jump to the editor', async ({ page }) => {
  await importImages(page, 3);
  await page.getByRole('button', { name: 'Page 2 menu' }).click();
  await page.getByRole('dialog', { name: 'Page 2 menu' }).getByRole('button', { name: 'Preview' }).click();
  const viewer = page.getByRole('dialog', { name: 'Preview' });
  await expect(viewer.getByText('Page 2 of 3')).toBeVisible();
  await expect(viewer.getByRole('img', { name: 'Page 2 of 3' })).toHaveJSProperty('complete', true);
  await viewer.getByRole('button', { name: 'Next page' }).click();
  await expect(viewer.getByText('Page 3 of 3')).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Next page' })).toBeDisabled();
  await page.keyboard.press('ArrowLeft');
  await expect(viewer.getByText('Page 2 of 3')).toBeVisible();
  const img = viewer.getByRole('img', { name: 'Page 2 of 3' });
  const w0 = (await img.boundingBox())!.width;
  await viewer.getByRole('button', { name: 'Zoom in' }).click();
  await expect.poll(async () => (await img.boundingBox())!.width).toBeGreaterThan(w0 * 1.3);
  await viewer.getByRole('button', { name: 'Edit this page' }).click();
  await expect(page.getByRole('dialog', { name: 'Edit page' })).toBeVisible();
});

test('editor can compare the result with the original photo', async ({ page }) => {
  await importImages(page, 1);
  await page.getByRole('button', { name: 'Edit page 1' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit page' });
  await editor.getByRole('button', { name: 'Look' }).click();
  await expect(editor.getByRole('img', { name: 'Preview of the corrected page' })).toBeVisible();
  await editor.getByRole('button', { name: 'Show original' }).click();
  await expect(editor.getByRole('img', { name: 'Original photo' })).toBeVisible();
  await editor.getByRole('button', { name: 'Show result' }).click();
  await expect(editor.getByRole('img', { name: 'Preview of the corrected page' })).toBeVisible();
});

test('resizes images to a size and a file-size limit, and downloads a valid ZIP', async ({ page }) => {
  await openTool(page, 'Resize photo');
  const dlg = page.getByRole('dialog', { name: 'Resize photo' });
  await dlg.locator('input[type=file]').setInputFiles([png('photo.png', 1600, 2000), png('photo.png', 800, 1000)]);
  await expect(dlg.locator('.list li')).toHaveCount(2);
  await dlg.getByRole('radio', { name: 'Small 800' }).click();
  await dlg.getByLabel('Largest file (KB)').fill('30');
  await dlg.getByRole('button', { name: 'Resize', exact: true }).click();
  const rows = dlg.getByRole('list', { name: 'Resized images' }).locator('li');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('photo-resized.jpg');
  await expect(rows.nth(1)).toContainText('photo-resized (2).jpg'); // same input name never overwrites
  const dl = page.waitForEvent('download');
  await dlg.getByRole('button', { name: 'Download photo-resized.jpg' }).click();
  const file = await (await dl).createReadStream();
  const chunks: Buffer[] = []; for await (const c of file) chunks.push(c as Buffer);
  const jpg = Buffer.concat(chunks);
  expect(jpg.length).toBeLessThanOrEqual(30 * 1024);
  expect([jpg[0], jpg[1]]).toEqual([0xff, 0xd8]);
  const zipDl = page.waitForEvent('download');
  await dlg.getByRole('button', { name: 'Download all (ZIP)' }).click();
  const zipPath = await (await zipDl).path();
  const { execFileSync } = await import('node:child_process');
  expect(execFileSync('unzip', ['-t', zipPath]).toString()).toContain('No errors detected');
});

test('crop screen never clips the corners of a tall photo on a phone-sized screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  await page.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [png('tall.png', 600, 1600)]);
  await page.getByRole('button', { name: 'Edit page 1' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit page' });
  const stage = editor.locator('.stage');
  await expect(editor.getByRole('button', { name: /Bottom left corner/ })).toBeVisible();
  await expect.poll(async () => {
    const s = (await stage.boundingBox())!;
    const handles = await Promise.all(['Top left', 'Top right', 'Bottom right', 'Bottom left'].map(async (n) => (await editor.getByRole('button', { name: new RegExp(`${n} corner`) }).boundingBox())!));
    // Each handle's centre must be inside the visible stage.
    return handles.every((b) => b.x + b.width / 2 >= s.x - 1 && b.x + b.width / 2 <= s.x + s.width + 1 && b.y + b.height / 2 >= s.y - 1 && b.y + b.height / 2 <= s.y + s.height + 1);
  }).toBe(true);
});

test('taking pages gives feedback: a message, and the new page is highlighted', async ({ page }) => {
  await importImages(page, 2);
  await expect(page.getByText('2 pages added.')).toBeVisible();
  await expect(page.locator('.card.fresh')).toHaveCount(1);
});

test('combine lets you name the output file', async ({ page }) => {
  await openTool(page, 'Combine PDFs');
  const dlg = page.getByRole('dialog', { name: 'Combine PDFs' });
  const doc = async (n: number) => { const d = await PDFDocument.create(); for (let i = 0; i < n; i++) d.addPage([200, 200]); return Buffer.from(await d.save()); };
  await dlg.locator('input[type=file]').setInputFiles([{ name: 'a.pdf', mimeType: 'application/pdf', buffer: await doc(1) }, { name: 'b.pdf', mimeType: 'application/pdf', buffer: await doc(2) }]);
  await dlg.getByLabel('File name').fill('Lab report');
  const dl = page.waitForEvent('download');
  await dlg.getByRole('button', { name: 'Combine & download' }).click();
  expect((await dl).suggestedFilename()).toBe('Lab report.pdf');
});

test('home has the Scan button, Import, and three places (PDFs, Tools, Settings); Compress PDF is only a tool', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await expect(page.getByRole('button', { name: 'Scan pages', exact: true })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Import images' })).toBeInViewport();
  const dock = page.getByRole('navigation', { name: 'Main' }).last();
  for (const t of ['PDFs', 'Tools', 'Settings']) await expect(dock.getByRole('button', { name: t })).toBeInViewport();
  await expect(page.getByRole('button', { name: /Compress PDF/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  await expect(page.getByRole('button', { name: /^Compress PDF/ })).toBeVisible();
});

test('make-PDF sheet shows page count, thumbnails and quality cards; Keep scanning goes back without losing pages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await importImages(page, 3);
  await page.getByRole('button', { name: /Make PDF \(3\)/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Export PDF' });
  await expect(dlg.getByRole('heading', { name: /^Make PDF/ })).toBeVisible();
  await expect(dlg.getByText('3 pages, saved on this device')).toBeVisible();
  await expect(dlg.getByRole('list', { name: 'Pages in the PDF' }).locator('li')).toHaveCount(3);
  await expect(dlg.getByRole('radio')).toHaveCount(4);
  await expect(dlg.getByRole('button', { name: 'Create PDF' })).toBeInViewport();
  await expect(dlg.getByRole('button', { name: 'Keep scanning' })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await dlg.getByRole('button', { name: 'Keep scanning' }).click();
  await expect(dlg).toBeHidden();
  await expect(page.getByRole('list', { name: 'Pages' }).locator('li')).toHaveCount(3);
});

test('camera screen is honest: a framing guide and mode switch, no claim of live detection, and a running page count', async ({ page }) => {
  await importImages(page, 1);
  await page.getByRole('button', { name: 'Add pages' }).click();
  await page.getByRole('dialog', { name: 'Add pages' }).getByRole('button', { name: 'Scan pages' }).click();
  const cam = page.getByRole('dialog', { name: 'Camera' });
  await expect(cam.getByText('Fit the page in the frame')).toBeVisible();
  await cam.getByRole('radio', { name: 'Book spread' }).click();
  await expect(cam.getByText('Fit both pages in the frame')).toBeVisible();
  await expect(cam.getByText(/detected/i)).toHaveCount(0);
  await expect(cam.getByRole('button', { name: 'Show my pages' })).toContainText('1');
  await expect(cam.getByRole('button', { name: 'Close' })).toBeVisible();
});
