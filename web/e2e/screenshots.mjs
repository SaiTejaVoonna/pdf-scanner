// Screenshots of the real app for the UI review (compare with docs/mocks/ref-*.png): `node e2e/screenshots.mjs`
// Needs `npm run build`, a preview server on :4173 and CHROMIUM_PATH. Writes docs/screenshots/ui-*.png
import { chromium } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { pagePng, spreadPng } from './helpers.ts';

const out = new URL('../../docs/screenshots/', import.meta.url).pathname;
const FILE = 'input[type=file][multiple]:not([accept*=pdf])';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const png = (name, buffer = pagePng()) => ({ name, mimeType: 'image/png', buffer });

async function newPage(scheme, vp = { width: 390, height: 844 }, extra = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, colorScheme: scheme, permissions: ['camera'], acceptDownloads: true, ...extra });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('pdf-scanner.tip-keep', '1'); localStorage.setItem('pdf-scanner.auto', 'off'); } catch { /* ignore */ } });
  await page.goto('http://localhost:4173/');
  return { ctx, page };
}
const shot = async (page, name) => { await page.waitForTimeout(450); await page.screenshot({ path: `${out}ui-${name}.png` }); };
async function makePdf(page, name) {
  await page.getByRole('button', { name: /Make PDF|Save changes/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Export PDF' });
  if (name) await dlg.getByLabel('File name').fill(name);
  await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: /Create PDF|Download again/ }).click()]);
  await dlg.getByText('PDF saved').waitFor();
  return dlg;
}
async function pdfOf(page, name, n) {
  await page.setInputFiles(FILE, Array.from({ length: n }, (_, i) => png(`p${i}.png`)));
  await page.getByRole('list', { name: 'Pages' }).locator('li').nth(n - 1).waitFor();
  const dlg = await makePdf(page, name);
  await dlg.getByRole('button', { name: 'Keep scanning' }).click();
  await page.getByRole('button', { name: 'Back to documents' }).click();
}

