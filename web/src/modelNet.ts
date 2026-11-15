/**
 * The page-corner networks run in plain TypeScript: no runtime library, no 14 MB WebAssembly file. Two networks share this code and
 * the weights file says which one it holds (`arch` in its manifest):
 *  - engine v1 (web/ml/model.py): 0.2 M weights, about 1 MB. Four corner heat maps at 24 x 24 and a "there is a page" score.
 *  - engine v2 (web/ml/model2.py): 0.7 M weights, about 2.8 MB. Corner heat maps at 48 x 48, the same score, and a page mask
 *    (which cells are page) that the app uses to check the corners against (core/find.ts `combine`).
 * Both are MobileNet-style blocks with a soft-argmax read-out. Weights come from web/ml/export_weights.py (BatchNorm already
 * folded in). tests/modelNet.test.ts checks every output of both against PyTorch.
 */
export interface Manifest { input: number; hm: number; mean: number; std: number; arch?: number; tensors: { name: string; shape: number[]; offset: number }[] }
export interface NetOutput {
  /** tl, tr, br, bl as x,y in 0..1 */ corners: number[]; presenceLogit: number; var: number[];
  /** Engine v2 only: page-mask logits, `hm` x `hm`, row by row (above 0 means "this cell is page"). */ mask?: Float32Array; hm: number;
}

interface T { c: number; h: number; w: number; d: Float32Array }
type W = { w: Float32Array; b: Float32Array; shape: number[] };

export class CornerNet {
  private readonly t = new Map<string, Float32Array>();
  private readonly shape = new Map<string, number[]>();
  readonly input: number;
  private readonly hm: number;
  readonly mean: number; readonly std: number;
  /** 1 or 2: which engine the weights file holds. */
  readonly arch: number;

