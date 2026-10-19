// Acceptance scoring for page/spread detection against hand labels.
//   node bench/score.mjs <photos-folder> <labels.json> [out.json]
// Labels: { "<id>": { file, expect: "spread"|"page"|"none", pages?: [quad, ...] } } (quads = fractions, clockwise from top-left).
// "Must-keep" content is approximated by each labelled page shrunk 5% toward its centre (for the four baseline photos
// the pages are full of writing); held-out sets should provide real must-keep polygons ("mustKeep": [polygon, ...]).
// Raw detection and manual correction are reported separately: this script scores RAW detection only.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = resolve(process.argv[2]), labels = JSON.parse(readFileSync(resolve(process.argv[3]), 'utf-8'));
const outFile = process.argv[4] ? resolve(process.argv[4]) : null;
const server = spawn('npx', ['vite', '--port', '5198', '--strictPort'], { stdio: 'ignore', detached: true });
const wait = async () => { for (let i = 0; i < 60; i++) { try { if ((await fetch('http://localhost:5198/')).ok) return; } catch { /* starting */ } await new Promise((r) => setTimeout(r, 500)); } throw new Error('dev server did not start'); };
const rows = [];
try {
  await wait();
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('http://localhost:5198/');
  for (const [id, lab] of Object.entries(labels)) {
    if (id.startsWith('_')) continue;
    const b64 = readFileSync(join(dir, lab.file)).toString('base64');
    const r = await page.evaluate(async ({ b64, lab }) => {
      const mod = await import('/src/core/detect/index.ts');
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes]), { imageOrientation: 'from-image' });
      const s = Math.min(1, 400 / Math.max(bmp.width, bmp.height));
      const w = Math.max(32, Math.round(bmp.width * s)), h = Math.max(32, Math.round(bmp.height * s));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(bmp, 0, 0, w, h);
      const d = c.getContext('2d').getImageData(0, 0, w, h);
      const t0 = performance.now();
      const img = { data: d.data, width: w, height: h };
      const detected = mod.detectDocument ? mod.detectDocument(img) : (() => { const q = mod.detectPage(img); return q ? { pages: [q] } : null; })();
      const ms = Math.round(performance.now() - t0);
      const quads = detected ? detected.pages : [];
      const inside = (q, x, y) => { let sg = 0; for (let i = 0; i < 4; i++) { const p = q[i], rr = q[(i + 1) % 4]; const cr = (rr.x - p.x) * (y - p.y) - (rr.y - p.y) * (x - p.x); const k = cr >= 0 ? 1 : -1; if (!sg) sg = k; else if (sg !== k) return false; } return true; };
      const shrink = (q, f) => { const cx = q.reduce((a, p) => a + p.x, 0) / 4, cy = q.reduce((a, p) => a + p.y, 0) / 4; return q.map((p) => ({ x: cx + (p.x - cx) * (1 - f), y: cy + (p.y - cy) * (1 - f) })); };
      const labelled = (lab.pages ?? []).map((q) => q.map(([x, y]) => ({ x, y })));
      const keep = lab.mustKeep ? lab.mustKeep.map((q) => q.map(([x, y]) => ({ x, y }))) : labelled.map((q) => shrink(q, 0.05));
      const N = 300; let det = 0, lab_ = 0, both = 0, uni = 0, keepArea = 0, keepIn = 0;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const x = (i + .5) / N, y = (j + .5) / N;
        const D = quads.some((q) => inside(q, x, y)), L = labelled.some((q) => inside(q, x, y)), K = keep.some((q) => inside(q, x, y));
        if (D) det++; if (L) lab_++; if (D && L) both++; if (D || L) uni++; if (K) { keepArea++; if (D) keepIn++; }
      }
      return { ms, found: quads.length, quads, iou: uni ? both / uni : 0, loss: keepArea ? 1 - keepIn / keepArea : 0, extra: det ? 1 - both / det : 0, uncertain: detected?.uncertain ?? null };
    }, { b64, lab });
    const expectNone = lab.expect === 'none';
    const pass = expectNone ? r.found === 0 : r.found > 0 && r.loss <= 0.005 && r.extra <= 0.15;
    rows.push({ id, expect: lab.expect, weak: !!lab.weak, ...r, pass });
  }
  await browser.close();
} finally { try { process.kill(-server.pid); } catch { /* already gone */ } }
const pct = (v) => `${(v * 100).toFixed(1)}%`;
console.log('id'.padEnd(24), 'expect'.padEnd(7), 'found', 'IoU'.padStart(6), 'loss'.padStart(7), 'extra'.padStart(7), 'ms'.padStart(5), 'pass');
for (const r of rows) console.log(r.id.padEnd(24), r.expect.padEnd(7), String(r.found).padEnd(5), pct(r.iou).padStart(6), pct(r.loss).padStart(7), pct(r.extra).padStart(7), String(r.ms).padStart(5), r.pass ? 'PASS' : 'FAIL');
console.log(`\n${rows.filter((r) => r.pass).length}/${rows.length} pass (loss <= 0.5% of must-keep area, extra background <= 15%; "none" expects no detection)`);
if (outFile) writeFileSync(outFile, JSON.stringify(rows, null, 1));
