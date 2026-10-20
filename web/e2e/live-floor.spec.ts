import { expect, test } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeVideo } from './y4m';
import { args } from './liveHelpers';

// A mottled floor and nothing else: auto-capture must never fire (it used to photograph the floor).
const video = join(tmpdir(), 'pdf-scanner-floor.y4m');
writeVideo(video, [{ name: 'floor', page: null, floor: true, frames: 60 }]);
test.use({ launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined, args: args(video) } });

test('auto-capture never photographs a floor or other non-page scene', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Scan pages', exact: true }).click();
  const cam = page.getByRole('dialog', { name: 'Camera' });
  await expect(cam.getByRole('switch', { name: 'Auto-capture' })).toHaveAttribute('aria-checked', 'true');
  await page.waitForTimeout(9000);
  await expect(cam.getByRole('button', { name: /Done \(/ })).toHaveCount(0);
});

test('the guide-lines switch is on by default, can be turned off and is remembered', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Scan pages', exact: true }).click();
  const cam = page.getByRole('dialog', { name: 'Camera' });
  const lines = cam.getByRole('switch', { name: 'Guide lines' });
  await expect(lines).toHaveAttribute('aria-checked', 'true');
  await lines.click();
  await expect(lines).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pdf-scanner.settings')!).anchorLines)).toBe(false);
  await cam.getByRole('radio', { name: 'Book spread' }).click();
  await expect(lines).toBeHidden(); // spread mode has its own centre line
});
