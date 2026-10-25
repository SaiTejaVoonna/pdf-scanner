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

export type Unit = 'px' | 'mm';
/** A length in pixels: millimetres are converted at `dpi` dots per inch (25.4 mm = 1 inch). */
export const toPixels = (value: number, unit: Unit, dpi: number): number => Math.max(1, Math.round(unit === 'mm' ? (value / 25.4) * dpi : value));

/**
 * Where to draw a `sw` x `sh` picture on a `dw` x `dh` canvas. 'crop' fills the whole canvas and trims the overflow (centred);
 * 'fit' shows the whole picture centred on the background colour.
 */
export function fitBox(sw: number, sh: number, dw: number, dh: number, mode: 'crop' | 'fit'): { sx: number; sy: number; sWidth: number; sHeight: number; dx: number; dy: number; dWidth: number; dHeight: number } {
  if (mode === 'crop') {
    const k = Math.max(dw / sw, dh / sh), vw = dw / k, vh = dh / k;
    return { sx: (sw - vw) / 2, sy: (sh - vh) / 2, sWidth: vw, sHeight: vh, dx: 0, dy: 0, dWidth: dw, dHeight: dh };
  }
  const k = Math.min(dw / sw, dh / sh), w = sw * k, h = sh * k;
  return { sx: 0, sy: 0, sWidth: sw, sHeight: sh, dx: (dw - w) / 2, dy: (dh - h) / 2, dWidth: w, dHeight: h };
}

/**
 * Makes a JPEG at least `minBytes` big by adding harmless comment segments right after the start marker (viewers ignore them).
 * Some upload forms refuse files below a minimum size. Returns the input unchanged when it is already big enough or not a JPEG.
 */
export function padJpeg(jpeg: Uint8Array, minBytes: number): Uint8Array {
  if (jpeg.length >= minBytes || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpeg;
  const need = minBytes - jpeg.length, out = new Uint8Array(minBytes + 8); // a few spare bytes: the last segment may overshoot
  out.set(jpeg.subarray(0, 2), 0);
  let pos = 2, left = need;
  while (left > 0) {
    const seg = Math.min(65535, left), body = seg - 4; // marker (2) + length (2) + body
    if (body < 0) { // too little room for a segment: grow by the smallest legal one
      out.set([0xff, 0xfe, 0x00, 0x02], pos); pos += 4; left -= 4; continue;
    }
    out.set([0xff, 0xfe, ((body + 2) >> 8) & 0xff, (body + 2) & 0xff], pos); pos += 4 + body; left -= seg;
  }
  out.set(jpeg.subarray(2), pos);
  return out.slice(0, pos + (jpeg.length - 2));
}
