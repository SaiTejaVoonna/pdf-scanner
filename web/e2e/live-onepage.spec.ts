import { expect, test } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeVideo } from './y4m';
import { args, openSpreadCamera } from './liveHelpers';

const executablePath = process.env.CHROMIUM_PATH || undefined;

const video = join(tmpdir(), 'pdf-scanner-onepage.y4m');
writeVideo(video, [
  { name: 'desk', page: null, frames: 10 },
  { name: 'page', page: { x: 150, y: 30 }, slide: 6, frames: 90 },
]);
test.use({ launchOptions: { executablePath, args: args(video) } });

test('warns that only one page is seen and never auto-captures', async ({ page }) => {
  const cam = await openSpreadCamera(page);
  await expect(cam.getByText(/Fold not confirmed/)).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(6000);
  await expect(cam.getByRole('button', { name: 'Done', exact: true })).toBeVisible();
  await expect(cam.getByRole('button', { name: /Done ·/ })).toHaveCount(0);
});
