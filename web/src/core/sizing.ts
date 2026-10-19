import { safeFileName } from './pdf';

/** Scales w x h down so the longest side is at most `maxSide`; never enlarges. */
export function fitWithin(w: number, h: number, maxSide: number | null): [number, number] {
  if (maxSide === null || Math.max(w, h) <= maxSide) return [w, h];
  const s = maxSide / Math.max(w, h);
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
}

/** "<original base>-resized.<ext>", unique within `taken` ("... (2)") so same-named photos never overwrite each other. */
export function outputName(original: string | undefined, ext: string, taken: Set<string>): string {
  const base = safeFileName((original ?? '').replace(/\.[^.]*$/, ''), 'image');
  let candidate = `${base}-resized.${ext}`, n = 2;
  while (taken.has(candidate.toLowerCase())) { candidate = `${base}-resized (${n}).${ext}`; n++; }
  taken.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Highest JPEG quality in [lo, hi] whose encoded size is within `target` bytes (binary search, assumes size grows with
 * quality). Returns null when even `lo` is too big.
 */
export async function searchQuality(encode: (quality: number) => Promise<number>, target: number, lo = 0.4, hi = 0.95, steps = 6): Promise<{ quality: number; size: number } | null> {
  const top = await encode(hi);
  if (top <= target) return { quality: hi, size: top };
  const bottom = await encode(lo);
  if (bottom > target) return null;
  let best = { quality: lo, size: bottom }, a = lo, b = hi;
  for (let i = 0; i < steps; i++) {
    const mid = (a + b) / 2, size = await encode(mid);
    if (size <= target) { best = { quality: mid, size }; a = mid; } else b = mid;
  }
  return best;
}
