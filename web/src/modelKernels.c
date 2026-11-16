// Convolution kernels for the page-corner network, compiled to WebAssembly with SIMD. No library: the caller owns the memory.
typedef float f32;
#define EXPORT(name) __attribute__((export_name(#name)))

static inline void relu6(f32* restrict p, int n) { for (int i = 0; i < n; i++) { f32 v = p[i]; p[i] = v < 0 ? 0 : v > 6 ? 6 : v; } }

// 1 x 1, stride 1: out[o] = b[o] + sum over input planes of w[o][ci] * in[ci]
EXPORT(conv1) void conv1(const f32* restrict in, const f32* restrict w, const f32* restrict b, f32* restrict out, int ic, int oc, int ps, int relu) {
  for (int o = 0; o < oc; o++) {
    f32* restrict op = out + o * ps; const f32* wo = w + o * ic; const f32 bias = b[o];
    for (int i = 0; i < ps; i++) op[i] = bias;
    int ci = 0;
    for (; ci + 4 <= ic; ci += 4) {
      const f32 w0 = wo[ci], w1 = wo[ci + 1], w2 = wo[ci + 2], w3 = wo[ci + 3];
      const f32* restrict a = in + ci * ps; const f32* restrict c = a + ps; const f32* restrict d = c + ps; const f32* restrict e = d + ps;
      for (int i = 0; i < ps; i++) op[i] += w0 * a[i] + w1 * c[i] + w2 * d[i] + w3 * e[i];
    }
    for (; ci < ic; ci++) { const f32 w0 = wo[ci]; const f32* restrict a = in + ci * ps; for (int i = 0; i < ps; i++) op[i] += w0 * a[i]; }
    if (relu) relu6(op, ps);
  }
}

// 3 x 3 on an input that already has a one-pixel border of zeros (pw = width + 2). groups: icg input planes feed each output plane.
EXPORT(conv3) void conv3(const f32* restrict pd, const f32* restrict w, const f32* restrict b, f32* restrict out, int icg, int oc, int ocg, int pw, int pp, int oh, int ow, int stride, int relu) {
  const int ps = oh * ow;
  for (int o = 0; o < oc; o++) {
    const int grp = o / ocg; f32* restrict op = out + o * ps; const f32 bias = b[o];
    for (int i = 0; i < ps; i++) op[i] = bias;
    for (int ci = 0; ci < icg; ci++) {
      const f32* restrict ip = pd + (grp * icg + ci) * pp; const f32* k = w + (o * icg + ci) * 9;
      const f32 k0 = k[0], k1 = k[1], k2 = k[2], k3 = k[3], k4 = k[4], k5 = k[5], k6 = k[6], k7 = k[7], k8 = k[8];
      for (int oy = 0; oy < oh; oy++) {
        const f32* restrict r0 = ip + oy * stride * pw; const f32* restrict r1 = r0 + pw; const f32* restrict r2 = r1 + pw; f32* restrict d = op + oy * ow;
        if (stride == 1) { for (int x = 0; x < ow; x++) d[x] += k0 * r0[x] + k1 * r0[x + 1] + k2 * r0[x + 2] + k3 * r1[x] + k4 * r1[x + 1] + k5 * r1[x + 2] + k6 * r2[x] + k7 * r2[x + 1] + k8 * r2[x + 2]; }
        else { for (int x = 0; x < ow; x++) { const int s = x * stride; d[x] += k0 * r0[s] + k1 * r0[s + 1] + k2 * r0[s + 2] + k3 * r1[s] + k4 * r1[s + 1] + k5 * r1[s + 2] + k6 * r2[s] + k7 * r2[s + 1] + k8 * r2[s + 2]; } }
      }
    }
    if (relu) relu6(op, ps);
  }
}
