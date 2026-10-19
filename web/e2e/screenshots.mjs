// Generates the README/review screenshots: `node e2e/screenshots.mjs` (needs `npm run build` and a preview server on :4173).
import { chromium } from '@playwright/test';
import { pagePng, spreadPng } from './helpers.ts';

const out = new URL('../../docs/screenshots/', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const FILE = 'input[type=file][multiple]:not([accept*=pdf])';
const shot = (p, name) => p.screenshot({ path: `${out}${name}.png` });

for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme, permissions: ['camera'] });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/');
  await shot(page, `web-home-empty-${scheme}`);

  // A document with one single page and two book spreads.
  await page.setInputFiles(FILE, [{ name: 'note.png', mimeType: 'image/png', buffer: pagePng() }]);
  await page.getByRole('list', { name: 'Pages' }).locator('li').nth(0).waitFor();
  await page.getByRole('radio', { name: 'Book spread' }).click();
  for (const seed of [1, 2]) {
    await page.setInputFiles(FILE, [{ name: `book${seed}.png`, mimeType: 'image/png', buffer: spreadPng(900, 640, { seed }) }]);
    const ed = page.getByRole('dialog', { name: 'Review spread' });
    await ed.waitFor(); await page.waitForTimeout(900);
    if (seed === 1 && scheme === 'light') await shot(page, 'web-spread-review-light');
    await ed.getByRole('button', { name: 'Apply' }).click(); await ed.waitFor({ state: 'hidden' });
  }
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, `web-pages-${scheme}`);

  if (scheme === 'light') {
    // A photo whose fold cannot be found: flagged, Apply disabled until confirmed.
    await page.setInputFiles(FILE, [{ name: 'nofold.png', mimeType: 'image/png', buffer: spreadPng(900, 640, { fold: 0 }) }]);
    const ed = page.getByRole('dialog', { name: 'Review spread' });
    await ed.waitFor(); await page.waitForTimeout(900);
    await shot(page, 'web-spread-uncertain-light');
    await ed.getByRole('button', { name: 'Adjust each page' }).click(); await page.waitForTimeout(400);
    await shot(page, 'web-spread-each-page-light');
    await ed.getByRole('button', { name: 'Cancel' }).click(); await ed.waitFor({ state: 'hidden' });

    await page.getByRole('button', { name: 'Page 1 menu' }).click(); await page.waitForTimeout(300);
    await shot(page, 'web-page-menu-light');
    await page.getByRole('dialog', { name: 'Page 1 menu' }).getByRole('button', { name: 'Close' }).click();

    await page.getByRole('button', { name: 'Select', exact: true }).click();
    await page.getByRole('button', { name: 'Select page 2' }).click(); await page.getByRole('button', { name: 'Select page 3' }).click();
    await page.waitForTimeout(300); await shot(page, 'web-selection-light');
    await page.getByRole('button', { name: 'Done' }).click();

    await page.getByRole('button', { name: 'Edit page 1' }).click();
    const pe = page.getByRole('dialog', { name: 'Edit page' });
    await pe.getByRole('button', { name: 'Auto-detect' }).click(); await page.waitForTimeout(1200);
    await shot(page, 'web-crop-light');
    await pe.getByRole('tab', { name: 'Enhance' }).click(); await pe.getByRole('radio', { name: 'Enhanced' }).click(); await page.waitForTimeout(1200);
    await shot(page, 'web-enhance-light');
    await pe.getByRole('button', { name: 'Save' }).click();

    await page.getByRole('button', { name: 'Page 1 menu' }).click();
    await page.getByRole('dialog', { name: 'Page 1 menu' }).getByRole('button', { name: 'Preview' }).click(); await page.waitForTimeout(1200);
    await shot(page, 'web-preview-light');
    await page.getByRole('button', { name: 'Close preview' }).click();

    await page.getByRole('button', { name: 'Resize images' }).click(); await page.waitForTimeout(400);
    await shot(page, 'web-resize-light');
    await page.getByRole('button', { name: 'Close', exact: true }).click();

    await page.getByRole('button', { name: /Make PDF/ }).click(); await page.waitForTimeout(1500);
    await shot(page, 'web-export-light');
    await page.getByRole('dialog', { name: 'Export PDF' }).getByRole('button', { name: 'Keep scanning' }).click();

    await page.getByRole('button', { name: 'Scan pages', exact: true }).click(); await page.waitForTimeout(1500);
    await shot(page, 'web-camera-spread-light');
  }
  await ctx.close();
}
await browser.close();
