// Page-detection benchmark. Usage:
//   node bench/run.mjs <folder-with-photos> [outDir]
// For each photo (png/jpg/webp) it runs the real detector in Chromium and writes <name>-detected.png with the result
// drawn on it. If <name>.json exists next to the photo ({"corners":[[x,y],[x,y],[x,y],[x,y]]} as 0..1 fractions,
// clockwise from top-left) it also reports the overlap (IoU) with that ground truth. Photos stay on your machine.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

const dir = resolve(process.argv[2] ?? 'bench/photos');
const out = resolve(process.argv[3] ?? join(dir, 'out'));
mkdirSync(out, { recursive: true });
const files = readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
if (!files.length) { console.error(`No images found in ${dir}`); process.exit(1); }

const server = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { stdio: 'ignore' });
const wait = async () => { for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:5199/')).ok) return; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); } throw new Error('dev server did not start'); };
try {
  await wait();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:5199/');
  let found = 0, scored = 0, iouSum = 0;
  for (const f of files) {
    const b64 = readFileSync(join(dir, f)).toString('base64');
    const res = await page.evaluate(async ({ b64, mime }) => {
      const { detectPage } = await import('/src/core/detect/index.ts');
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: mime }), { imageOrientation: 'from-image' });
      const s = Math.min(1, 400 / Math.max(bmp.width, bmp.height));
      const w = Math.max(32, Math.round(bmp.width * s)), h = Math.max(32, Math.round(bmp.height * s));
      const small = document.createElement('canvas'); small.width = w; small.height = h;
      small.getContext('2d').drawImage(bmp, 0, 0, w, h);
      const d = small.getContext('2d').getImageData(0, 0, w, h);
      const t0 = performance.now();
      const q = detectPage({ data: d.data, width: w, height: h });
      const ms = Math.round(performance.now() - t0);
      const big = document.createElement('canvas'); big.width = bmp.width; big.height = bmp.height;
      const g = big.getContext('2d'); g.drawImage(bmp, 0, 0);
      if (q) {
        g.lineWidth = Math.max(3, bmp.width / 150); g.strokeStyle = '#ff2d55'; g.fillStyle = '#ff2d55';
        g.beginPath(); q.forEach((p, i) => (i ? g.lineTo(p.x * bmp.width, p.y * bmp.height) : g.moveTo(p.x * bmp.width, p.y * bmp.height))); g.closePath(); g.stroke();
        q.forEach((p) => { g.beginPath(); g.arc(p.x * bmp.width, p.y * bmp.height, g.lineWidth * 2, 0, 7); g.fill(); });
      }
      return { q, ms, png: big.toDataURL('image/png').split(',')[1], w: bmp.width, h: bmp.height };
    }, { b64, mime: /png$/i.test(f) ? 'image/png' : /webp$/i.test(f) ? 'image/webp' : 'image/jpeg' });
    writeFileSync(join(out, `${basename(f, extname(f))}-detected.png`), Buffer.from(res.png, 'base64'));
    let line = `${f}: ${res.q ? 'found' : 'none (full image kept)'} in ${res.ms} ms`;
    if (res.q) found++;
    const gtFile = join(dir, `${basename(f, extname(f))}.json`);
    if (existsSync(gtFile) && res.q) {
      const gt = JSON.parse(readFileSync(gtFile, 'utf-8')).corners.map(([x, y]) => ({ x, y }));
      const iou = await page.evaluate(({ a, b }) => {
        const N = 200, inside = (q, x, y) => { let s = 0; for (let i = 0; i < 4; i++) { const p = q[i], r = q[(i + 1) % 4]; const c = (r.x - p.x) * (y - p.y) - (r.y - p.y) * (x - p.x); const k = c >= 0 ? 1 : -1; if (!s) s = k; else if (s !== k) return false; } return true; };
        let inter = 0, uni = 0;
        for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const x = (i + .5) / N, y = (j + .5) / N, A = inside(a, x, y), B = inside(b, x, y); if (A && B) inter++; if (A || B) uni++; }
        return uni ? inter / uni : 0;
      }, { a: res.q, b: gt });
      scored++; iouSum += iou; line += `, overlap with ground truth ${(iou * 100).toFixed(0)}%`;
    } else if (existsSync(gtFile)) line += ', ground truth given but nothing detected (counts as a miss)', scored++;
    console.log(line);
  }
  console.log(`\n${found}/${files.length} detected` + (scored ? `; mean overlap ${(100 * iouSum / scored).toFixed(0)}% over ${scored} with ground truth` : ''));
  console.log(`Annotated images: ${out}`);
  await browser.close();
} finally { server.kill(); }