for (const scheme of ['light', 'dark']) {
  const s = scheme === 'light' ? '' : '-dark';
  let { ctx, page } = await newPage(scheme);
  await shot(page, `home-empty${s}`);
  await pdfOf(page, 'Biology notes ch4', 3); await pdfOf(page, 'Lab report', 2); await pdfOf(page, 'Rent receipt', 1);
  await page.setInputFiles(FILE, [png('a.png'), png('b.png'), png('c.png'), png('d.png')]);
  await page.getByRole('list', { name: 'Pages' }).locator('li').nth(3).waitFor();
  await page.getByRole('button', { name: 'Back to documents' }).click();
  await shot(page, `home${s}`);
  if (scheme === 'light') {
    await page.getByRole('searchbox', { name: 'Search PDFs' }).fill('lab'); await shot(page, 'home-search'); await page.getByRole('searchbox', { name: 'Search PDFs' }).fill('');
    await page.getByRole('button', { name: 'Biology notes ch4 menu' }).click(); await shot(page, 'pdf-menu'); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Import images' }).click(); await shot(page, 'import-sheet'); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Settings', exact: true }).click(); await shot(page, 'settings');
    await page.getByRole('button', { name: 'Tools', exact: true }).click(); await shot(page, 'tools');
    for (const [tool, key] of [['Compress PDF', 'compress'], ['Resize photo', 'resize'], ['Combine PDFs', 'combine'], ['Split PDF', 'split']]) {
      await page.getByRole('button', { name: new RegExp(`^${tool}`) }).click(); await shot(page, `tool-${key}`);
      await page.getByRole('dialog').getByRole('button', { name: 'Close' }).first().click();
    }
    await page.getByRole('button', { name: 'PDFs', exact: true }).click();
    // an open draft with a spread, a check flag, selection and menus
    await page.getByRole('button', { name: 'Open draft' }).click();
    await page.getByRole('button', { name: 'Add pages' }).click();
    await page.getByRole('radio', { name: 'Book spread' }).click(); await page.getByRole('button', { name: 'Close' }).click();
    await page.setInputFiles(FILE, [png('spread.png', spreadPng(900, 640, { seed: 3 }))]);
    const review = page.getByRole('dialog', { name: 'Review spread' }); await review.waitFor(); await page.waitForTimeout(900); await shot(page, 'edit-spread');
    await review.getByRole('button', { name: 'Apply' }).click(); await review.waitFor({ state: 'hidden' });
    await shot(page, 'pages');
    await page.getByRole('button', { name: 'Page 1 menu' }).click(); await shot(page, 'page-menu'); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Add pages' }).click(); await shot(page, 'add-sheet'); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Select', exact: true }).click(); await page.getByRole('button', { name: 'Select page 1' }).click(); await page.getByRole('button', { name: 'Select page 2' }).click(); await shot(page, 'pages-select');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.getByRole('button', { name: /Make PDF/ }).click(); await shot(page, 'make-pdf');
    const dlg = page.getByRole('dialog', { name: 'Export PDF' });
    await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Create PDF' }).click()]); await dlg.getByText('PDF saved').waitFor(); await shot(page, 'pdf-saved');
    await dlg.getByRole('button', { name: 'Keep scanning' }).click();
    await page.getByRole('button', { name: 'Page 1 menu' }).click(); await page.getByRole('dialog', { name: 'Page 1 menu' }).getByRole('button', { name: 'Delete page' }).click(); await shot(page, 'pdf-edited');
    await page.getByRole('button', { name: 'Back to documents' }).click();
    await page.getByRole('button', { name: 'Lab report menu' }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click(); await shot(page, 'deleted-undo');
    await page.getByRole('button', { name: 'Settings', exact: true }).click(); await page.getByRole('button', { name: /^Recently deleted/ }).click(); await shot(page, 'trash');
  } else {
    await page.getByRole('button', { name: 'Open draft' }).click(); await shot(page, 'pages-dark');
    await page.getByRole('button', { name: 'Edit page 1' }).click(); await page.getByRole('dialog', { name: 'Edit page' }).waitFor(); await page.waitForTimeout(900); await shot(page, 'edit-page-dark');
  }
  await ctx.close();
}
// page editor (light), camera states, desktop
{
  const { ctx, page } = await newPage('light');
  await page.setInputFiles(FILE, [png('a.png')]); await page.getByRole('list', { name: 'Pages' }).locator('li').nth(0).waitFor();
  await page.getByRole('button', { name: 'Edit page 1' }).click(); await page.getByRole('dialog', { name: 'Edit page' }).waitFor(); await page.waitForTimeout(1200); await shot(page, 'edit-page');
  await page.getByRole('button', { name: 'Look' }).click(); await page.waitForTimeout(900); await shot(page, 'edit-page-look');
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.getByRole('button', { name: 'Back to documents' }).click();
  await page.getByRole('button', { name: 'Scan pages', exact: true }).click(); await page.waitForTimeout(1500); await shot(page, 'camera');
  await page.getByRole('radio', { name: 'Book spread' }).click(); await shot(page, 'camera-spread');
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.addInitScript(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('no', 'NotAllowedError')); });
  await page.goto('http://localhost:4173/'); await page.getByRole('button', { name: 'Scan pages', exact: true }).click(); await shot(page, 'camera-blocked');
  await ctx.close();
}
{
  const { ctx, page } = await newPage('light', { width: 1280, height: 800 });
  await pdfOf(page, 'Biology notes ch4', 4); await pdfOf(page, 'Lab report', 2);
  await page.setInputFiles(FILE, [png('a.png'), png('b.png')]); await page.getByRole('list', { name: 'Pages' }).locator('li').nth(1).waitFor();
  await page.getByRole('button', { name: 'Back to documents' }).click(); await shot(page, 'desktop-home');
  await page.getByRole('button', { name: 'Biology notes ch4 menu' }).first().click(); await page.keyboard.press('Escape');
  await page.getByRole('list', { name: 'PDFs' }).getByRole('button', { name: /^Open Biology/ }).click(); await shot(page, 'desktop-pdf');
  await ctx.close();
}
await browser.close();
console.log('done');
