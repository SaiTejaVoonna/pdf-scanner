// Captures the real app (local production build, http://localhost:4173) at phone size for the reel.
// Writes final/<shot>.png (1170x2532, 3x) and final/layout.json (button boxes in CSS px, for tap marks).
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = __dirname + '/final/', DOCS = __dirname + '/docs/';
const FILE = 'input[type=file][multiple]:not([accept*=pdf])';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'light', acceptDownloads: true });
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { localStorage.setItem('pdf-scanner.tip-keep', '1'); localStorage.setItem('pdf-scanner.auto', 'off'); } catch {} });
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(1000);
  const layout = {};
  const box = async (key, loc) => { const r = await loc.boundingBox(); layout[key] = r; return r; };
  const shot = async (name, wait = 500) => { await p.waitForTimeout(wait); await p.screenshot({ path: `${OUT}${name}.png` }); };
  const noToast = async () => { await p.waitForFunction(() => !document.querySelector('.toast'), null, { timeout: 8000 }).catch(() => {}); };

  // Rename the draft so the title reads well on screen
  await shot('01-home');
  await box('import', p.getByRole('button', { name: 'Import photos' }).first());
  await p.setInputFiles(FILE, [`${DOCS}photo-report.jpg`]);
  await p.getByRole('list', { name: 'Pages' }).locator('li').first().waitFor(); await noToast();
  // Name the document like a person would
  await p.getByRole('button', { name: 'Rename document' }).click(); await p.waitForTimeout(400);
  const nameInput = p.locator('dialog[open] input[type=text], dialog[open] input:not([type])').first();
  await nameInput.fill('Physics notes'); await nameInput.press('Enter'); await p.waitForTimeout(500);
  await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(300);
  await shot('02-pages-1');
  await box('page1', p.getByRole('button', { name: /Edit page 1/ }));
  await p.getByRole('button', { name: /Edit page 1/ }).click(); await p.waitForTimeout(1400);
  await shot('03-editor-full');
  await box('auto', p.getByRole('button', { name: /^Auto/ }));
  await p.getByRole('button', { name: /^Auto/ }).click(); await p.waitForTimeout(1600);
  await shot('04-editor-auto');
  // A small real drag on the bottom-left corner, one frame per step
  const h = p.getByRole('button', { name: /^Bottom left corner/ });
  const r = await box('cornerBL', h); const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
  await p.mouse.move(cx, cy); await p.mouse.down();
  for (let i = 1; i <= 12; i++) { const t = i / 12, e = t * t * (3 - 2 * t); await p.mouse.move(cx - 7 * e, cy + 5 * e); await p.screenshot({ path: `${OUT}05-drag-${String(i).padStart(2, '0')}.png` }); }
  await p.mouse.up(); await shot('06-editor-after-drag', 400);
  await box('look', p.getByRole('button', { name: /^Look/ }));
  await p.getByRole('button', { name: /^Look/ }).click(); await shot('07-look-original', 900);
  await box('enhanced', p.getByRole('radio', { name: 'Enhanced' }));
  await p.getByRole('radio', { name: 'Enhanced' }).click(); await shot('08-look-enhanced', 900);
  await box('save', p.getByRole('button', { name: 'Save' }));
  await p.getByRole('button', { name: 'Save' }).click(); await p.waitForTimeout(900);
  // Turn on the real "Auto-crop imports" setting so the next photos arrive cropped
  await p.getByRole('button', { name: 'Back to documents' }).click(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'Settings', exact: true }).click(); await p.waitForTimeout(400);
  await p.getByLabel('Auto-crop imports').check(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'PDFs', exact: true }).click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: /Open draft|Continue|Physics notes/ }).first().click(); await p.waitForTimeout(800);
  await p.setInputFiles(FILE, [`${DOCS}photo-notes.jpg`, `${DOCS}photo-plants.jpg`]);
  await p.getByRole('list', { name: 'Pages' }).locator('li').nth(2).waitFor(); await p.waitForTimeout(2500); await noToast();
  await shot('09-pages-3');
  await box('addPages', p.getByRole('button', { name: 'Add pages' }));
  await p.getByRole('button', { name: 'Add pages' }).click(); await p.waitForTimeout(600);
  await box('spreadRadio', p.getByRole('radio', { name: 'Book spread' }));
  await p.getByRole('radio', { name: 'Book spread' }).click(); await shot('10-add-spread', 500);
  await box('importImages', p.getByRole('button', { name: 'Import images' }));
  await p.getByRole('button', { name: 'Close' }).click(); await p.waitForTimeout(500);
  await p.setInputFiles(FILE, [`${DOCS}photo-spread.jpg`]); await p.waitForTimeout(3500);
  await shot('11-spread-review');
  await p.getByRole('button', { name: 'Apply' }).click(); await p.waitForTimeout(2500); await noToast();
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot('12-pages-spread', 800);
  await box('makePdf', p.getByRole('button', { name: /Make PDF/ }));
  await p.getByRole('button', { name: /Make PDF/ }).click(); await p.waitForTimeout(5000);
  await shot('13-make-pdf', 300);
  await box('balanced', p.getByRole('radio', { name: /^Balanced/ }).or(p.getByRole('button', { name: /^Balanced/ })).first());
  await box('create', p.getByRole('button', { name: 'Create PDF' }));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Create PDF' }).click()]);
  await shot('14-pdf-saved', 1500); await dl.saveAs(OUT + 'reel.pdf');
  fs.writeFileSync(OUT + 'layout.json', JSON.stringify(layout, null, 1));
  console.log('download', dl.suggestedFilename());
  await b.close();
})();
