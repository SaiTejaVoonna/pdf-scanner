const { chromium } = require('playwright');
(async () => { const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); const p = await b.newPage({ viewport: { width: 1360, height: 560 }, deviceScaleFactor: 2 });
  await p.goto('file://' + __dirname + '/logos.html'); await p.waitForTimeout(400); await p.screenshot({ path: __dirname + '/logos.png', fullPage: true }); await b.close(); })();
