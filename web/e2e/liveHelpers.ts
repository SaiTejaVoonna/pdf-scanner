import type { Page } from '@playwright/test';

export const args = (file: string) => ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-video-capture=' + file, '--no-sandbox'];

export async function openSpreadCamera(page: Page) {
  const rate = Number(process.env.E2E_CPU_THROTTLE ?? 1);
  if (rate > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate });
  await page.goto('/');
  await page.getByRole('radio', { name: 'Book spread' }).first().click();
  await page.getByRole('button', { name: 'Scan pages', exact: true }).click();
  return page.getByRole('dialog', { name: 'Camera' });
}
