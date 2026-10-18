/** A raw RGBA bitmap; the core works on this so it runs in Node tests and in the browser alike. */
export interface Img { data: Uint8ClampedArray; width: number; height: number }

export const createImg = (width: number, height: number): Img => ({ data: new Uint8ClampedArray(width * height * 4), width, height });

export const luma = (r: number, g: number, b: number): number => ((r * 299 + g * 587 + b * 114) / 1000) | 0;

/** Largest power-of-two shrink that keeps the longest side at or above `target`. */
export function sampleFactor(width: number, height: number, target: number): number {
  let f = 1;
  const longest = Math.max(width, height);
  while (longest / (f * 2) >= target) f *= 2;
  return f;
}

/** Box-average downscale so the longest side is at most `maxSide` (never enlarges). */
export function downscale(src: Img, maxSide: number): Img {
  const longest = Math.max(src.width, src.height);
  if (longest <= maxSide) return src;
  const s = maxSide / longest;
  const w = Math.max(1, Math.round(src.width * s));
  const h = Math.max(1, Math.round(src.height * s));
  const out = createImg(w, h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor((y / h) * src.height), y1 = Math.max(y0 + 1, Math.floor(((y + 1) / h) * src.height));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor((x / w) * src.width), x1 = Math.max(x0 + 1, Math.floor(((x + 1) / w) * src.width));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) {
        const i = (yy * src.width + xx) * 4;
        r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2]; n++;
      }
      const o = (y * w + x) * 4;
      out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = 255;
    }
  }
  return out;
}

/** Separable sliding-window box blur on one channel; passes>1 approximates a Gaussian. */
export function boxBlur(src: Int32Array, w: number, h: number, radius: number, passes = 1): Int32Array {
  let cur = src;
  for (let p = 0; p < passes; p++) cur = blurOnce(cur, w, h, radius);
  return cur;
}

function blurOnce(src: Int32Array, w: number, h: number, r: number): Int32Array {
  const tmp = new Int32Array(w * h), out = new Int32Array(w * h);
  for (let y = 0; y < h; y++) {
    let sum = 0, count = 0;
    for (let x = 0; x <= Math.min(r, w - 1); x++) { sum += src[y * w + x]; count++; }
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = (sum / count) | 0;
      const add = x + r + 1, drop = x - r;
      if (add < w) { sum += src[y * w + add]; count++; }
      if (drop >= 0) { sum -= src[y * w + drop]; count--; }
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0, count = 0;
    for (let y = 0; y <= Math.min(r, h - 1); y++) { sum += tmp[y * w + x]; count++; }
    for (let y = 0; y < h; y++) {
      out[y * w + x] = (sum / count) | 0;
      const add = y + r + 1, drop = y - r;
      if (add < h) { sum += tmp[add * w + x]; count++; }
      if (drop >= 0) { sum -= tmp[drop * w + x]; count--; }
    }
  }
  return out;
}
