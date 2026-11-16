import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CornerNet, fastKernels, setFastKernels } from '../src/modelNet';
import { MODEL_FILE } from '../src/modelFile';

const here = (p: string) => new URL(p, import.meta.url);
const load = (p: string): CornerNet => { const buf = readFileSync(here(p)); return new CornerNet(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer); };
interface Fixture { corners: number[]; presenceLogit: number; var: number[]; mask?: number[] }

/** The same deterministic input that web/ml/export_weights.py feeds PyTorch. */
const parityInput = (size = 192): Float32Array => { const a = new Float32Array(3 * size * size); for (let i = 0; i < a.length; i++) a[i] = Math.sin(i * 0.001) * 1.5 + Math.cos(i * 0.0137); return a; };

for (const fast of [true, false]) for (const [engine, bin, fix] of [['v1', '../public/model/corners.bin', './fixtures/model-parity.json'], ['v2', '../public/model/corners2.bin', './fixtures/model2-parity.json']] as const) {
  describe.skipIf(!existsSync(here(bin)) || !existsSync(here(fix)))(`CornerNet (engine ${engine}, ${fast ? 'WebAssembly kernels' : 'TypeScript loops'}) matches PyTorch`, () => {
    it('gives the same corners, presence score and spread', () => {
      setFastKernels(fast); expect(fastKernels()).toBe(fast);
      const net = load(bin);
      expect(net.arch).toBe(engine === 'v2' ? 2 : 1);
      const want = JSON.parse(readFileSync(here(fix), 'utf-8')) as Fixture;
      const got = net.run(parityInput());
      want.corners.forEach((v, i) => expect(Math.abs(got.corners[i] - v), `corner value ${i}`).toBeLessThan(2e-4));
      expect(Math.abs(got.presenceLogit - want.presenceLogit)).toBeLessThan(2e-3);
      want.var.forEach((v, i) => expect(Math.abs(got.var[i] - v), `variance ${i}`).toBeLessThan(2e-4));
      if (engine === 'v1') { expect(got.mask).toBeUndefined(); return; }
      // the page mask: every one of the 48 x 48 logits, and no cell on the other side of "is page"
      expect(got.hm).toBe(48); expect(got.mask!.length).toBe(want.mask!.length);
      let worst = 0, flipped = 0;
      want.mask!.forEach((v, i) => { worst = Math.max(worst, Math.abs(got.mask![i] - v)); if (Math.abs(v) > 1e-2 && (v > 0) !== (got.mask![i] > 0)) flipped++; });
      expect(worst, 'largest mask difference').toBeLessThan(2e-3);
      expect(flipped, 'mask cells on the wrong side').toBe(0);
    });
  });
}

describe('the model file the app loads', () => {
  it('exists, and is the one the offline cache keeps', () => {
    expect(existsSync(here(`../public/${MODEL_FILE}`))).toBe(true);
    expect(readFileSync(here('../public/sw.js'), 'utf-8')).toContain(`'./${MODEL_FILE}'`);
  });
});
