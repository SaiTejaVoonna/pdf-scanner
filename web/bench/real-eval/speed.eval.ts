import { readFileSync } from 'node:fs';
import { it } from 'vitest';
import { CornerNet } from '../../src/modelNet';

/** Time of one run of each engine on this machine (median of 15), on a fixed input. Needs no photos. */
it('times engine v1 and v2', () => {
  const input = new Float32Array(3 * 192 * 192); for (let i = 0; i < input.length; i++) input[i] = Math.sin(i * 0.001) * 1.5 + Math.cos(i * 0.0137);
  for (const f of ['corners.bin', 'corners2.bin']) {
    const b = readFileSync(`${__dirname}/../../public/model/${f}`);
    const net = new CornerNet(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
    for (let i = 0; i < 3; i++) net.run(input);
    const t: number[] = []; for (let i = 0; i < 15; i++) { const t0 = performance.now(); net.run(input); t.push(performance.now() - t0); }
    t.sort((a, b) => a - b); console.log(`${f}: median ${t[7].toFixed(0)} ms, fastest ${t[0].toFixed(0)} ms`);
  }
});
