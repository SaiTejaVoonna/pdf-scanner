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
