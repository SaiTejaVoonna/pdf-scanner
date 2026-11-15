import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { findPage, quadIou } from '../../src/core/find';
import { pageLike, plausibleShape } from '../../src/core/anchor';
import { isValidCrop } from '../../src/core/geometry';
import { prepareInput, runModel } from '../../src/modelRun';
import { CornerNet } from '../../src/modelNet';

/**
 * Writes what each part says about every prepared photo (the rules, engine v1, engine v2) to dump.json, with the time each took,
 * so ways of combining them can be compared without running the engines again. Also writes the raw v2 outputs of the first 40
 * photos (dump-masks.json) so the mask check can be compared with the Python one.
 */
it('dumps rules, v1 and v2 for the prepared photos', () => {
  const dir = process.env.EVAL_DIR ?? '.';
  const load = (f: string) => { const b = readFileSync(`${__dirname}/../../public/model/${f}`); return new CornerNet(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); };
  const v1 = load('corners.bin'), v2 = load('corners2.bin');
  const meta = JSON.parse(readFileSync(`${dir}/eval.json`, 'utf-8')) as { name: string; w: number; h: number }[];
  const buf = readFileSync(`${dir}/eval.rgba`);
  let off = 0; const out: unknown[] = [], masks: unknown[] = []; const ms = { rules: 0, v1: 0, v2: 0 };
  for (const m of meta) {
    const n = m.w * m.h * 4;
    const img = { width: m.w, height: m.h, data: new Uint8ClampedArray(buf.subarray(off, off + n)) }; off += n;
    let t = performance.now(); const rules = findPage(img); ms.rules += performance.now() - t;
    t = performance.now(); const a = runModel(v1, img); ms.v1 += performance.now() - t;
    t = performance.now(); const b = runModel(v2, img); ms.v2 += performance.now() - t;
    const about = (f: typeof a) => ({ ...f, valid: isValidCrop(f.quad) && plausibleShape(f.quad, img.width, img.height, 3), like: pageLike(img, f.quad), iouRules: rules.quad ? quadIou(rules.quad, f.quad) : 0 });
    out.push({ name: m.name, rules, v1: about(a), v2: about(b) });
    if (masks.length < 300) { const o = v2.run(prepareInput(img, v2.input, v2.mean, v2.std)); masks.push({ corners: o.corners, mask: Array.from(o.mask!), ts: b.maskOverlap }); }
  }
  writeFileSync(`${dir}/dump.json`, JSON.stringify({ ms, out }));
  writeFileSync(`${dir}/dump-masks.json`, JSON.stringify(masks));
});
