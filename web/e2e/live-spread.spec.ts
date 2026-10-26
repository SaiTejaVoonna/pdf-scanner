import { expect, test } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeVideo } from './y4m';
import { args, openSpreadCamera } from './liveHelpers';

const executablePath = process.env.CHROMIUM_PATH || undefined;

const video = join(tmpdir(), 'pdf-scanner-book.y4m');
writeVideo(video, [
  { name: 'desk', page: null, frames: 15 },
  { name: 'book', page: { x: 90, y: 60 }, book: true, slide: 8, frames: 45 },
  { name: 'desk', page: null, frames: 20 },
]);
test.use({ launchOptions: { executablePath, args: args(video) } });

test('both pages and the fold are found, the capture adds pages 1 & 2 without a review screen, and Undo removes them', async ({ page }) => {
  const cam = await openSpreadCamera(page);
  await expect(cam.getByText('Spread 1 · will be pages 1 & 2')).toBeVisible();
  await expect(cam.getByRole('button', { name: 'Done · 1' })).toBeVisible({ timeout: 25_000 });
  await expect(cam.getByText(/Pages 1 & 2 added/)).toBeVisible();
  await expect(page.getByRole('dialog', { name: /Review spread/ })).toHaveCount(0);
  await expect(cam.getByText('Spread 2 · will be pages 3 & 4')).toBeVisible();
  await cam.getByRole('switch', { name: 'Auto-capture' }).click(); // no further captures while we undo
  await cam.getByRole('button', { name: 'Undo' }).click();
  await expect(cam.getByText('2 pages', { exact: true })).toHaveCount(0);
  await cam.getByRole('button', { name: /Done/ }).click();
  await expect(page.getByRole('list', { name: 'Pages' }).locator('li')).toHaveCount(0);
});

test('the capture is kept as two pages, left then right, in the page list', async ({ page }) => {
  const cam = await openSpreadCamera(page);
  await expect(cam.getByRole('button', { name: 'Done · 1' })).toBeVisible({ timeout: 25_000 });
  await cam.getByRole('switch', { name: 'Auto-capture' }).click(); // stop further captures while we look
  await cam.getByRole('button', { name: /Done/ }).click();
  const items = page.getByRole('list', { name: 'Pages' }).locator('li');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toContainText('Spread 1 · L');
  await expect(items.nth(1)).toContainText('Spread 1 · R');
});
