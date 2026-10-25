import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { pagePng } from './helpers';
import { firstPageCropped } from './persist';

const HAVE_MODEL = existsSync(new URL('../public/model/corners.bin', import.meta.url));

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('pdf-scanner.auto', 'off'); localStorage.setItem('pdf-scanner.settings', JSON.stringify({ autoCropImport: true })); } catch { /* ignore */ } });
});

test('an imported photo is cropped by the shared engine; the learned model is fetched only when first needed', async ({ page }) => {
  test.skip(!HAVE_MODEL, 'no model file in public/model');
  const asked: string[] = [];
  page.on('request', (r) => { if (r.url().includes('/model/corners.bin')) asked.push(r.url()); });
  await page.goto('/');
  await page.waitForTimeout(500);
  expect(asked, 'the model is not downloaded at start-up').toHaveLength(0);
  await page.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [{ name: 'page.png', mimeType: 'image/png', buffer: pagePng() }]);
  await expect(page.getByRole('list', { name: 'Pages' }).locator('li')).toHaveCount(1);
  await firstPageCropped(page);
  expect(asked.length, 'the model is fetched once, on first use').toBeGreaterThanOrEqual(1);
});

test('the editor Auto-detect gives the same kind of answer as import (one engine) and still works without the model', async ({ page }) => {
  await page.route('**/model/corners.bin', (r) => r.abort()); // pretend the model file is missing: the rules must carry on
  await page.goto('/');
  await page.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [{ name: 'page.png', mimeType: 'image/png', buffer: pagePng() }]);
  await expect(page.getByRole('list', { name: 'Pages' }).locator('li')).toHaveCount(1);
  await firstPageCropped(page);
  await page.getByRole('button', { name: 'Edit page 1' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit page' });
  await editor.getByRole('button', { name: 'Full image' }).click();
  await editor.getByRole('button', { name: 'Auto-detect' }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __engine?: { last?: { source: string } } }).__engine?.last?.source)).toBe('rules');
});
