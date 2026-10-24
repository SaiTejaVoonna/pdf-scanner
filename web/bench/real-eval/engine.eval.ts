import { readFileSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { pageLike, plausibleShape } from '../../src/core/anchor';
import { detectPage } from '../../src/core/detect';

/** Runs the page finder (and the "is it a page" checks the app uses before auto-capture) on every prepared photo. */
it('runs the engine on the prepared photos', () => {
  const dir = process.env.EVAL_DIR ?? process.argv.find((a) => a.startsWith('/')) ?? '.';
  const meta = JSON.parse(readFileSync(`${dir}/eval.json`, 'utf-8')) as { name: string; w: number; h: number }[];
  const buf = readFileSync(`${dir}/eval.rgba`);
  let off = 0; const out: unknown[] = []; const t0 = Date.now();
  for (const m of meta) {
    const n = m.w * m.h * 4;
    const img = { width: m.w, height: m.h, data: new Uint8ClampedArray(buf.subarray(off, off + n)) }; off += n;
    const q = detectPage(img);
    const shape = q ? plausibleShape(q, m.w, m.h, 2.4) : false;
    const like = q && shape ? pageLike(img, q) : { ok: false, why: null };
    out.push({ name: m.name, quad: q, shape, sure: like.ok, why: like.why });
  }
  writeFileSync(`${dir}/result.json`, JSON.stringify({ ms: Date.now() - t0, out }));
});
