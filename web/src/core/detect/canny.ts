import { boxBlur } from '../image';

const TAN_22_5 = 0.4142, TAN_67_5 = 2.4142, MIN_HIGH_THRESHOLD = 30;

/**
 * Canny edge detector: blur, Sobel gradient (strongest of the colour channels, so a page that differs from
 * the desk only in hue is still seen), non-maximum suppression, then hysteresis thresholding with thresholds
 * derived from the image itself.
 */
export function cannyEdges(channels: Int32Array[], w: number, h: number): Uint8Array {
  const n = w * h;
  const blurred = channels.map((c) => boxBlur(c, w, h, 1, 2));
  const mag = new Float32Array(n), gxs = new Int32Array(n), gys = new Int32Array(n);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    let best = 0, bx = 0, by = 0;
    for (const c of blurred) {
      const gx = -c[i - w - 1] + c[i - w + 1] - 2 * c[i - 1] + 2 * c[i + 1] - c[i + w - 1] + c[i + w + 1];
      const gy = -c[i - w - 1] - 2 * c[i - w] - c[i - w + 1] + c[i + w - 1] + 2 * c[i + w] + c[i + w + 1];
      const m = gx * gx + gy * gy;
      if (m > best) { best = m; bx = gx; by = gy; }
    }
    mag[i] = Math.sqrt(best); gxs[i] = bx; gys[i] = by;
  }
  const nms = new Float32Array(n);
  const survivors: number[] = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, m = mag[i];
    if (m === 0) continue;
    const ax = Math.abs(gxs[i]), ay = Math.abs(gys[i]);
    let a: number, b: number;
    if (ay <= ax * TAN_22_5) { a = i - 1; b = i + 1; }
    else if (ay >= ax * TAN_67_5) { a = i - w; b = i + w; }
    else if ((gxs[i] > 0) === (gys[i] > 0)) { a = i - w - 1; b = i + w + 1; }
    else { a = i - w + 1; b = i + w - 1; }
    if (m >= mag[a] && m >= mag[b]) { nms[i] = m; survivors.push(m); }
  }
  const edges = new Uint8Array(n);
  if (survivors.length === 0) return edges;
  survivors.sort((p, q) => p - q);
  const high = Math.max(MIN_HIGH_THRESHOLD, survivors[Math.min(survivors.length - 1, Math.floor(survivors.length * 0.6))]);
  const low = high * 0.5;
  const stack = new Int32Array(n);
  let sp = 0;
  for (let i = 0; i < n; i++) if (nms[i] >= high) { edges[i] = 1; stack[sp++] = i; }
  while (sp > 0) {
    const i = stack[--sp], x = i % w, y = (i / w) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue;
      const j = ny * w + nx;
      if (!edges[j] && nms[j] >= low) { edges[j] = 1; stack[sp++] = j; }
    }
  }
  return edges;
}