  constructor(buf: ArrayBuffer) {
    const len = new DataView(buf).getUint32(0, true);
    const m: Manifest = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, len)));
    const base = 4 + len;
    for (const e of m.tensors) { this.t.set(e.name, new Float32Array(buf.slice(base + e.offset * 4, base + (e.offset + e.shape.reduce((a, b) => a * b, 1)) * 4))); this.shape.set(e.name, e.shape); }
    this.input = m.input; this.hm = m.hm; this.mean = m.mean; this.std = m.std; this.arch = m.arch ?? 1;
  }

  private get(name: string): W { return { w: this.t.get(`${name}.w`)!, b: this.t.get(`${name}.b`)!, shape: this.shape.get(`${name}.w`)! }; }

  /** One inverted-residual block: expand (1x1), depthwise (3x3, maybe stride 2), project (1x1), plus the input when the shape allows. */
  private ir(x: T, p: string, stride: number): T {
    const y = conv(conv(conv(x, this.get(`${p}.expand`), 1, 1, true), this.get(`${p}.dw`), stride, 0, true), this.get(`${p}.project`), 1, 1, false);
    if (stride === 1 && x.c === y.c) for (let i = 0; i < y.d.length; i++) y.d[i] += x.d[i];
    return y;
  }
  /** `n` blocks in a row; only the first may have a stride. */
  private stage(x: T, name: string, n: number, stride: number): T {
    for (let i = 0; i < n; i++) x = this.ir(x, `${name}.${i}`, i === 0 ? stride : 1);
    return x;
  }

  /** `rgb` is 3 x input x input, channel-first, already normalised ((v/255 - mean) / std). */
  run(rgb: Float32Array): NetOutput {
    const size = this.input, hmN = this.hm;
    const stem = conv({ c: 3, h: size, w: size, d: rgb }, this.get('stem'), 2, 1, true);
    let heat: T, top: T, mask: Float32Array | undefined;
    if (this.arch === 2) {
      const f48 = this.stage(stem, 's1', 2, 2), f24 = this.stage(f48, 's2', 3, 2), f12 = this.stage(f24, 's3', 3, 2);
      top = this.stage(f12, 's4', 3, 2);
      // top-down: each coarser map is resized up and added to the next finer one
      const lateral = (f: T, name: string, coarser: T): T => {
        const l = conv(f, this.get(name), 1, 1, true), u = upsample(coarser, f.h, f.w);
        for (let i = 0; i < l.d.length; i++) l.d[i] += u.d[i];
        return l;
      };
      const p = lateral(f48, 'l48', lateral(f24, 'l24', lateral(f12, 'l12', conv(top, this.get('l6'), 1, 1, true))));
      const out = conv(conv(conv(p, this.get('fuse.0'), 1, 1, true), this.get('fuse.1'), 1, 1, true), this.get('fuse.2'), 1, 1, false); // 4 corners + mask
      heat = out; mask = out.d.slice(4 * hmN * hmN, 5 * hmN * hmN);
    } else {
      const f24 = this.stage(this.stage(stem, 's1', 2, 2), 's2', 2, 2);
      top = this.stage(this.stage(f24, 's3', 3, 2), 's4', 2, 1);
      const lat = conv(f24, this.get('lat'), 1, 1, true);
      const up = upsample(conv(top, this.get('up'), 1, 1, true), f24.h, f24.w);
      for (let i = 0; i < lat.d.length; i++) lat.d[i] += up.d[i];
      heat = conv(conv(lat, this.get('fuse.0'), 1, 1, true), this.get('fuse.1'), 1, 1, false); // 4 x hm x hm
    }
    const corners: number[] = [], vars: number[] = [];
    for (let k = 0; k < 4; k++) {
      const h = heat.d.subarray(k * hmN * hmN, (k + 1) * hmN * hmN);
      let max = -Infinity; for (let i = 0; i < h.length; i++) if (h[i] > max) max = h[i];
      const p = new Float64Array(h.length); let sum = 0;
      for (let i = 0; i < h.length; i++) { p[i] = Math.exp(h[i] - max); sum += p[i]; }
      const colSum = new Float64Array(hmN), rowSum = new Float64Array(hmN);
      for (let y = 0; y < hmN; y++) for (let xx = 0; xx < hmN; xx++) { const v = p[y * hmN + xx] / sum; rowSum[y] += v; colSum[xx] += v; }
      let px = 0, py = 0;
      for (let i = 0; i < hmN; i++) { const g = (i + 0.5) / hmN; px += colSum[i] * g; py += rowSum[i] * g; }
      let v = 0;
      for (let i = 0; i < hmN; i++) { const g = (i + 0.5) / hmN; v += colSum[i] * (g - px) ** 2 + rowSum[i] * (g - py) ** 2; }
      corners.push(px, py); vars.push(v);
    }
    const pres = this.get('pres'); let logit = pres.b[0];
    const n = top.h * top.w;
    for (let c = 0; c < top.c; c++) { let s = 0; for (let i = 0; i < n; i++) s += top.d[c * n + i]; logit += pres.w[c] * (s / n); }
    return { corners, presenceLogit: logit, var: vars, mask, hm: hmN };
  }
}

/**
 * Convolution with zero padding k/2. `groups` 0 means depthwise (one group per channel). Optional ReLU6. The two shapes these
 * networks use have their own fast paths (1 x 1, and 3 x 3); anything else takes the general one.
 */
function conv(x: T, p: W, stride: number, groups: number, relu6: boolean): T {
  const [oc, , k] = p.shape;
  const g = groups === 0 ? x.c : groups;
  const pad = k >> 1;
  const oh = Math.floor((x.h + 2 * pad - k) / stride) + 1, ow = Math.floor((x.w + 2 * pad - k) / stride) + 1;
  const out = new Float32Array(oc * oh * ow);
  if (k === 1 && stride === 1 && g === 1) conv1(x, p, out);
  else if (k === 3) conv3(x, p, stride, g, out, oh, ow);
  else convAny(x, p, stride, g, out, oh, ow);
  if (relu6) for (let i = 0; i < out.length; i++) { const v = out[i]; out[i] = v < 0 ? 0 : v > 6 ? 6 : v; }
  return { c: oc, h: oh, w: ow, d: out };
}

