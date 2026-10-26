import { expect, test, type Page } from '@playwright/test';
import { pagePng } from './helpers';

/** Short words everywhere: no visible sentence on a main screen is longer than 90 characters. */
const MAX = 90;
async function longText(page: Page): Promise<string[]> {
  return page.evaluate((max) => {
    const out: string[] = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = (n.textContent ?? '').trim();
      const el = n.parentElement;
      if (t.length <= max || !el) continue;
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.width > 0 && r.height > 0 && cs.visibility !== 'hidden') out.push(t);
    }
    return out;
  }, MAX);
}

test('the main screens use short text (no paragraphs)', async ({ page }) => {
  await page.goto('/');
  const seen: string[] = [...(await longText(page))];
  await page.getByRole('button', { name: 'Tools', exact: true }).click();
  seen.push(...(await longText(page)));
  for (const t of ['Compress PDF', 'Resize photo', 'Combine PDFs', 'Split PDF']) {
    await page.getByRole('button', { name: new RegExp(`^${t}`) }).click();
    seen.push(...(await longText(page)));
    await page.getByRole('dialog').getByRole('button', { name: 'Close' }).first().click();
  }
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  seen.push(...(await longText(page)));
  await page.getByRole('button', { name: 'PDFs', exact: true }).click();
  await page.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [{ name: 'a.png', mimeType: 'image/png', buffer: pagePng() }]);
  await expect(page.getByRole('list', { name: 'Pages' }).locator('li')).toHaveCount(1);
  seen.push(...(await longText(page)));
  await page.getByRole('button', { name: 'Add pages' }).click();
  seen.push(...(await longText(page)));
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Make PDF/ }).click();
  await expect(page.getByRole('dialog', { name: 'Export PDF' }).getByText('1 page')).toBeVisible();
  seen.push(...(await longText(page)));
  expect(seen, `Longer than ${MAX} characters:\n${seen.join('\n')}`).toEqual([]);
});

test('every button on the home screens is at least 44 px high (one tap size)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 780 });
  await page.goto('/');
  for (const tab of ['Tools', 'Settings', 'PDFs']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    const small = await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 44; }).map((b) => `${b.getAttribute('aria-label') ?? b.textContent?.trim()} (${Math.round(b.getBoundingClientRect().height)}px)`));
    expect(small, `Buttons under 44 px on ${tab}`).toEqual([]);
  }
});
