# Testing

```bash
./gradlew testDebugUnitTest lintDebug
```

All tests run on the JVM (no emulator). Robolectric provides Room, native bitmaps and Compose.

| Area | What is checked |
| --- | --- |
| PDF writer / exporter | Header, xref offsets, `startxref`, `%%EOF`, page count, media boxes, orientation, embedded JPEG integrity, UTF-16 titles, quality presets shrink files, failure modes |
| Detection | Canny/Hough pipeline on hard synthetic scenes: texture, shadow, perspective, low contrast, colour-only difference, clutter, cut-off pages, rotated pages, full-frame and no-document cases |
| Imaging | Perspective warp, adaptive black & white, Enhanced (shadow removal, ink colour), box blur, image sizing, resizer |
| Data | Draft lifecycle, add / reorder / remove / bulk edit, settings persistence, file cleanup |
| ViewModels | Editor state and saved-state restoration, selection and bulk actions, share and save flows, import with settings |
| Compose UI | Home (empty state, search, rename, delete confirmation, drafts), selection mode, export sheet, settings sheet |

**Not covered by automated tests:** the real camera, system pickers, `PdfRenderer` on real PDFs, and
on-device rendering and performance. Smoke-test those on a phone before relying on a build.

Generated PDFs were also validated with `pdfinfo` (Poppler) and `pypdf` in strict mode.

## Web app (`web/`)
```bash
cd web && npm ci && npm run typecheck && npm test && npm run build && npm run e2e
```
- **Unit tests (Vitest, Node):** geometry, filters (grayscale, adaptive black & white, Enhanced), perspective warp,
  rotation, PDF building/combining/extracting (re-read with pdf-lib), file names, and the page detector on the same
  hard synthetic scenes as the Android tests (texture, shadow, perspective, low contrast, colour-only, clutter,
  cut-off, full-frame, noise, many seeds).
- **Browser tests (Playwright, real Chromium with a fake camera):** import, edit with auto-detect and keyboard
  nudging, reorder, export a valid multipage PDF (opened and checked), bulk selection, persistence across reload,
  settings, live camera capture, camera-denied guidance, combine PDFs, no requests to other origins, and a
  service-worker **offline** reload that still scans and exports.
- **Spread and robustness tests** (`web/e2e/spreads.spec.ts`, `web/tests/spread.test.ts`, `web/tests/store.test.ts`): gutter finder
  (clear, tilted, off-centre, absent, faint), writing-at-the-edge check, 3 spreads give 6 ordered pages and export, an
  uncertain fold blocks Apply until confirmed, tilt and per-page corners, mixed single/spread documents, retake (others
  kept, cancel changes nothing, side deleted then retake, reorder then retake), reload recovery of documents and unsaved
  edits (spread and page editors), storage-full behaviour (warning, nothing lost, export works, recovers), service-worker
  update banner that never reloads over an open edit, and mobile layout at 360x640 and 390x700.
- **Detection acceptance:** `node bench/score.mjs <photos> web/bench/labels/baseline-5.json` (raw detection vs hand labels;
  see [BASELINE.md](BASELINE.md)). Held-out photos are still needed before any accuracy claim.
- **Memory:** `node bench/memory.mjs 12 3000` (desktop Linux; phones not measured).
- Not covered: real phone cameras and Safari/iOS behaviour (no iPhone or Android device was available).

- **Detection benchmark on real photos:** `npm run bench -- <folder>` (see [PAGE_DETECTION.md](PAGE_DETECTION.md)).
