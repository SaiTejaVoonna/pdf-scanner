// Exploration part 2: auto-crop imports setting, export to a saved PDF, book spread import.
const { chromium } = require('playwright');
const OUT = __dirname + '/explore/', DOCS = __dirname + '/docs/';
(async () => {
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
const p = await ctx.newPage();
await p.addInitScript(() => { try { localStorage.setItem('pdf-scanner.tip-keep', '1'); } catch {} });
await p.goto('http://localhost:4173/'); await p.waitForTimeout(800);
let n = 20; const shot = async (name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}${++n}-${name}.png` });
  const btns = await p.evaluate(() => [...document.querySelectorAll('button')].filter((x) => x.getBoundingClientRect().height > 0).map((x) => x.getAttribute('aria-label') || x.textContent.trim()).filter(Boolean));
  console.log(`[${name}]`, btns.join(' | ').slice(0, 500)); };
await p.getByRole('button', { name: 'Settings', exact: true }).click();
await p.getByLabel('Auto-crop imports').check(); await shot('settings');
await p.getByRole('button', { name: 'PDFs', exact: true }).click();
await p.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', ['report', 'notes', 'plants'].map((f) => `${DOCS}photo-${f}.jpg`));
await p.getByRole('list', { name: 'Pages' }).locator('li').nth(2).waitFor(); await p.waitForTimeout(2500); await shot('pages-autocrop');
await p.getByRole('button', { name: /Make PDF/ }).click(); await p.waitForTimeout(4000); await shot('make-pdf-sizes');
const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Create PDF' }).click()]);
await p.waitForTimeout(1500); await shot('pdf-saved'); await dl.saveAs(OUT + 'out.pdf'); console.log('download', dl.suggestedFilename());
await p.getByRole('button', { name: 'Keep scanning' }).click().catch(() => {}); await p.waitForTimeout(400);
await p.getByRole('button', { name: 'Back to documents' }).click().catch(() => {}); await shot('home-with-pdf');
// book spread
await p.getByRole('button', { name: 'Import photos' }).first().click().catch(() => {}); await shot('import-sheet');
await p.getByRole('radio', { name: 'Book spread' }).click().catch((e) => console.log('no spread radio', e.message));
await p.keyboard.press('Escape');
await p.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [`${DOCS}photo-spread.jpg`]);
await p.waitForTimeout(3000); await shot('after-spread');
await b.close();
})();
