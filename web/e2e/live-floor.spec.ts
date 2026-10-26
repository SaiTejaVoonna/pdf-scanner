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
