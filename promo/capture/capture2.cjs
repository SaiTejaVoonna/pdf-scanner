// Captures the real app (local production build, http://localhost:4173) at phone size for the second reel.
// The in-app camera is fed cam/report.y4m (a phone-style view of the sample report, made by make_cam.py),
// so the live outline and auto-capture are the app's own. Writes final2/<shot>.png (1170x2532, 3x),
// final2/layout.json (button boxes in CSS px), final2/cam.json (camera frame times) and final2/facts.json (sizes the app showed).
const { chromium } = require('playwright');
const fs = require('fs');
const OUT = __dirname + '/final2/', DOCS = __dirname + '/docs/';
const FILE = 'input[type=file][multiple]:not([accept*=pdf])';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${__dirname}/cam/report.y4m`] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'light', acceptDownloads: true, permissions: ['camera'] });
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { localStorage.setItem('pdf-scanner.tip-keep', '1'); localStorage.setItem('pdf-scanner.auto', 'on'); } catch {} });
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(1000);
  const layout = {}, facts = {};
  const box = async (key, loc) => { const r = await loc.boundingBox(); layout[key] = r; return r; };
  const shot = async (name, wait = 500) => { await p.waitForTimeout(wait); await p.screenshot({ path: `${OUT}${name}.png` }); };
  const noToast = async () => { await p.waitForFunction(() => !document.querySelector('.toast'), null, { timeout: 8000 }).catch(() => {}); };

  // 1 · Home, then Scan: the live camera finds the page and auto-captures it
  await shot('01-home');
  await box('scan', p.getByRole('button', { name: 'Scan pages' }));
  await p.getByRole('button', { name: 'Scan pages' }).click();
  const t0 = Date.now(), cam = [];
  for (let i = 0; i < 40; i++) {
    const name = `cam-${String(i).padStart(2, '0')}`;
    await p.screenshot({ path: `${OUT}${name}.png` }); cam.push({ src: name, t: (Date.now() - t0) / 1000 });
    await p.waitForTimeout(60);
    if (cam[cam.length - 1].t > 4.2) break;
  }
  fs.writeFileSync(OUT + 'cam.json', JSON.stringify(cam, null, 1));
  await box('done', p.getByRole('button', { name: /^Done/ }));
  await p.getByRole('button', { name: /^Done/ }).click(); await p.waitForTimeout(1200); await noToast();
  await p.getByRole('button', { name: 'Rename document' }).click(); await p.waitForTimeout(400);
  const nameInput = p.locator('dialog[open] input[type=text], dialog[open] input:not([type])').first();
  await nameInput.fill('Physics notes'); await nameInput.press('Enter'); await p.waitForTimeout(500);
  await p.keyboard.press('Escape').catch(() => {}); await p.waitForTimeout(300);
  await shot('02-pages-1');
  await box('page1', p.getByRole('button', { name: /Edit page 1/ }));

  // 2 · Look: Original, then Enhanced
  await p.getByRole('button', { name: /Edit page 1/ }).click(); await p.waitForTimeout(1400);
  await shot('03-editor');
  await box('look', p.getByRole('button', { name: /^Look/ }));
  await p.getByRole('button', { name: /^Look/ }).click(); await shot('04-look-original', 900);
  await box('enhanced', p.getByRole('radio', { name: 'Enhanced' }));
  await p.getByRole('radio', { name: 'Enhanced' }).click(); await shot('05-look-enhanced', 900);
  await p.getByRole('button', { name: 'Save' }).click(); await p.waitForTimeout(900);

  // 3 · More pages (the real "Auto-crop imports" setting is turned on off-screen), then a book spread
  await p.getByRole('button', { name: 'Back to documents' }).click(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'Settings', exact: true }).click(); await p.waitForTimeout(400);
  await p.getByLabel('Auto-crop imports').check(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'PDFs', exact: true }).click(); await p.waitForTimeout(400);
  await p.getByRole('button', { name: /Open draft|Continue|Physics notes/ }).first().click(); await p.waitForTimeout(800);
  await p.setInputFiles(FILE, [`${DOCS}photo-notes.jpg`, `${DOCS}photo-plants.jpg`]);
  await p.getByRole('list', { name: 'Pages' }).locator('li').nth(2).waitFor(); await p.waitForTimeout(2500); await noToast();
  await shot('06-pages-3');
  await box('addPages', p.getByRole('button', { name: 'Add pages' }));
  await p.getByRole('button', { name: 'Add pages' }).click(); await p.waitForTimeout(600);
  await p.getByRole('radio', { name: 'Book spread' }).click(); await shot('07-add-spread', 500);
  await box('importImages', p.getByRole('button', { name: 'Import images' }));
  await p.getByRole('button', { name: 'Close' }).click(); await p.waitForTimeout(500);
  await p.setInputFiles(FILE, [`${DOCS}photo-spread.jpg`]); await p.waitForTimeout(3500);
  await p.getByRole('button', { name: 'Apply' }).click(); await p.waitForTimeout(2500); await noToast();
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await shot('08-pages-spread', 800);

  // 4 · Make PDF: the estimated size of every quality, pick the best one under 200 KB, save
  await box('makePdf', p.getByRole('button', { name: /Make PDF/ }));
  await p.getByRole('button', { name: /Make PDF/ }).click();
  await p.waitForFunction(() => ![...document.querySelectorAll('.qcard .size')].some((e) => e.textContent.includes('Calculating')), null, { timeout: 30000 });
  await shot('09-make-pdf', 400);
  const cards = await p.locator('.qcard').evaluateAll((els) => els.map((e) => ({ name: e.querySelector('strong').textContent, size: e.querySelector('.size').textContent })));
  facts.qualities = cards;
  const kb = (s) => { const m = s.match(/([\d.]+)\s*(KB|MB)/); return m ? parseFloat(m[1]) * (m[2] === 'MB' ? 1024 : 1) : Infinity; };
  const pick = cards.find((c) => kb(c.size) < 200);
  if (!pick) throw new Error('No quality is under 200 KB: ' + JSON.stringify(cards));
  facts.picked = pick;
  const card = p.locator('.qcard', { hasText: pick.name }).first();
  await box('quality', card);
  await card.click(); await shot('10-make-pdf-picked', 400);
  await box('create', p.getByRole('button', { name: 'Create PDF' }));
  const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Create PDF' }).click()]);
  await shot('11-pdf-saved', 1500); await dl.saveAs(OUT + 'reel.pdf');
  facts.pdfBytes = fs.statSync(OUT + 'reel.pdf').size;
  await p.getByRole('button', { name: 'Keep scanning' }).click(); await p.waitForTimeout(500);
  await p.getByRole('button', { name: 'Back to documents' }).click(); await p.waitForTimeout(600);

  // 5 · Tools, then Resize photo with a 50 KB limit
  await p.getByRole('button', { name: 'Tools', exact: true }).click(); await shot('12-tools', 600);
  for (const [k, n] of [['tCompress', 'Compress PDF'], ['tResize', 'Resize photo'], ['tCombine', 'Combine PDFs'], ['tSplit', 'Split PDF']]) await box(k, p.locator('.tool-tile', { hasText: n }));
  await p.locator('.tool-tile', { hasText: 'Resize photo' }).click(); await p.waitForTimeout(700);
  await p.setInputFiles('dialog[open] input[type=file]', [`${DOCS}photo-plants.jpg`]); await p.waitForTimeout(1200);
  await p.getByLabel('Largest file (KB)').fill('50'); await p.waitForTimeout(300);
  await shot('13-resize-set', 300);
  await box('resizeGo', p.getByRole('button', { name: 'Resize', exact: true }));
  await p.getByRole('button', { name: 'Resize', exact: true }).click();
  await p.getByText(/Done: 1 image/).waitFor({ timeout: 20000 }).catch(() => {});
  await shot('14-resize-done', 800);
  facts.resize = await p.locator('.result-list').innerText().catch(() => '');
  fs.writeFileSync(OUT + 'layout.json', JSON.stringify(layout, null, 1));
  fs.writeFileSync(OUT + 'facts.json', JSON.stringify(facts, null, 1));
  console.log(JSON.stringify(facts, null, 1));
  await b.close();
})();
