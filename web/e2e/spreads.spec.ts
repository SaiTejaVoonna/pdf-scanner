import { expect, test, type Page } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { spreadPng } from './helpers';

const spread = (name: string, o?: { fold?: number; seed?: number }) => ({ name, mimeType: 'image/png', buffer: spreadPng(800, 600, o) });
const pagesList = (page: Page) => page.getByRole('list', { name: 'Pages' }).locator('li');
const review = (page: Page) => page.getByRole('dialog', { name: 'Review spread' });

async function bookMode(page: Page) { await page.getByRole('radio', { name: 'Book spread' }).click(); }
async function importSpread(page: Page, file = spread('book.png'), apply = true) {
  await page.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [file]);
  await expect(review(page)).toBeVisible();
  await expect(review(page).getByRole('button', { name: /Fold, top end/ })).toBeVisible();
  if (apply) {
    await expect(review(page).getByRole('button', { name: 'Apply' })).toBeEnabled();
    await review(page).getByRole('button', { name: 'Apply' }).click();
    await expect(review(page)).toBeHidden();
  }
}

test.beforeEach(async ({ page }) => {
  const rate = Number(process.env.E2E_CPU_THROTTLE ?? 1);
  if (rate > 1) await (await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate', { rate });
  await page.goto('/');
});

test('3 spreads become 6 pages in reading order, exported as one PDF', async ({ page }) => {
  await bookMode(page);
  for (const n of [1, 2, 3]) await importSpread(page, spread(`book${n}.png`, { seed: n }));
  await expect(pagesList(page)).toHaveCount(6);
  const badges = await pagesList(page).locator('.badge').allTextContents();
  expect(badges).toEqual(['Spread 1 · L', 'Spread 1 · R', 'Spread 2 · L', 'Spread 2 · R', 'Spread 3 · L', 'Spread 3 · R']);
  await page.getByRole('button', { name: /Export PDF/ }).click();
  const dlg = page.getByRole('dialog', { name: 'Export PDF' });
  const [download] = await Promise.all([page.waitForEvent('download'), dlg.getByRole('button', { name: 'Download PDF' }).click()]);
  const doc = await PDFDocument.load(readFileSync((await download.path())!));
  expect(doc.getPageCount()).toBe(6);
});

test('a photo with no findable fold is flagged and cannot be applied until the user confirms', async ({ page }) => {
  await bookMode(page);
  await importSpread(page, spread('nofold.png', { fold: 0 }), false);
  const ed = review(page);
  await expect(ed.getByText(/could not find the fold/)).toBeVisible();
  await expect(ed.getByRole('button', { name: 'Apply' })).toBeDisabled();
  await ed.getByRole('button', { name: 'Confirm split' }).click();
  await expect(ed.getByRole('button', { name: 'Apply' })).toBeEnabled();
  await ed.getByRole('button', { name: 'Apply' }).click();
  await expect(pagesList(page)).toHaveCount(2);
});

test('moving a fold handle also confirms it, and the two ends can tilt the split', async ({ page }) => {
  await bookMode(page);
  await importSpread(page, spread('nofold.png', { fold: 0 }), false);
  const ed = review(page);
  const top = ed.getByRole('button', { name: /Fold, top end/ }), bottom = ed.getByRole('button', { name: /Fold, bottom end/ });
  const t0 = (await top.boundingBox())!, b0 = (await bottom.boundingBox())!;
  await top.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await bottom.focus(); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
  const t1 = (await top.boundingBox())!, b1 = (await bottom.boundingBox())!;
  expect(t1.x).toBeGreaterThan(t0.x);
  expect(b1.x).toBeLessThan(b0.x);
  expect(t1.y).toBeCloseTo(t0.y, 0); // ends slide along the outer edges only
  await expect(ed.getByRole('button', { name: 'Apply' })).toBeEnabled();
});

test('adjust each page gives 8 independent corners and can link back', async ({ page }) => {
  await bookMode(page);
  await importSpread(page, spread('book.png'), false);
  const ed = review(page);
  await expect(ed.locator('.handle')).toHaveCount(6);
  await ed.getByRole('button', { name: 'Adjust each page' }).click();
  await expect(ed.locator('.handle')).toHaveCount(8);
  const lp = ed.getByRole('button', { name: /Left page top right corner/ });
  const before = (await lp.boundingBox())!;
  await lp.focus(); for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  expect((await lp.boundingBox())!.x).toBeLessThan(before.x);
  await ed.getByRole('button', { name: 'Apply' }).click();
  await expect(pagesList(page)).toHaveCount(2);
  // The page keeps its own corners: reopening the spread starts in independent mode.
  await page.getByRole('button', { name: 'Edit spread for page 1' }).click();
  await expect(review(page).locator('.handle')).toHaveCount(8);
});

test('mixed single pages and spreads keep their order', async ({ page }) => {
  await page.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [{ name: 'p.png', mimeType: 'image/png', buffer: spreadPng(400, 500, { fold: 0 }) }]);
  await expect(pagesList(page)).toHaveCount(1);
  await bookMode(page);
  await importSpread(page);
  await page.getByRole('radio', { name: 'Single page' }).click();
  await page.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [{ name: 'q.png', mimeType: 'image/png', buffer: spreadPng(400, 500, { fold: 0 }) }]);
  await expect(pagesList(page)).toHaveCount(4);
  const badges = await pagesList(page).locator('.badge').allTextContents();
  expect(badges).toEqual(['Spread 1 · L', 'Spread 1 · R']);
  await expect(pagesList(page).nth(0).locator('.badge')).toHaveCount(0);
  await expect(pagesList(page).nth(3).locator('.badge')).toHaveCount(0);
});

