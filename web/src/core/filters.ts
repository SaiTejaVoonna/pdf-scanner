import { boxBlur, luma, type Img } from './image';

export type FilterName = 'original' | 'enhanced' | 'grayscale' | 'bw';
export const FILTERS: { id: FilterName; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'enhanced', label: 'Enhanced' },
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'bw', label: 'Black & white' },
];

export function applyFilter(img: Img, filter: FilterName): void {
  if (filter === 'enhanced') enhance(img);
  else if (filter === 'grayscale') grayscale(img);
  else if (filter === 'bw') blackAndWhite(img);
}

export function grayscale(img: Img): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) { const l = luma(d[i], d[i + 1], d[i + 2]); d[i] = d[i + 1] = d[i + 2] = l; d[i + 3] = 255; }
}

/**
 * Adaptive (Bradley-Roth) threshold: a pixel turns black when it is clearly darker than the average of its
 * neighbourhood, so shadows and uneven light do not defeat it and blank paper stays white.
 */
export function blackAndWhite(img: Img, sensitivity = 0.12): void {
  const { width: w, height: h, data: d } = img;
  const gray = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = luma(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) { row += gray[y * w + x]; integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + row; }
  }
  const radius = Math.max(8, Math.floor(Math.min(w, h) / 16));
  const factor = 1 - sensitivity;
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius), y1 = Math.min(h - 1, y + radius);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius), x1 = Math.min(w - 1, x + radius);
      const count = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum = integral[(y1 + 1) * (w + 1) + x1 + 1] - integral[y0 * (w + 1) + x1 + 1] - integral[(y1 + 1) * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const v = gray[y * w + x] * count < sum * factor ? 0 : 255;
      const o = (y * w + x) * 4;
      d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = 255;
    }
  }
}

const BLOCK = 8;

/**
 * "Scan look" that keeps colour: estimate the paper's illumination (block maxima ignore ink), divide it out so
 * shadows vanish and paper turns white, then deepen the ink slightly with a gamma curve.
 */
export function enhance(img: Img, gamma = 1.35): void {
  const { width: w, height: h, data: d } = img;
  if (w < 2 || h < 2) return;
  const bw = Math.ceil(w / BLOCK), bh = Math.ceil(h / BLOCK);
  const blockMax = new Int32Array(bw * bh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const l = luma(d[i], d[i + 1], d[i + 2]);
    const bi = ((y / BLOCK) | 0) * bw + ((x / BLOCK) | 0);
    if (l > blockMax[bi]) blockMax[bi] = l;
  }
  // Dilate by one block so wide ink can't darken the estimate, then smooth lightly (a wide blur would be
  // dragged towards the interior at the borders and under-brighten the paper there).
  const dilated = new Int32Array(bw * bh);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    let m = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < bw && ny >= 0 && ny < bh) m = Math.max(m, blockMax[ny * bw + nx]);
    }
    dilated[y * bw + x] = m;
  }
  const bg = boxBlur(dilated, bw, bh, 1, 2);
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = 255 * Math.pow(v / 255, gamma);
  for (let y = 0; y < h; y++) {
    const gy = Math.min(bh - 1, Math.max(0, (y + 0.5) / BLOCK - 0.5));
    const y0 = gy | 0, y1 = Math.min(y0 + 1, bh - 1), fy = gy - y0;
    for (let x = 0; x < w; x++) {
      const gx = Math.min(bw - 1, Math.max(0, (x + 0.5) / BLOCK - 0.5));
      const x0 = gx | 0, x1 = Math.min(x0 + 1, bw - 1), fx = gx - x0;
      const b = (bg[y0 * bw + x0] * (1 - fx) + bg[y0 * bw + x1] * fx) * (1 - fy) + (bg[y1 * bw + x0] * (1 - fx) + bg[y1 * bw + x1] * fx) * fy;
      const gain = 255 / Math.max(b, 40); // don't amplify near-black regions into noise
      const o = (y * w + x) * 4;
      d[o] = lut[Math.min(255, d[o] * gain) | 0];
      d[o + 1] = lut[Math.min(255, d[o + 1] * gain) | 0];
      d[o + 2] = lut[Math.min(255, d[o + 2] * gain) | 0];
      d[o + 3] = 255;
    }
  }
}
