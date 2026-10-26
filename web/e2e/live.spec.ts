import { expect, test } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeVideo } from './y4m';

// Desk 1.5 s -> page A slides in (1 s) and rests (3 s) -> desk 1.5 s -> page B slides in and rests (3 s). The video loops.
const video = join(tmpdir(), 'pdf-scanner-live.y4m');
const seconds = writeVideo(video, [
  { name: 'desk', page: null, frames: 15 },
  { name: 'A', page: { x: 150, y: 30 }, slide: 10, frames: 40 },
  { name: 'desk', page: null, frames: 15 },
  { name: 'B', page: { x: 170, y: 25 }, slide: 10, frames: 40 },
]);
const executablePath = process.env.CHROMIUM_PATH || undefined;
test.use({ launchOptions: { executablePath, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + video, '--no-sandbox'] } });

test.beforeEach(async ({ page }) => {
  const rate = Number(process.env.E2E_CPU_THROTTLE ?? 1);
  if (rate > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate });
  await page.goto('/');
});

test('auto-capture is on by default, fires once per page, never twice for the same page, and can be switched off', async ({ page }) => {
  expect(seconds).toBeGreaterThan(8);
  await page.getByRole('button', { name: 'Scan pages', exact: true }).click();
  const cam = page.getByRole('dialog', { name: 'Camera' });
  await expect(cam.getByRole('switch', { name: 'Auto-capture' })).toHaveAttribute('aria-checked', 'true');
  const stamps: number[] = [];
  const t0 = Date.now();
  for (const n of [1, 2]) {
    await expect(cam.getByRole('button', { name: `Done · ${n}` })).toBeVisible({ timeout: 25_000 });
    stamps.push(Date.now() - t0);
  }
  // The two pages are separated by empty desk, so the shots must be well apart: no duplicate of one page.
  expect(stamps[1] - stamps[0]).toBeGreaterThan(1500);
  // Switch it off: nothing more is captured, and the choice is remembered.
  await cam.getByRole('switch', { name: 'Auto-capture' }).click();
  await expect(cam.getByRole('switch', { name: 'Auto-capture' })).toHaveAttribute('aria-checked', 'false');
  await page.waitForTimeout(4000);
  await expect(cam.getByRole('button', { name: /Done \(\d+\)/ })).toHaveText(/Done \(2\)|Done \(3\)/); // at most one shot raced the click
  const before = await cam.getByRole('button', { name: /Done \(\d+\)/ }).textContent();
  await page.waitForTimeout(6000);
  await expect(cam.getByRole('button', { name: /Done \(\d+\)/ })).toHaveText(before!);
  expect(await page.evaluate(() => localStorage.getItem('pdf-scanner.auto'))).toBe('off');
});

test('the shutter still works with auto-capture off, and a manual shot is never doubled', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pdf-scanner.auto', 'off'));
  await page.reload();
  await page.getByRole('button', { name: 'Scan pages', exact: true }).click();
  const cam = page.getByRole('dialog', { name: 'Camera' });
  await expect(cam.getByRole('switch', { name: 'Auto-capture' })).toHaveAttribute('aria-checked', 'false');
  await expect(cam.getByRole('button', { name: 'Capture page' })).toBeEnabled();
  await cam.getByRole('button', { name: 'Capture page' }).click();
  await page.waitForTimeout(3000);
  await expect(cam.getByRole('button', { name: 'Done · 1' })).toBeVisible();
  await page.waitForTimeout(3000);
  await expect(cam.getByRole('button', { name: 'Done · 1' })).toBeVisible();
});
