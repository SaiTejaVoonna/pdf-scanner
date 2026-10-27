import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { combine, findPage, quadIou } from '../../src/core/find';
import type { Quad } from '../../src/core/geometry';
import { refineQuad, type RefineOptions } from '../../src/core/refine';
import { runModel } from '../../src/modelRun';
import { CornerNet } from '../../src/modelNet';

/**
 * Scores today's pipeline with and without edge snapping on the prepared photos (EVAL_DIR). SPLIT=dev|test|all picks the first
 * half (tuning), the second half (reporting) or everything; REFINE is a JSON object of refineQuad options.
 */
it('edge snapping on the prepared photos', () => {
  const dir = process.env.EVAL_DIR ?? '.';
  const opts = JSON.parse(process.env.REFINE ?? '{}') as RefineOptions;
  const bin = readFileSync(process.env.MODEL_BIN ?? `${__dirname}/../../public/model/corners.bin`);
  const net = new CornerNet(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer);
  const meta = JSON.parse(readFileSync(`${dir}/eval.json`, 'utf-8')) as { name: string; w: number; h: number; gt: number[][] | null }[];
  const buf = readFileSync(`${dir}/eval.rgba`);
  const split = process.env.SPLIT ?? 'all', half = meta.length >> 1;
  // The rules + model answer does not depend on the snapping settings, so it is computed once and cached.
  const cacheFile = `${dir}/base-quads.json`;
  const cache: Record<string, { quad: Quad | null; conf: string }> = existsSync(cacheFile) ? JSON.parse(readFileSync(cacheFile, 'utf-8')) : {};
  let off = 0; const rows: { name: string; before: number; after: number; moved: number; quad: Quad | null; refined: Quad | null; conf: string }[] = [];
  let ms = 0;
  meta.forEach((m, k) => {
    const n = m.w * m.h * 4;
    const img = { width: m.w, height: m.h, data: new Uint8ClampedArray(buf.subarray(off, off + n)) }; off += n;
    if ((split === 'dev' && k >= half) || (split === 'test' && k < half)) return;
    const c = cache[m.name] ?? (cache[m.name] = (({ quad, confidence }) => ({ quad, conf: confidence }))(combine(img, findPage(img), runModel(net, img))));
    const t0 = performance.now();
    const r = c.quad ? refineQuad(img, c.quad, opts) : null;
    ms += performance.now() - t0;
    const gt = m.gt ? m.gt.map(([x, y]) => ({ x, y })) as Quad : null;
    rows.push({ name: m.name, conf: c.conf, quad: c.quad, refined: r?.quad ?? null, moved: r?.moved ?? 0,
      before: gt && c.quad ? quadIou(gt, c.quad, 128) : 0, after: gt && r ? quadIou(gt, r.quad, 128) : 0 });
  });
  const pct = (f: (x: typeof rows[0]) => boolean) => `${Math.round(100 * rows.filter(f).length / rows.length)}%`;
  if (meta[0].gt) {
    console.log(`n=${rows.length} split=${split} opts=${JSON.stringify(opts)} refine ${(ms / rows.length).toFixed(1)} ms/img`);
    console.log(`  before: IoU>=0.9 ${pct((x) => x.before >= 0.9)}  >=0.8 ${pct((x) => x.before >= 0.8)}  mean ${(rows.reduce((s, x) => s + x.before, 0) / rows.length).toFixed(3)}`);
    console.log(`  after:  IoU>=0.9 ${pct((x) => x.after >= 0.9)}  >=0.8 ${pct((x) => x.after >= 0.8)}  mean ${(rows.reduce((s, x) => s + x.after, 0) / rows.length).toFixed(3)}`);
    console.log(`  better ${rows.filter((x) => x.after > x.before + 0.01).length}  worse ${rows.filter((x) => x.after < x.before - 0.01).length}  worse by >0.05 ${rows.filter((x) => x.after < x.before - 0.05).length}`);
  }
  writeFileSync(cacheFile, JSON.stringify(cache));
  writeFileSync(`${dir}/result-refine.json`, JSON.stringify(rows));
}, 600_000);
