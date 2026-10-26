// Render the next-* mock HTML files to PNG: node render_next.cjs (from docs/mocks)
const { chromium } = require('playwright');
const { readdirSync } = require('node:fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 2, viewport: { width: 1500, height: 900 } });
  for (const f of readdirSync(__dirname).filter((f) => /^next-.*\.html$/.test(f))) {
    await p.goto('file://' + __dirname + '/' + f);
    await p.screenshot({ path: __dirname + '/' + f.replace('.html', '.png'), fullPage: true });
    console.log(f);
  }
  await b.close();
})();
