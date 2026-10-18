# Roadmap

Principles: offline, free, open source, simple tools that do the job. No accounts, ads, analytics or uploads.
Prefer open-source building blocks over a dependency on any single vendor's SDK.

## Done (beta 1.0.0-beta.1)
- Camera capture and Photo Picker import, multi-page documents, drafts
- Page detection (Canny + Hough + quad scoring), manual corners with perspective correction
- Auto-crop switches (camera / import), per-page and multi-select bulk actions
- Filters: Original, Enhanced, Grayscale, Black & white; rotation
- PDF export: A4 / Letter / match image, quality presets; save and share
- PDF import (raster) for combining, splitting and reordering
- Resize / compress images tool
- Library: search, rename, delete, share; dark mode; accessibility labels
- CI that builds a downloadable debug APK

## Done: web app (beta)
Offline PWA in `web/`: camera and import, crop with auto-detect, filters, reorder, bulk actions, PDF export with
size and quality, combine PDFs (text preserved), settings, installable, browser-tested including offline.

## Next
0. **Web:** library of several documents, PDF page import/split with pdf.js, live page outline and auto-capture.
1. **OCR and searchable PDFs** with Tesseract (Tesseract.js on the web) (Apache-2.0), bundled language data, search text in the library,
   suggest document names from the first lines of text.
2. Folders and multi-select in the library (share/move/delete many documents).
3. Better detection on difficult photos (more real-photo test cases; learned corner model if a suitably
   licensed small one exists).
4. Keep text selectable when combining existing PDFs (needs a PDF parser library).
5. PDF password protection; custom page sizes and margins.
6. A signed release pipeline with owner-managed keys, then store listings.

## Not planned
Cloud sync, accounts, ads, analytics, anything that uploads documents.
