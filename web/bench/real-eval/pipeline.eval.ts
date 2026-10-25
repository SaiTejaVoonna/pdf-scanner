import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { combine, findPage } from '../../src/core/find';
import { runModel } from '../../src/modelRun';
import { CornerNet } from '../../src/modelNet';

/**
 * Runs the whole decision (rules + model + combine) on every prepared photo and writes result-pipeline.json in the format score.py reads
 * (`sure` = the page would be accepted as "high"). MODEL_BIN is the exported model (web/ml/export_weights.py).
 */
it('runs rules + model + combine on the prepared photos', () => {
  const dir = process.env.EVAL_DIR ?? '.';
  const bin = readFileSync(process.env.MODEL_BIN ?? `${__dirname}/../../public/model/corners.bin`);
  const net = new CornerNet(bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength) as ArrayBuffer);
  const meta = JSON.parse(readFileSync(`${dir}/eval.json`, 'utf-8')) as { name: string; w: number; h: number }[];
  const buf = readFileSync(`${dir}/eval.rgba`);
  let off = 0; const out: unknown[] = []; const t0 = Date.now();
  for (const m of meta) {
    const n = m.w * m.h * 4;
    const img = { width: m.w, height: m.h, data: new Uint8ClampedArray(buf.subarray(off, off + n)) }; off += n;
    const c = combine(img, findPage(img), runModel(net, img));
    out.push({ name: m.name, quad: c.quad, sure: c.confidence === 'high', conf: c.confidence, source: c.source });
  }
  writeFileSync(`${dir}/result-pipeline.json`, JSON.stringify({ ms: Date.now() - t0, out }));
});