test('retake keeps other spreads, ids/order, and a cancelled retake changes nothing; deleting a side then retaking keeps just that side', async ({ page }) => {
  await bookMode(page);
  await importSpread(page, spread('a.png', { seed: 1 }));
  await importSpread(page, spread('b.png', { seed: 2 }));
  await expect(pagesList(page)).toHaveCount(4);
  const ids = () => pagesList(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
  const before = await ids();

  // Cancelled retake: nothing changes.
  await page.getByRole('button', { name: 'Page 3 menu' }).click();
  await page.getByRole('dialog', { name: 'Page 3 menu' }).getByRole('button', { name: 'Retake spread' }).click();
  const cam = page.getByRole('dialog', { name: 'Camera' });
  await page.waitForFunction(() => (document.querySelector('video') as HTMLVideoElement)?.videoWidth > 0);
  await cam.getByRole('button', { name: 'Capture page' }).click();
  await expect(review(page)).toBeVisible();
  await expect(review(page).getByRole('heading', { name: 'Retake spread' })).toBeVisible();
  await review(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(review(page)).toBeHidden();
  expect(await ids()).toEqual(before);

  // Confirmed retake: same pages in the same slots.
  await page.getByRole('button', { name: 'Page 3 menu' }).click();
  await page.getByRole('dialog', { name: 'Page 3 menu' }).getByRole('button', { name: 'Retake spread' }).click();
  await page.waitForFunction(() => (document.querySelector('video') as HTMLVideoElement)?.videoWidth > 0);
  await page.getByRole('dialog', { name: 'Camera' }).getByRole('button', { name: 'Capture page' }).click();
  await expect(review(page)).toBeVisible();
  await review(page).getByRole('button', { name: 'Confirm split' }).click();
  await review(page).getByRole('button', { name: 'Replace' }).click();
  await expect(review(page)).toBeHidden();
  expect(await ids()).toEqual(before);

  // Delete the left side of spread 2, then retake: only the right side remains.
  await page.getByRole('button', { name: 'Page 3 menu' }).click();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('dialog', { name: 'Page 3 menu' }).getByRole('button', { name: 'Delete page' }).click();
  await expect(pagesList(page)).toHaveCount(3);
  await page.getByRole('button', { name: 'Page 3 menu' }).click(); // spread 2 R is now page 3
  await page.getByRole('dialog', { name: 'Page 3 menu' }).getByRole('button', { name: 'Retake spread' }).click();
  await page.waitForFunction(() => (document.querySelector('video') as HTMLVideoElement)?.videoWidth > 0);
  await page.getByRole('dialog', { name: 'Camera' }).getByRole('button', { name: 'Capture page' }).click();
  await review(page).getByRole('button', { name: 'Confirm split' }).click();
  await review(page).getByRole('button', { name: 'Replace' }).click();
  await expect(pagesList(page)).toHaveCount(3);
  expect((await ids()).slice(0, 2)).toEqual(before.slice(0, 2));
});

test('reorder then retake keeps the new order', async ({ page }) => {
  await bookMode(page);
  await importSpread(page, spread('a.png', { seed: 1 }));
  await importSpread(page, spread('b.png', { seed: 2 }));
  await page.getByRole('button', { name: 'Page 1 menu' }).click();
  await page.getByRole('dialog', { name: 'Page 1 menu' }).getByRole('button', { name: 'Move later' }).click();
  const ids = () => pagesList(page).evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
  const before = await ids();
  await page.getByRole('button', { name: 'Page 3 menu' }).click();
  await page.getByRole('dialog', { name: 'Page 3 menu' }).getByRole('button', { name: 'Retake spread' }).click();
  await page.waitForFunction(() => (document.querySelector('video') as HTMLVideoElement)?.videoWidth > 0);
  await page.getByRole('dialog', { name: 'Camera' }).getByRole('button', { name: 'Capture page' }).click();
  await review(page).getByRole('button', { name: 'Confirm split' }).click();
  await review(page).getByRole('button', { name: 'Replace' }).click();
  expect(await ids()).toEqual(before);
});

test('spreads survive a reload and keep their badges', async ({ page }) => {
  await bookMode(page);
  await importSpread(page);
  await importSpread(page, spread('b.png', { seed: 2 }));
  await page.reload();
  await expect(pagesList(page)).toHaveCount(4);
  expect(await pagesList(page).locator('.badge').allTextContents()).toEqual(['Spread 1 · L', 'Spread 1 · R', 'Spread 2 · L', 'Spread 2 · R']);
  await expect(page.getByRole('radio', { name: 'Book spread' })).toHaveAttribute('aria-checked', 'true');
  // Edit state survives too.
  await page.getByRole('button', { name: 'Edit spread for page 1' }).click();
  await expect(review(page).locator('.handle')).toHaveCount(6);
});

test('an unsaved spread review is recovered after a reload (resume or discard)', async ({ page }) => {
  await bookMode(page);
  await importSpread(page, spread('nofold.png', { fold: 0 }), false);
  const ed = review(page);
  const top = ed.getByRole('button', { name: /Fold, top end/ });
  await top.focus(); for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
  const moved = (await top.boundingBox())!.x;
  await page.waitForTimeout(900); // the draft is saved shortly after each change
  await page.reload();
  const dlg = page.getByRole('dialog', { name: 'Resume your edit?' });
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: 'Resume' }).click();
  await expect(review(page)).toBeVisible();
  const again = review(page).getByRole('button', { name: /Fold, top end/ });
  await expect.poll(async () => Math.abs(((await again.boundingBox())?.x ?? 0) - moved)).toBeLessThan(6);
  await expect(review(page).getByRole('button', { name: 'Apply' })).toBeEnabled(); // moving the fold had confirmed it
  await review(page).getByRole('button', { name: 'Cancel' }).click();
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Resume your edit?' })).toHaveCount(0); // cancelling discards the draft
  await expect(pagesList(page)).toHaveCount(0);
});

