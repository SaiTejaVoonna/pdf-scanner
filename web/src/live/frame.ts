import type { Img } from '../core/image';

/** Focus measure: variance of a 4-neighbour Laplacian of the brightness. Higher = sharper. Only compared between frames. */
export function sharpness(img: Img): number {
  const { width: w, height: h, data } = img;
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) / 1000;
  let sum = 0, sum2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    const l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
    sum += l; sum2 += l * l; n++;
  }
  const mean = sum / n;
  return n ? sum2 / n - mean * mean : 0;
}
