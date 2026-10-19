// Probe: runs a DocAligner ONNX model with onnxruntime-web (wasm, 1 thread) in Chromium and reports load/inference time.
// Setup (outside the repo): npm pack onnxruntime-web, copy its dist/ to <dir>/ort and the model to <dir>/model.onnx; then
//   CHROMIUM_PATH=... node ort_web_probe.mjs <photos-folder>   (edit the paths below). Not part of the app or its bundle.
import { chromium } from '/home/user/pdf-scanner/web/node_modules/@playwright/test/index.mjs';
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
const S = process.argv[2];
const types = { '.mjs': 'text/javascript', '.js': 'text/javascript', '.wasm': 'application/wasm', '.html': 'text/html', '.onnx': 'application/octet-stream' };
const srv = http.createServer((q, r) => { const f = '/tmp/ortweb' + (q.url === '/' ? '/index.html' : q.url.split('?')[0]); if (!existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[f.slice(f.lastIndexOf('.'))] ?? 'text/plain' }); r.end(readFileSync(f)); }).listen(5611);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] });
const p = await b.newPage(); await p.goto('http://localhost:5611/');
const img = readFileSync(S + '/photos/766c1a60-image.jpg').toString('base64');
const out = await p.evaluate(async (img) => {
  const ort = await import('/ort/ort.wasm.min.mjs');
  ort.env.wasm.wasmPaths = '/ort/'; ort.env.wasm.numThreads = 1;
  const t0 = performance.now();
  const sess = await ort.InferenceSession.create('/lcnet100.onnx', { executionProviders: ['wasm'] });
  const load = performance.now() - t0;
  const bmp = await createImageBitmap(new Blob([Uint8Array.from(atob(img), (c) => c.charCodeAt(0))]), { imageOrientation: 'from-image' });
  const c = new OffscreenCanvas(256, 256); const g = c.getContext('2d'); g.drawImage(bmp, 0, 0, 256, 256);
  const d = g.getImageData(0, 0, 256, 256).data; const x = new Float32Array(3 * 256 * 256);
  for (let i = 0; i < 65536; i++) { x[i] = d[i * 4] / 255; x[65536 + i] = d[i * 4 + 1] / 255; x[131072 + i] = d[i * 4 + 2] / 255; }
  const run = async () => { const t = performance.now(); const r = await sess.run({ [sess.inputNames[0]]: new ort.Tensor('float32', x, [1, 3, 256, 256]) }); return [performance.now() - t, r]; };
  await run(); const times = []; let last; for (let i = 0; i < 5; i++) { const [t, r] = await run(); times.push(t); last = r; }
  const o = last[sess.outputNames[0]]; let sum = 0; for (const v of o.data) sum += v;
  return { load: Math.round(load), runMs: times.map((t) => Math.round(t)), dims: o.dims, heatSum: sum.toFixed(2), threads: ort.env.wasm.numThreads };
}, img);
console.log(JSON.stringify(out));
await b.close(); srv.close();