test('an unsaved page-editor change is recovered after a reload', async ({ page }) => {
  await page.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [{ name: 'p.png', mimeType: 'image/png', buffer: spreadPng(400, 500, { fold: 0 }) }]);
  await page.getByRole('button', { name: 'Edit page 1' }).click();
  const ed = page.getByRole('dialog', { name: 'Edit page' });
  const tl = ed.getByRole('button', { name: /Top left corner/ });
  await tl.focus(); for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  const moved = (await tl.boundingBox())!.x;
  await page.waitForTimeout(900);
  await page.reload();
  await page.getByRole('dialog', { name: 'Resume your edit?' }).getByRole('button', { name: 'Resume' }).click();
  const again = page.getByRole('dialog', { name: 'Edit page' }).getByRole('button', { name: /Top left corner/ });
  await expect.poll(async () => Math.abs(((await again.boundingBox())?.x ?? 0) - moved)).toBeLessThan(6);
});

test('when the browser is out of storage the user is told, nothing is half-added, and export still works', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __full: boolean }).__full = false;
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...a: Parameters<IDBObjectStore['put']>) {
      if ((window as unknown as { __full: boolean }).__full) throw new DOMException('quota', 'QuotaExceededError');
      return put.apply(this, a);
    };
  });
  await page.goto('/');
  await page.evaluate(() => { (window as unknown as { __full: boolean }).__full = true; });
  await page.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [{ name: 'p.png', mimeType: 'image/png', buffer: spreadPng(400, 500, { fold: 0 }) }]);
  await expect(page.getByText(/no space left/)).toBeVisible();
  await expect(pagesList(page)).toHaveCount(1); // still in memory
  await page.getByRole('button', { name: /Export PDF/ }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('dialog', { name: 'Export PDF' }).getByRole('button', { name: 'Download PDF' }).click()]);
  expect((await PDFDocument.load(readFileSync((await download.path())!))).getPageCount()).toBe(1);
  await page.getByRole('dialog', { name: 'Export PDF' }).getByRole('button', { name: 'Close' }).click();
  // Space comes back: the next successful save clears the warning.
  await page.evaluate(() => { (window as unknown as { __full: boolean }).__full = false; });
  await page.getByRole('button', { name: 'Page 1 menu' }).click();
  await page.getByRole('dialog', { name: 'Page 1 menu' }).getByRole('button', { name: 'Select' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [{ name: 'q.png', mimeType: 'image/png', buffer: spreadPng(400, 500, { fold: 0 }) }]);
  await expect(page.getByText(/no space left/)).toBeHidden();
});

