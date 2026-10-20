import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem('pdf-scanner.auto', 'off'); } catch { /* ignore */ } });
  await page.goto('/');
});

test('tap the pages thumbnail on the live camera: see the pages, move one, delete one, and the camera keeps working', async ({ page }) => {
  await page.getByRole('button', { name: 'Scan pages', exact: true }).click();
  const cam = page.getByRole('dialog', { name: 'Camera' });
  const shutter = cam.getByRole('button', { name: 'Capture page' });
  await expect(shutter).toBeEnabled();
  await page.waitForFunction(() => (document.querySelector('video') as HTMLVideoElement).videoWidth > 0);
  await shutter.click();
  await expect(cam.getByRole('button', { name: 'Done (1)' })).toBeVisible();
  await shutter.click();
  await expect(cam.getByRole('button', { name: 'Done (2)' })).toBeVisible();
  await cam.getByRole('button', { name: 'Show my pages' }).click();
  const sheet = cam.getByRole('region', { name: 'Your pages' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('2 total')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Move page 1 earlier' })).toBeDisabled();
  await sheet.getByRole('button', { name: 'Move page 1 later' }).click();
  await sheet.getByRole('button', { name: 'Delete page 2' }).click();
  await expect(sheet.getByText('1 total')).toBeVisible();
  await sheet.getByRole('button', { name: 'Close' }).click();
  await expect(sheet).toBeHidden();
  await shutter.click();
  await expect(cam.getByText('2 pages', { exact: true })).toBeVisible({ timeout: 10_000 });
  await cam.getByRole('button', { name: /Done/ }).click();
  await expect(page.getByRole('list', { name: 'Pages' }).locator('li')).toHaveCount(2);
});

test('the preview fills the width and nothing is laid over the picture', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.getByRole('button', { name: 'Scan pages', exact: true }).click();
  const cam = page.getByRole('dialog', { name: 'Camera' });
  await expect(cam.getByRole('button', { name: 'Capture page' })).toBeEnabled();
  const { stage, vid, bars } = await page.evaluate(() => {
    const r = (sel: string) => { const b = document.querySelector(sel)!.getBoundingClientRect(); return { l: b.left, t: b.top, w: b.width, h: b.height, bottom: b.bottom }; };
    return { stage: r('.cam-stage'), vid: r('.cam-stage video'), bars: [r('.cam-top'), r('.cam-auto'), r('.cam-hint')] };
  });
  expect(vid.w).toBeGreaterThanOrEqual(stage.w - 1);          // full width, no black side bars
  expect(vid.h).toBeGreaterThanOrEqual(stage.h - 1);
  for (const b of bars) expect(b.bottom).toBeLessThanOrEqual(stage.t + 1); // every bar ends above the picture
});
