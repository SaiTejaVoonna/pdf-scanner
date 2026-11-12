// Renders <name>.html to <name>.png (all screens) and one PNG per phone: node render.cjs [next-ui|notebook]
const { chromium } = require('playwright');
const name = process.argv[2] || 'next-ui';
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1840, height: 1040 }, deviceScaleFactor: 2 });
  await p.goto('file://' + __dirname + `/${name}.html`);
  await p.evaluate(() => document.fonts.ready); await p.screenshot({ path: `${__dirname}/${name}.png`, fullPage: true });
  for (const id of ['home', 'tools', 'result', 'idcard']) await p.locator(`#${id} .phone`).screenshot({ path: `${__dirname}/${name === 'next-ui' ? '' : name + '-'}${id}.png` });
  await b.close();
})();
