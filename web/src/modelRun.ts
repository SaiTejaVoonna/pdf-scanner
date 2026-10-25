import type { Quad } from './core/geometry';
import type { Img } from './core/image';
import type { ModelFind } from './core/find';
import type { CornerNet } from './modelNet';

/** Box-averages `img` down to size x size (squashing the aspect ratio, as in training) and normalises it, channel-first. */
export function prepareInput(img: Img, size: number, mean: number, std: number): Float32Array {
  const out = new Float32Array(3 * size * size);
  const { width: w, height: h, data } = img;
  for (let y = 0; y < size; y++) {
    const y0 = Math.floor((y * h) / size), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / size));
    for (let x = 0; x < size; x++) {
      const x0 = Math.floor((x * w) / size), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / size));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * w + xx) * 4; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
      const o = y * size + x;
      out[o] = (r / n / 255 - mean) / std; out[size * size + o] = (g / n / 255 - mean) / std; out[2 * size * size + o] = (b / n / 255 - mean) / std;
    }
  }
  return out;
}

/** Runs the network on a photo (small RGBA copy). Corners come back in the order top-left, top-right, bottom-right, bottom-left. */
export function runModel(net: CornerNet, img: Img): ModelFind {
  const o = net.run(prepareInput(img, net.input, net.mean, net.std));
  const quad = [0, 1, 2, 3].map((k) => ({ x: Math.min(1, Math.max(0, o.corners[k * 2])), y: Math.min(1, Math.max(0, o.corners[k * 2 + 1])) })) as Quad;
  return { quad, presence: 1 / (1 + Math.exp(-o.presenceLogit)) };
}

