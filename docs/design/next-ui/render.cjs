// Renders next-ui.html to next-ui.png (all screens) and one PNG per phone.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 1840, height: 1040 }, deviceScaleFactor: 2 });
  await p.goto('file://' + __dirname + '/next-ui.html');
  await p.screenshot({ path: __dirname + '/next-ui.png', fullPage: true });
  for (const id of ['home', 'tools', 'result', 'idcard']) await p.locator(`#${id} .phone`).screenshot({ path: `${__dirname}/${id}.png` });
  await b.close();
})();
