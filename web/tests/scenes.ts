import type { Pt } from '../src/core/geometry';
import { createImg, type Img } from '../src/core/image';

/** Deterministic PRNG so scenes are reproducible. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const inside = (q: Pt[], x: number, y: number): boolean => {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4];
    const cross = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
    const s = cross >= 0 ? 1 : -1;
    if (sign === 0) sign = s; else if (s !== sign) return false;
  }
  return true;
};

export interface SceneOptions {
  page: Pt[]; bg: [number, number, number]; paper: [number, number, number];
  bgTexture?: number; shadow?: number; clutter?: boolean; seed?: number; w?: number; h?: number; text?: boolean;
}

/** Photo-like synthetic scene: blotchy textured background, page with text rows, diagonal shadow, optional clutter. */
export function scene(o: SceneOptions): Img {
  const w = o.w ?? 320, h = o.h ?? 420, rnd = rng(o.seed ?? 1), bgTexture = o.bgTexture ?? 18, shadow = o.shadow ?? 25;
  const gw = 12, gh = 16;
  const grid = Array.from({ length: (gw + 1) * (gh + 1) }, () => rnd() - 0.5);
  const img = createImg(w, h);
  const card = [{ x: 20, y: 60 }, { x: 150, y: 40 }, { x: 160, y: 130 }, { x: 30, y: 150 }];
  const minX = Math.min(...o.page.map((p) => p.x)), minY = Math.min(...o.page.map((p) => p.y)), maxX = Math.max(...o.page.map((p) => p.x));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = (x * gw) / w, gy = (y * gh) / h, x0 = gx | 0, y0 = gy | 0, fx = gx - x0, fy = gy - y0;
    const v = grid[y0 * (gw + 1) + x0] * (1 - fx) * (1 - fy) + grid[y0 * (gw + 1) + x0 + 1] * fx * (1 - fy) +
      grid[(y0 + 1) * (gw + 1) + x0] * (1 - fx) * fy + grid[(y0 + 1) * (gw + 1) + x0 + 1] * fx * fy;
    const noise = Math.floor(rnd() * 9) - 4;
    const t = Math.round(v * 2 * bgTexture);
    let [r, g, b] = [o.bg[0] + t + noise, o.bg[1] + t + noise, o.bg[2] + t + noise];
    if (o.clutter && y >= 10 && y < 50) { r -= 40; g -= 40; b -= 30; }
    if (o.clutter && inside(card, x + 0.5, y + 0.5)) { r = 30; g = 60; b = 160; }
    if (inside(o.page, x + 0.5, y + 0.5)) {
      const lit = Math.round(-shadow * ((x + y) / (w + h)));
      [r, g, b] = [o.paper[0] + lit + noise, o.paper[1] + lit + noise, o.paper[2] + lit + noise];
      const rel = Math.floor(y - minY) % 16;
      if (o.text !== false && rel >= 6 && rel <= 9 && x > minX + 30 && x < maxX - 30 && y > minY + 30) { r = 60; g = 60; b = 70; }
    }
    const i = (y * w + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  return img;
}