/** 1 x 1, stride 1: each output plane is a weighted sum of the input planes, taken eight (then four) input planes at a time. */
function conv1(x: T, p: W, out: Float32Array): void {
  const oc = p.shape[0], ic = x.c, ps = x.h * x.w, id = x.d, w = p.w;
  for (let o = 0; o < oc; o++) {
    const ob = o * ps, wb = o * ic;
    out.fill(p.b[o], ob, ob + ps);
    let ci = 0;
    for (; ci + 8 <= ic; ci += 8) {
      const w0 = w[wb + ci], w1 = w[wb + ci + 1], w2 = w[wb + ci + 2], w3 = w[wb + ci + 3], w4 = w[wb + ci + 4], w5 = w[wb + ci + 5], w6 = w[wb + ci + 6], w7 = w[wb + ci + 7];
      const a = ci * ps, b = a + ps, c = b + ps, d = c + ps, e = d + ps, f = e + ps, g = f + ps, h = g + ps;
      for (let i = 0; i < ps; i++) out[ob + i] += w0 * id[a + i] + w1 * id[b + i] + w2 * id[c + i] + w3 * id[d + i] + w4 * id[e + i] + w5 * id[f + i] + w6 * id[g + i] + w7 * id[h + i];
    }
    for (; ci + 4 <= ic; ci += 4) {
      const w0 = w[wb + ci], w1 = w[wb + ci + 1], w2 = w[wb + ci + 2], w3 = w[wb + ci + 3];
      const a = ci * ps, b = a + ps, c = b + ps, d = c + ps;
      for (let i = 0; i < ps; i++) out[ob + i] += w0 * id[a + i] + w1 * id[b + i] + w2 * id[c + i] + w3 * id[d + i];
    }
    for (; ci < ic; ci++) { const w0 = w[wb + ci], a = ci * ps; for (let i = 0; i < ps; i++) out[ob + i] += w0 * id[a + i]; }
  }
}

/** 3 x 3, any stride and grouping: the input is copied once with a border of zeros, so all nine taps are read in one pass with no edge cases. */
function conv3(x: T, p: W, stride: number, g: number, out: Float32Array, oh: number, ow: number): void {
  const oc = p.shape[0], icg = p.shape[1], ocg = oc / g, ih = x.h, iw = x.w, pw = iw + 2, pp = (ih + 2) * pw, ps = oh * ow, w = p.w;
  const pd = new Float32Array(x.c * pp);
  for (let c = 0; c < x.c; c++) for (let y = 0; y < ih; y++) pd.set(x.d.subarray((c * ih + y) * iw, (c * ih + y + 1) * iw), c * pp + (y + 1) * pw + 1);
  for (let o = 0; o < oc; o++) {
    const grp = Math.floor(o / ocg), ob = o * ps;
    out.fill(p.b[o], ob, ob + ps);
    let ci = 0;
    // two input planes at a time: eighteen taps per write instead of nine
    for (; ci + 2 <= icg; ci += 2) {
      const ib = (grp * icg + ci) * pp, jb = ib + pp, wb = (o * icg + ci) * 9;
      const w0 = w[wb], w1 = w[wb + 1], w2 = w[wb + 2], w3 = w[wb + 3], w4 = w[wb + 4], w5 = w[wb + 5], w6 = w[wb + 6], w7 = w[wb + 7], w8 = w[wb + 8];
      const v0 = w[wb + 9], v1 = w[wb + 10], v2 = w[wb + 11], v3 = w[wb + 12], v4 = w[wb + 13], v5 = w[wb + 14], v6 = w[wb + 15], v7 = w[wb + 16], v8 = w[wb + 17];
      for (let oy = 0; oy < oh; oy++) {
        let r0 = ib + oy * stride * pw, r1 = r0 + pw, r2 = r1 + pw, q0 = jb + oy * stride * pw, q1 = q0 + pw, q2 = q1 + pw, di = ob + oy * ow;
        for (let ox = 0; ox < ow; ox++, r0 += stride, r1 += stride, r2 += stride, q0 += stride, q1 += stride, q2 += stride, di++) {
          out[di] += w0 * pd[r0] + w1 * pd[r0 + 1] + w2 * pd[r0 + 2] + w3 * pd[r1] + w4 * pd[r1 + 1] + w5 * pd[r1 + 2] + w6 * pd[r2] + w7 * pd[r2 + 1] + w8 * pd[r2 + 2]
            + v0 * pd[q0] + v1 * pd[q0 + 1] + v2 * pd[q0 + 2] + v3 * pd[q1] + v4 * pd[q1 + 1] + v5 * pd[q1 + 2] + v6 * pd[q2] + v7 * pd[q2 + 1] + v8 * pd[q2 + 2];
        }
      }
    }
    for (; ci < icg; ci++) {
      const ib = (grp * icg + ci) * pp, wb = (o * icg + ci) * 9;
      const w0 = w[wb], w1 = w[wb + 1], w2 = w[wb + 2], w3 = w[wb + 3], w4 = w[wb + 4], w5 = w[wb + 5], w6 = w[wb + 6], w7 = w[wb + 7], w8 = w[wb + 8];
      for (let oy = 0; oy < oh; oy++) {
        let r0 = ib + oy * stride * pw, r1 = r0 + pw, r2 = r1 + pw, di = ob + oy * ow;
        for (let ox = 0; ox < ow; ox++, r0 += stride, r1 += stride, r2 += stride, di++) {
          out[di] += w0 * pd[r0] + w1 * pd[r0 + 1] + w2 * pd[r0 + 2] + w3 * pd[r1] + w4 * pd[r1 + 1] + w5 * pd[r1 + 2] + w6 * pd[r2] + w7 * pd[r2 + 1] + w8 * pd[r2 + 2];
        }
      }
    }
  }
}

