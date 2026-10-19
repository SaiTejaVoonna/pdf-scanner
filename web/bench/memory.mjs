// Peak memory check on large photos. Usage: node bench/memory.mjs [spreads=3] [side=3000]   (needs `npm run build`)
// Runs the real build in Chromium, imports N book-spread photos (side x 0.75*side px JPEGs generated in the page), reviews and
// applies each, previews every page and exports a PDF, sampling the total resident memory of the browser process tree.
// Desktop Linux numbers only: a phone has different limits and was not measured.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';

const N = Number(process.argv[2] ?? 3), SIDE = Number(process.argv[3] ?? 3000);
const server = spawn('npx', ['vite', 'preview', '--port', '5177', '--strictPort'], { stdio: 'ignore', detached: true });
for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:5177/')).ok) break; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
// Playwright no longer exposes the browser pid, so sum every process whose command line is the Chromium we launched.
const exe = (process.env.CHROMIUM_PATH || '/opt/pw-browsers').replace(/\/[^/]*$/, '');
const rssOfTree = () => {
  let sum = 0;
  for (const pid of readdirSync('/proc').filter((d) => /^\d+$/.test(d))) {
    try {
      if (!readFileSync(`/proc/${pid}/cmdline`, 'utf-8').includes(exe) || Number(pid) === process.pid) continue;
      sum += Number(readFileSync(`/proc/${pid}/statm`, 'utf-8').split(' ')[1]) * 4096;
    } catch { /* process ended */ }
  }
  return sum;
};
let peak = 0, idle = 0; const timer = setInterval(() => { peak = Math.max(peak, rssOfTree()); }, 100);
const page = await browser.newPage({ viewport: { width: 390, height: 780 } });
await page.goto('http://localhost:5177/'); await page.waitForTimeout(1000); idle = rssOfTree();
const photo = async (seed) => Buffer.from(await page.evaluate(async ({ side, seed }) => {
  const w = side, h = Math.round(side * 0.75), c = new OffscreenCanvas(w, h), g = c.getContext('2d');
  g.fillStyle = '#505050'; g.fillRect(0, 0, w, h); g.fillStyle = '#e4e4e0'; g.fillRect(w * .1, h * .1, w * .8, h * .8);
  const grad = g.createLinearGradient(w * .47, 0, w * .53, 0); grad.addColorStop(0, '#e4e4e000'); grad.addColorStop(.5, '#777'); grad.addColorStop(1, '#e4e4e000'); g.fillStyle = grad; g.fillRect(w * .44, h * .1, w * .12, h * .8);
  g.fillStyle = '#222'; for (let y = h * .15 + seed; y < h * .85; y += h * .03) for (let x = w * .13; x < w * .87; x += w * .012) if (Math.abs(x - w / 2) > w * .05) g.fillRect(x, y, w * .008, h * .006);
  const b = await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 }); const buf = new Uint8Array(await b.arrayBuffer()); let bin = ''; for (let i = 0; i < buf.length; i += 32768) bin += String.fromCharCode(...buf.subarray(i, i + 32768)); return btoa(bin);
}, { side: SIDE, seed }), 'base64');
await page.getByRole('radio', { name: 'Book spread' }).click();
for (let i = 0; i < N; i++) {
  await page.setInputFiles('input[type=file][multiple]:not([accept*=pdf])', [{ name: `s${i}.jpg`, mimeType: 'image/jpeg', buffer: await photo(i) }]);
  const ed = page.getByRole('dialog', { name: 'Review spread' }); await ed.waitFor();
  const confirm = ed.getByRole('button', { name: 'Confirm split' }); if (await confirm.isVisible()) await confirm.click();
  await ed.getByRole('button', { name: 'Apply' }).click(); await ed.waitFor({ state: 'hidden' });
}
await page.getByRole('button', { name: 'Page 1 menu' }).click();
await page.getByRole('dialog', { name: 'Page 1 menu' }).getByRole('button', { name: 'Preview' }).click();
for (let i = 1; i < N * 2; i++) { await page.getByRole('button', { name: 'Next page' }).click(); await page.waitForTimeout(400); }
await page.getByRole('button', { name: 'Close preview' }).click();
await page.getByRole('button', { name: /Export PDF/ }).click();
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 120000 }), page.getByRole('dialog', { name: 'Export PDF' }).getByRole('button', { name: 'Download PDF' }).click()]);
const size = readFileSync(await dl.path()).length;
clearInterval(timer); peak = Math.max(peak, rssOfTree());
console.log(`${N} spreads of ${SIDE}x${Math.round(SIDE * .75)}: idle ${(idle / 1048576).toFixed(0)} MB, peak ${(peak / 1048576).toFixed(0)} MB resident (browser tree), PDF ${(size / 1048576).toFixed(1)} MB`);
await browser.close(); try { process.kill(-server.pid); } catch { /* gone */ }
