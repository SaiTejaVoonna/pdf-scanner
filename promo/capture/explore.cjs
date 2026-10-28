// Walks the real workflow in the local build at phone size and lists the buttons in each state (exploration only).
const { chromium } = require('playwright');
const OUT = __dirname + '/explore/', DOCS = __dirname + '/docs/';
(async () => {
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light', acceptDownloads: true });
const p = await ctx.newPage();
await p.addInitScript(() => { try { localStorage.setItem('pdf-scanner.tip-keep', '1'); } catch {} });
await p.goto('http://localhost:4173/'); await p.waitForTimeout(800);
let n = 0; const shot = async (name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}${String(++n).padStart(2, '0')}-${name}.png` });
  const btns = await p.evaluate(() => [...document.querySelectorAll('button')].filter((x) => x.getBoundingClientRect().height > 0).map((x) => x.getAttribute('aria-label') || x.textContent.trim()).filter(Boolean));
  console.log(`[${name}]`, btns.slice(0, 40).join(' | ')); };
await shot('home');
await p.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [`${DOCS}photo-report.jpg`]);
await p.getByRole('list', { name: 'Pages' }).locator('li').first().waitFor(); await shot('pages-1');
await p.getByRole('button', { name: /Edit page 1/ }).click(); await p.waitForTimeout(1200); await shot('editor');
await p.getByRole('button', { name: /^Auto/ }).click(); await p.waitForTimeout(1500); await shot('editor-auto');
const look = p.getByRole('button', { name: /Look/ }); if (await look.count()) { await look.first().click(); await shot('editor-look'); }
await p.getByRole('radio', { name: 'Enhanced' }).click(); await shot('look-enhanced');
await p.getByRole('radio', { name: 'Black & white' }).click(); await shot('look-bw');
await p.getByRole('radio', { name: 'Enhanced' }).click();
await p.getByRole('button', { name: 'Save' }).click(); await p.waitForTimeout(800); await shot('pages-after-save');
await p.getByRole('button', { name: 'Add pages' }).click(); await shot('add-sheet');
await p.keyboard.press('Escape');
await p.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [`${DOCS}photo-notes.jpg`, `${DOCS}photo-plants.jpg`]);
await p.getByRole('list', { name: 'Pages' }).locator('li').nth(2).waitFor(); await shot('pages-3');
await p.getByRole('button', { name: 'Page 3 menu' }).click(); await shot('page-menu');
await p.keyboard.press('Escape');
await p.getByRole('button', { name: /Make PDF/ }).click(); await shot('make-pdf');
await b.close();
})();