/** Any kernel size: for each weight the whole shifted input plane is added into the output plane. */
function convAny(x: T, p: W, stride: number, g: number, out: Float32Array, oh: number, ow: number): void {
  const [oc, icg, k] = p.shape;
  const pad = k >> 1;
  const ocg = oc / g, ih = x.h, iw = x.w, id = x.d, ps = oh * ow;
  for (let o = 0; o < oc; o++) {
    const grp = Math.floor(o / ocg), obase = o * ps;
    out.fill(p.b[o], obase, obase + ps);
    for (let ci = 0; ci < icg; ci++) {
      const ibase = (grp * icg + ci) * ih * iw, wbase = (o * icg + ci) * k * k;
      for (let ky = 0; ky < k; ky++) {
        // output rows whose source row (oy * stride - pad + ky) lies inside the image
        const oy0 = Math.max(0, Math.ceil((pad - ky) / stride)), oy1 = Math.min(oh - 1, Math.floor((ih - 1 + pad - ky) / stride));
        for (let kx = 0; kx < k; kx++) {
          const w = p.w[wbase + ky * k + kx];
          if (w === 0) continue;
          const ox0 = Math.max(0, Math.ceil((pad - kx) / stride)), ox1 = Math.min(ow - 1, Math.floor((iw - 1 + pad - kx) / stride));
          for (let oy = oy0; oy <= oy1; oy++) {
            let si = ibase + (oy * stride - pad + ky) * iw + (ox0 * stride - pad + kx), di = obase + oy * ow + ox0;
            for (let ox = ox0; ox <= ox1; ox++, si += stride, di++) out[di] += w * id[si];
          }
        }
      }
    }
  }
}

/** Bilinear resize with half-pixel centres (PyTorch align_corners=False). */
function upsample(x: T, h: number, w: number): T {
  const out = new Float32Array(x.c * h * w);
  const sy = x.h / h, sx = x.w / w;
  for (let c = 0; c < x.c; c++) for (let y = 0; y < h; y++) {
    const fy = Math.max(0, (y + 0.5) * sy - 0.5), y0 = Math.min(x.h - 1, Math.floor(fy)), y1 = Math.min(x.h - 1, y0 + 1), wy = fy - y0;
    for (let xx = 0; xx < w; xx++) {
      const fx = Math.max(0, (xx + 0.5) * sx - 0.5), x0 = Math.min(x.w - 1, Math.floor(fx)), x1 = Math.min(x.w - 1, x0 + 1), wx = fx - x0;
      const b = c * x.h * x.w;
      out[(c * h + y) * w + xx] = (x.d[b + y0 * x.w + x0] * (1 - wx) + x.d[b + y0 * x.w + x1] * wx) * (1 - wy) + (x.d[b + y1 * x.w + x0] * (1 - wx) + x.d[b + y1 * x.w + x1] * wx) * wy;
    }
  }
  return { c: x.c, h, w, d: out };
}
