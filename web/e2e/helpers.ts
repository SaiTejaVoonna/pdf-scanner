import { deflateSync } from 'node:zlib';

function crc32(buf: Buffer): number {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
const chunk = (type: string, data: Buffer) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** A PNG of a light "page" with dark text-like rows on a darker textured desk. */
export function pagePng(w = 600, h = 800): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const onPage = x > 90 && x < 510 && y > 110 && y < 700;
      const text = onPage && y > 160 && (y - 160) % 28 < 8 && x > 130 && x < 470;
      const noise = ((x * 7 + y * 13) % 11) - 5;
      const v = text ? 50 : onPage ? 232 + noise : 70 + noise;
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = v; raw[o + 1] = v; raw[o + 2] = text ? 60 : v - 4;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

/** A photo of an open book: two bright pages with writing, a soft dark fold, on a darker desk. `fold: 0` gives no fold at all. */
export function spreadPng(w = 800, h = 600, o: { fold?: number; seed?: number } = {}): Buffer {
  const fold = o.fold ?? 0.4, seed = o.seed ?? 1;
  const raw = Buffer.alloc((w * 3 + 1) * h);
  const x0 = w * 0.1, x1 = w * 0.9, y0 = h * 0.1, y1 = h * 0.9, gx = w / 2;
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const onPage = x > x0 && x < x1 && y > y0 && y < y1;
      let v = onPage ? 228 : 80 + ((x * 5 + y * 3 + seed) % 9);
      if (onPage && fold > 0) { const d = x - gx; v -= 228 * fold * Math.exp(-(d * d) / 450); }
      if (onPage && y > y0 + 30 && y % 24 < 4 && Math.abs(x - gx) > 40 && x > x0 + 30 && x < x1 - 30 && ((x * 7 + y * 3) % 11) < 6) v = 55;
      v += ((x * 13 + y * 7 + seed) % 7) - 3;
      const o = y * (w * 3 + 1) + 1 + x * 3;
      raw[o] = v; raw[o + 1] = v; raw[o + 2] = v - 3;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
