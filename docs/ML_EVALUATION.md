# Optional ML detectors: measured evaluation

Question: should the app ship a learned page/spread detector, or stay with the heuristics? Nothing below is in the default
bundle. Everything here was measured on 2026-10-19 on a Linux desktop (headless Chromium / Python onnxruntime), on the same
four labelled photos as `docs/BASELINE.md`. Four photos is far too few to claim accuracy; it only shows whether a candidate
is obviously better or worse.

## DocAligner (heatmap models, ONNX)
| Fact | Value | How known |
|---|---|---|
| Code licence | Apache-2.0 | repo badge, PyPI wheel `LICENSE` |
| Weights licence | **not stated** (hosted on Google Drive, referenced from the package) | package source; unverified |
| `lcnet100_h_e_bifpn_256_fp32.onnx` | 4,767,987 bytes (gzip -9: 4,366,775) | downloaded and measured |
| `fastvit_t8_h_e_bifpn_256_fp32.onnx` | 13,167,814 bytes (gzip -9: 12,133,755) | downloaded and measured |
| Input / output | 256x256 RGB, 4 corner heatmaps (128x128) | package source, model inspected |
| Browser runtime | `onnxruntime-web` 1.30.0 (MIT): `ort-wasm-simd-threaded.wasm` 14,239,897 bytes raw, 3,659,955 gzip -9, plus ~25 KB + ~50 KB of JS | npm tarball, measured |
| Works in Chromium (wasm, 1 thread) | yes: model load 1.46 s, inference about 200 ms on this desktop; heatmap sum within 2% of Python | probe run |
| Phones / Safari / Firefox | **not measured** | - |

So the smallest option would add roughly 8 MB transferred (about 3.7 MB runtime + 4.4 MB model, gzip -9; brotli not
measured) plus first-use compile time, before any phone measurement.

Accuracy on the four photos (raw model output, same metrics as `bench/score.mjs`):

| Photo | Heuristics (current) | lcnet100 | fastvit_t8 |
|---|---|---|---|
| P1 notebook spread | outer box IoU 95%, loss 0%; gutter flagged uncertain | IoU 83%, **must-keep loss 16%** (right page only; the left page is lost) | IoU 83%, loss 17% (same) |
| P2 app preview on a phone (weak label) | IoU 98% | nothing returned | nothing returned |
| P3 phone showing a white page | IoU 98% | IoU 87% | IoU 83% |
| P4 dark screen (expect none) | nothing | nothing | nothing |

These are single-document corner models: on the open book they framed one page and cut off the other, which violates the
"no visible writing lost" criterion; they give no gutter either. On this sample they are **not better** than the heuristics
and cost about 8 MB.

## Not evaluated (no measurement, no claim)
- **Salient/segmentation models** (for example U2-Net-small family): not downloaded or run. Size and licence unmeasured.
- **OpenCV.js**: only the file size is known (official 4.13.0 `opencv.js`, 10,964,323 bytes, Apache-2.0 on npm); it gives
  contour tools the app already has and no learned understanding, so it was not run.
- **Google ML Kit Document Scanner**: Android-only and dependent on Google Play services (per its documentation); it cannot
  run in the PWA and is outside this implementation.

## Decision
Keep the heuristics as the default. No model is bundled. If a model is ever offered it should be an opt-in download with its
exact size shown, adopted only if it beats the heuristics on a held-out labelled set (zero must-keep loss) and its weights
licence is confirmed. Held-out photos are still needed; until then all accuracy figures are a regression baseline.

Reproduce: `bench/ml/docaligner_eval.py` (Python onnxruntime) and `bench/ml/ort_web_probe.mjs` (browser).
