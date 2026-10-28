// Checks the "works offline" claim on the live site: load once, cut the network, reload, import a photo.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const p = await ctx.newPage();
  await p.goto('https://saitejavoonna.github.io/pdf-scanner/'); await p.waitForTimeout(4000);
  const sw = await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()));
  await p.reload(); await p.waitForTimeout(2500); // make sure the service worker controls the page
  await ctx.setOffline(true);
  await p.reload(); await p.waitForTimeout(2500);
  const title = await p.title();
  const scan = await p.getByRole('button', { name: /Scan/ }).count();
  await p.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [__dirname + '/docs/photo-report.jpg']);
  const added = await p.getByRole('list', { name: 'Pages' }).locator('li').first().waitFor({ timeout: 15000 }).then(() => true, () => false);
  console.log({ serviceWorker: sw, offlineTitle: title, scanButtons: scan, photoAddedOffline: added });
  await b.close();
})();
