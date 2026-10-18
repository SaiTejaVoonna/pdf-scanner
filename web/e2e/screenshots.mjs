// Generates the README screenshots: `node e2e/screenshots.mjs` (needs `npm run build` and a preview server on :4173).
import { chromium } from '@playwright/test';
import { pagePng } from './helpers.ts';

const out = new URL('../../docs/screenshots/', import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto('http://localhost:4173/');
  await page.screenshot({ path: `${out}web-home-empty-${scheme}.png` });
  await page.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [1, 2, 3].map((i) => ({ name: `scan-${i}.png`, mimeType: 'image/png', buffer: pagePng() })));
  await page.getByRole('list', { name: 'Pages' }).locator('li').nth(2).waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}web-pages-${scheme}.png` });
  if (scheme === 'light') {
    await page.getByRole('button', { name: 'Edit page 1' }).click();
    const ed = page.getByRole('dialog', { name: 'Edit page' });
    await ed.getByRole('button', { name: 'Auto-detect' }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}web-crop-${scheme}.png` });
    await ed.getByRole('tab', { name: 'Enhance' }).click();
    await ed.getByRole('radio', { name: 'Enhanced' }).click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}web-enhance-${scheme}.png` });
    await ed.getByRole('button', { name: 'Save' }).click();
    await page.getByRole('button', { name: 'Export PDF' }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}web-export-${scheme}.png` });
  }
  await ctx.close();
}
await browser.close();
