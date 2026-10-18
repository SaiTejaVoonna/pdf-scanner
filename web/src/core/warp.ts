import { dist, type Pt, type Quad } from './geometry';
import { createImg, type Img } from './image';

/** Output size preserving the quad's resolution, never exceeding `maxSide` on either edge. */
export function outputSize(quadPx: Quad, maxSide: number): [number, number] {
  const w = Math.max(dist(quadPx[0], quadPx[1]), dist(quadPx[3], quadPx[2]));
  const h = Math.max(dist(quadPx[0], quadPx[3]), dist(quadPx[1], quadPx[2]));
  const scale = Math.min(1, maxSide / Math.max(w, h, 1));
  return [Math.max(1, Math.round(w * scale)), Math.max(1, Math.round(h * scale))];
}

/** Homography (3x3 row-major, h22 = 1) mapping the destination rectangle onto the source quad (pixels). */
export function homography(dstW: number, dstH: number, q: Quad): number[] {
  const us = [0, dstW, dstW, 0], vs = [0, 0, dstH, dstH];
  const a: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const u = us[i], v = vs[i], x = q[i].x, y = q[i].y;
    a.push([u, v, 1, 0, 0, 0, -u * x, -v * x, x]);
    a.push([0, 0, 0, u, v, 1, -u * y, -v * y, y]);
  }
  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const p = a[col][col];
    if (Math.abs(p) < 1e-12) throw new Error('Degenerate quadrilateral');
    for (let c = col; c <= n; c++) a[col][c] /= p;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) a[r][c] -= f * a[col][c];
    }
  }
  return [...a.map((row) => row[n]), 1];
}

/** Warps the region of `src` bounded by `quadPx` into a new `outW` x `outH` image (bilinear sampling). */
export function warp(src: Img, quadPx: Quad, outW: number, outH: number): Img {
  const hm = homography(outW, outH, quadPx);
  const out = createImg(outW, outH);
  const { width: sw, height: sh, data: sd } = src;
  for (let oy = 0; oy < outH; oy++) {
    const v = oy + 0.5;
    for (let ox = 0; ox < outW; ox++) {
      const u = ox + 0.5;
      const d = hm[6] * u + hm[7] * v + 1;
      const sx = Math.min(sw - 1, Math.max(0, (hm[0] * u + hm[1] * v + hm[2]) / d - 0.5));
      const sy = Math.min(sh - 1, Math.max(0, (hm[3] * u + hm[4] * v + hm[5]) / d - 0.5));
      const x0 = sx | 0, y0 = sy | 0, x1 = Math.min(x0 + 1, sw - 1), y1 = Math.min(y0 + 1, sh - 1);
      const fx = sx - x0, fy = sy - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4, i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4;
      const o = (oy * outW + ox) * 4;
      for (let c = 0; c < 3; c++) {
        const top = sd[i00 + c] * (1 - fx) + sd[i10 + c] * fx;
        const bottom = sd[i01 + c] * (1 - fx) + sd[i11 + c] * fx;
        out.data[o + c] = top * (1 - fy) + bottom * fy;
      }
      out.data[o + 3] = 255;
    }
  }
  return out;
}

export const scaleQuad = (q: Quad, sx: number, sy: number): Quad => q.map((p): Pt => ({ x: p.x * sx, y: p.y * sy })) as Quad;

/** Rotates by a multiple of 90 degrees clockwise. */
export function rotate90(src: Img, degrees: number): Img {
  const turns = (((degrees / 90) % 4) + 4) % 4;
  if (turns === 0) return src;
  const { width: w, height: h, data: sd } = src;
  const out = turns === 2 ? createImg(w, h) : createImg(h, w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let nx: number, ny: number;
    if (turns === 1) { nx = h - 1 - y; ny = x; }
    else if (turns === 2) { nx = w - 1 - x; ny = h - 1 - y; }
    else { nx = y; ny = w - 1 - x; }
    const si = (y * w + x) * 4, di = (ny * out.width + nx) * 4;
    out.data[di] = sd[si]; out.data[di + 1] = sd[si + 1]; out.data[di + 2] = sd[si + 2]; out.data[di + 3] = 255;
  }
  return out;
}
