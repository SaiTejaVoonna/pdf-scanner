import { boxBlur } from '../image';
import { isConvex, type Quad } from '../geometry';

const MIN_REGION_FRACTION = 0.08, MIN_FILL = 0.85, MIN_QUAD_FRACTION = 0.12, MAX_QUAD_FRACTION = 0.985;

/**
 * Candidate generator #2: blur, Otsu-threshold into foreground/background (both "bright paper on dark desk"
 * and the reverse), take large connected regions, fill holes (printed text) and read corners from the x±y
 * extremes. Works when the background is smooth; the caller scores these like any other candidate.
 */
export function regionCandidates(gray: Int32Array, w: number, h: number): Quad[] {
  if (w < 16 || h < 16 || gray.length < w * h) return [];
  const blurred = boxBlur(gray, w, h, 2);
  const threshold = otsu(blurred);
  const out: Quad[] = [];
  for (const bright of [true, false]) {
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = (bright ? blurred[i] > threshold : blurred[i] <= threshold) ? 1 : 0;
    out.push(...candidates(mask, w, h));
  }
  return out;
}

interface Region {
  area: number; members: number[];
  minSum: number; minSumX: number; minSumY: number; maxSum: number; maxSumX: number; maxSumY: number;
  minDiff: number; minDiffX: number; minDiffY: number; maxDiff: number; maxDiffX: number; maxDiffY: number;
  left: boolean; right: boolean; top: boolean; bottom: boolean;
}

function candidates(mask: Uint8Array, w: number, h: number): Quad[] {
  const total = w * h;
  const visited = new Uint8Array(total), stack = new Int32Array(total);
  const regions: Region[] = [];
  for (let s = 0; s < total; s++) {
    if (!mask[s] || visited[s]) continue;
    const r = flood(s, mask, visited, stack, w, h);
    if (r.area >= total * MIN_REGION_FRACTION) regions.push(r);
  }
  regions.sort((a, b) => b.area - a.area);
  const out: Quad[] = [];
  for (const r of regions.slice(0, 3)) {
    if (r.left && r.right && r.top && r.bottom) continue; // it's the background, not the page
    const filled = r.area + holeArea(r, w, h);
    const px: Quad = [
      { x: r.minSumX, y: r.minSumY }, { x: r.maxDiffX + 1, y: r.maxDiffY },
      { x: r.maxSumX + 1, y: r.maxSumY + 1 }, { x: r.minDiffX, y: r.minDiffY + 1 },
    ];
    let sum = 0;
    for (let i = 0; i < 4; i++) { const a = px[i], b = px[(i + 1) % 4]; sum += a.x * b.y - b.x * a.y; }
    const quadArea = Math.abs(sum) / 2;
    if (quadArea <= 0) continue;
    const fill = filled / quadArea, fraction = quadArea / total;
    if (fill < MIN_FILL || fraction < MIN_QUAD_FRACTION || fraction > MAX_QUAD_FRACTION) continue;
    const q = px.map((p) => ({ x: p.x / w, y: p.y / h })) as Quad;
    if (isConvex(q)) out.push(q);
  }
  return out;
}

function flood(start: number, mask: Uint8Array, visited: Uint8Array, stack: Int32Array, w: number, h: number): Region {
  const r: Region = {
    area: 0, members: [], minSum: Infinity, minSumX: 0, minSumY: 0, maxSum: -Infinity, maxSumX: 0, maxSumY: 0,
    minDiff: Infinity, minDiffX: 0, minDiffY: 0, maxDiff: -Infinity, maxDiffX: 0, maxDiffY: 0,
    left: false, right: false, top: false, bottom: false,
  };
  let sp = 0;
  stack[sp++] = start; visited[start] = 1;
  while (sp > 0) {
    const i = stack[--sp], x = i % w, y = (i / w) | 0;
    r.area++; r.members.push(i);
    const s = x + y, d = x - y;
    if (s < r.minSum) { r.minSum = s; r.minSumX = x; r.minSumY = y; }
    if (s > r.maxSum) { r.maxSum = s; r.maxSumX = x; r.maxSumY = y; }
    if (d < r.minDiff) { r.minDiff = d; r.minDiffX = x; r.minDiffY = y; }
    if (d > r.maxDiff) { r.maxDiff = d; r.maxDiffX = x; r.maxDiffY = y; }
    if (x === 0) r.left = true; if (x === w - 1) r.right = true;
    if (y === 0) r.top = true; if (y === h - 1) r.bottom = true;
    if (x > 0 && mask[i - 1] && !visited[i - 1]) { visited[i - 1] = 1; stack[sp++] = i - 1; }
    if (x < w - 1 && mask[i + 1] && !visited[i + 1]) { visited[i + 1] = 1; stack[sp++] = i + 1; }
    if (y > 0 && mask[i - w] && !visited[i - w]) { visited[i - w] = 1; stack[sp++] = i - w; }
    if (y < h - 1 && mask[i + w] && !visited[i + w]) { visited[i + w] = 1; stack[sp++] = i + w; }
  }
  return r;
}

/** Pixels enclosed by the region: not in it and not reachable from the image border. */
function holeArea(region: Region, w: number, h: number): number {
  const inRegion = new Uint8Array(w * h), seen = new Uint8Array(w * h), stack = new Int32Array(w * h);
  for (const i of region.members) inRegion[i] = 1;
  let sp = 0, outside = 0;
  const push = (i: number) => { if (!inRegion[i] && !seen[i]) { seen[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp > 0) {
    const i = stack[--sp]; outside++;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1); if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w); if (y < h - 1) push(i + w);
  }
  return w * h - region.area - outside;
}

function otsu(gray: Int32Array): number {
  const hist = new Array(256).fill(0);
  for (const v of gray) hist[Math.min(255, Math.max(0, v))]++;
  const total = gray.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];
  let sumB = 0, wB = 0, best = 0, threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB, mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; threshold = t; }
  }
  return threshold;
}