test('a new app version shows an update banner and never reloads over an open edit', async ({ page }) => {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload(); // now controlled by the first worker
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [{ name: 'p.png', mimeType: 'image/png', buffer: spreadPng(400, 500, { fold: 0 }) }]);
  await page.getByRole('button', { name: 'Edit page 1' }).click();
  const ed = page.getByRole('dialog', { name: 'Edit page' });
  const tl = ed.getByRole('button', { name: /Top left corner/ });
  await tl.focus(); for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
  const moved = (await tl.boundingBox())!.x;
  // Publish a byte-different service worker, as a new release would (the preview server serves dist/ from disk).
  const swPath = new URL('../dist/sw.js', import.meta.url).pathname;
  const original = readFileSync(swPath, 'utf-8');
  writeFileSync(swPath, `${original}\n// release 2`);
  const banner = page.locator('.update-banner');
  try {
    // Keep the "release" published until the page has seen it (installing the worker takes a moment).
    await expect(async () => {
      await page.evaluate(async () => { const reg = await navigator.serviceWorker.getRegistration(); await reg!.update(); });
      await expect(banner).toContainText('A new version is ready', { timeout: 3000 });
    }).toPass({ timeout: 40_000 });
  } finally { writeFileSync(swPath, original); }
  await expect(ed).toBeVisible(); // nothing reloaded by itself
  await banner.getByRole('button', { name: 'Update' }).click();
  await page.getByRole('dialog', { name: 'Resume your edit?' }).getByRole('button', { name: 'Resume' }).click(); // the page reloaded; the edit was kept
  const again = page.getByRole('dialog', { name: 'Edit page' }).getByRole('button', { name: /Top left corner/ });
  await expect.poll(async () => Math.abs(((await again.boundingBox())?.x ?? 0) - moved)).toBeLessThan(6);
});

for (const vp of [{ width: 360, height: 640 }, { width: 390, height: 700 }]) {
  test(`mobile layout ${vp.width}x${vp.height}: no sideways scroll, scan button reachable, spread handles inside the stage`, async ({ page }) => {
    await page.setViewportSize(vp);
    const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    expect(await noOverflow()).toBe(true);
    await expect(page.getByRole('button', { name: 'Scan', exact: true })).toBeInViewport();
    await bookMode(page);
    for (const n of [1, 2]) await importSpread(page, spread(`b${n}.png`, { seed: n }), n === 1);
    const ed = review(page);
    const stage = ed.locator('.stage');
    await expect.poll(async () => {
      const s = (await stage.boundingBox())!;
      const hs = await ed.locator('.handle').evaluateAll((els) => els.map((e) => { const b = e.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; }));
      return hs.length === 6 && hs.every(([x, y]) => x >= s.x - 1 && x <= s.x + s.width + 1 && y >= s.y - 1 && y <= s.y + s.height + 1);
    }).toBe(true);
    // The tool rows and the Apply button stay on screen.
    await expect(ed.getByRole('button', { name: 'Apply' })).toBeInViewport();
    await expect(ed.getByRole('button', { name: 'Adjust each page' })).toBeInViewport();
    await ed.getByRole('button', { name: 'Apply' }).click();
    await expect(pagesList(page)).toHaveCount(4);
    expect(await noOverflow()).toBe(true);
    await expect(page.getByRole('button', { name: /Export PDF/ })).toBeInViewport();
  });
}
