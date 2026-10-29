// Records the live camera part (screenshots are too slow while the camera runs): home -> Scan -> outline -> auto-capture.
// Grabs CDP screenshots in a loop (about 30 fps at full phone resolution). Writes final2/camseq/NNNN.jpg and final2/camseq.json (frame times in s).
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${__dirname}/cam/report.y4m`] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, permissions: ['camera'] });
  const p = await ctx.newPage();
  await p.addInitScript(() => { try { localStorage.setItem('pdf-scanner.tip-keep', '1'); localStorage.setItem('pdf-scanner.auto', 'on'); } catch {} });
  await p.goto('http://localhost:4173/'); await p.waitForTimeout(1500);
  const dir = __dirname + '/final2/camseq/'; fs.mkdirSync(dir, { recursive: true });
  const cdp = await ctx.newCDPSession(p); const frames = [];
  let stop = false, t0 = Date.now();
  const grab = (async () => {
    while (!stop) {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 390, height: 844, scale: 2 } });
      const name = String(frames.length).padStart(4, '0'); frames.push({ f: name, t: (Date.now() - t0) / 1000 });
      fs.writeFileSync(dir + name + '.jpg', Buffer.from(data, 'base64'));
    }
  })();
  await p.waitForTimeout(700);
  const scanTap = (Date.now() - t0) / 1000;
  await p.getByRole('button', { name: 'Scan pages' }).click();
  await p.getByRole('button', { name: /^Done · 1/ }).waitFor({ timeout: 15000 });
  const captured = (Date.now() - t0) / 1000;
  await p.waitForTimeout(2000);
  stop = true; await grab;
  fs.writeFileSync(__dirname + '/final2/cam-marks.json', JSON.stringify({ scanTap, captured }));
  fs.writeFileSync(__dirname + '/final2/camseq.json', JSON.stringify(frames));
  console.log(frames.length, 'frames over', frames.at(-1).t.toFixed(2), 's');
  await b.close();
})();
