import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CornerNet } from '../src/modelNet';

const BIN = new URL('../public/model/corners.bin', import.meta.url), FIX = new URL('./fixtures/model-parity.json', import.meta.url);
const have = existsSync(BIN) && existsSync(FIX);

/** The same deterministic input that web/ml/export_weights.py feeds PyTorch. */
const parityInput = (size = 192): Float32Array => { const a = new Float32Array(3 * size * size); for (let i = 0; i < a.length; i++) a[i] = Math.sin(i * 0.001) * 1.5 + Math.cos(i * 0.0137); return a; };

describe.skipIf(!have)('CornerNet in TypeScript matches PyTorch', () => {
  it('gives the same corners, presence score and spread', () => {
    const buf = readFileSync(BIN); const net = new CornerNet(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
    const want = JSON.parse(readFileSync(FIX, 'utf-8')) as { corners: number[]; presenceLogit: number; var: number[] };
    const got = net.run(parityInput());
    want.corners.forEach((v, i) => expect(Math.abs(got.corners[i] - v), `corner value ${i}`).toBeLessThan(2e-4));
    expect(Math.abs(got.presenceLogit - want.presenceLogit)).toBeLessThan(2e-3);
    want.var.forEach((v, i) => expect(Math.abs(got.var[i] - v), `variance ${i}`).toBeLessThan(2e-4));
  });
});
