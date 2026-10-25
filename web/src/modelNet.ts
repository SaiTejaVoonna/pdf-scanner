/**
 * The page-corner network (web/ml/model.py) run in plain TypeScript: no runtime library, no 14 MB WebAssembly file. The model is
 * small (0.2 M weights, about 1 MB): MobileNet-style blocks, four corner heat maps read out with a soft-argmax, and a "there is
 * a page" score. Weights come from web/ml/export_weights.py (BatchNorm already folded in). tests/modelNet.test.ts checks every
 * output against PyTorch.
 */
export interface Manifest { input: number; hm: number; mean: number; std: number; tensors: { name: string; shape: number[]; offset: number }[] }
export interface NetOutput { /** tl, tr, br, bl as x,y in 0..1 */ corners: number[]; presenceLogit: number; var: number[] }

interface T { c: number; h: number; w: number; d: Float32Array }
type W = { w: Float32Array; b: Float32Array; shape: number[] };

export class CornerNet {
  private readonly t = new Map<string, Float32Array>();
  private readonly shape = new Map<string, number[]>();
  readonly input: number;
  private readonly hm: number;
  readonly mean: number; readonly std: number;

  constructor(buf: ArrayBuffer) {
    const len = new DataView(buf).getUint32(0, true);
    const m: Manifest = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, len)));
    const base = 4 + len;
    for (const e of m.tensors) { this.t.set(e.name, new Float32Array(buf.slice(base + e.offset * 4, base + (e.offset + e.shape.reduce((a, b) => a * b, 1)) * 4))); this.shape.set(e.name, e.shape); }
    this.input = m.input; this.hm = m.hm; this.mean = m.mean; this.std = m.std;
  }

  private get(name: string): W { return { w: this.t.get(`${name}.w`)!, b: this.t.get(`${name}.b`)!, shape: this.shape.get(`${name}.w`)! }; }

  /** `rgb` is 3 x input x input, channel-first, already normalised ((v/255 - mean) / std). */
  run(rgb: Float32Array): NetOutput {
    const hmN = this.hm, size = this.input;
    let x: T = { c: 3, h: size, w: size, d: rgb };
    x = conv(x, this.get('stem'), 2, 1, true);
    const ir = (x: T, p: string, stride: number): T => {
      const y = conv(conv(conv(x, this.get(`${p}.expand`), 1, 1, true), this.get(`${p}.dw`), stride, 0, true), this.get(`${p}.project`), 1, 1, false);
      if (stride === 1 && x.c === y.c) for (let i = 0; i < y.d.length; i++) y.d[i] += x.d[i];
      return y;
    };
    x = ir(x, 's1.0', 2); x = ir(x, 's1.1', 1);
    x = ir(x, 's2.0', 2); const f24 = ir(x, 's2.1', 1);
    x = ir(f24, 's3.0', 2); x = ir(x, 's3.1', 1); x = ir(x, 's3.2', 1);
    x = ir(x, 's4.0', 1); const f12 = ir(x, 's4.1', 1);
    const lat = conv(f24, this.get('lat'), 1, 1, true);
    const up = upsample(conv(f12, this.get('up'), 1, 1, true), f24.h, f24.w);
    for (let i = 0; i < lat.d.length; i++) lat.d[i] += up.d[i];
    const heat = conv(conv(lat, this.get('fuse.0'), 1, 1, true), this.get('fuse.1'), 1, 1, false); // 4 x hm x hm
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
    const n = f12.h * f12.w;
    for (let c = 0; c < f12.c; c++) { let s = 0; for (let i = 0; i < n; i++) s += f12.d[c * n + i]; logit += pres.w[c] * (s / n); }
    return { corners, presenceLogit: logit, var: vars };
  }
}

/**
 * Convolution with zero padding k/2. `groups` 0 means depthwise (one group per channel). Optional ReLU6. Works plane by plane:
 * for each weight the whole shifted input plane is added into the output plane, which keeps the inner loops tight and
 * branch-free (much faster in JavaScript than gathering one output value at a time).
 */
function conv(x: T, p: W, stride: number, groups: number, relu6: boolean): T {
  const [oc, icg, k] = p.shape;
  const g = groups === 0 ? x.c : groups;
  const pad = k >> 1;
  const oh = Math.floor((x.h + 2 * pad - k) / stride) + 1, ow = Math.floor((x.w + 2 * pad - k) / stride) + 1;
  const out = new Float32Array(oc * oh * ow);
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
    if (relu6) for (let i = obase; i < obase + ps; i++) { const v = out[i]; out[i] = v < 0 ? 0 : v > 6 ? 6 : v; }
  }
  return { c: oc, h: oh, w: ow, d: out };
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
