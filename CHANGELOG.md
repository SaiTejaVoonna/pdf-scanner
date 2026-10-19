# Changelog

## 1.0.0-beta.1
First beta.
- **New web app** (`web/`): offline PWA with camera/import, auto-detect crop, filters, reorder, bulk actions, PDF export
  (size and quality), combine PDFs, settings; 34 unit tests and 10 real-browser tests including offline.
- Web, **book spreads**: Single page / Book spread mode; review screen with 4 outer corners + a tiltable fold (2 handles)
  or independent per-page corners; 3 spreads give 6 ordered pages; mixed single pages and spreads; retake (others kept),
  side deletion, reorder; one shared source per spread with non-destructive edits; the fold is never guessed silently
  (uncertain fold must be confirmed) and writing touching a crop edge is flagged. Known limit: the fold of the
  open-notebook test photo is found only by hand (flagged as uncertain), curved pages are not flattened, no OCR.
- Web UI polish (visual direction from a reference mock-up, no branding copied): home is one big **Scan pages** button, a quiet
  Single page / Book spread switch and four tool tiles (Import images, Take photo, Combine PDFs, Resize images); the camera
  has a restrained framing guide, an honest status line ("Fit both pages in the frame", it does **not** claim live detection)
  and a running page count; **Make PDF** opens a "Ready to make your PDF" sheet with the page count, page thumbnails,
  quality cards with estimated sizes, Create PDF, Share and Keep scanning (file name, page size and keep-under-MB sit under
  "More options"). There is no Compress PDF tile: compressing an existing PDF is not a feature of this app (see ROADMAP).
- Web UI: new mobile layout (mode switch, big Scan button, tools row, per-page menu, coherent selection mode), camera shows a
  spread guide, "Update ready" banner (the new version never takes over an open editor), draft recovery after reload,
  clear message when browser storage is full, safe handling of service-worker updates.
- Benchmarks: `bench/score.mjs` with hand labels, `docs/BASELINE.md` (old 0/4, current 4/4 on four photos), `bench/memory.mjs`,
  `docs/ML_EVALUATION.md` (DocAligner measured, not adopted, not bundled).
- Web detector: new **paper-colour** candidate generator (whiteness threshold, morphological clean-up, convex-hull quad fit)
  plus an "is the inside mostly paper?" check. On four real cluttered phone photos (bed sheet and laptop, phone on a
  patterned cloth, a phone screen) the old detector returned huge boxes around the clutter; the new one frames the
  page/screen, and correctly declines a dark screen. Synthetic tests added.
- Web fixes: the crop screen no longer clips the bottom corners of tall photos on phones; camera capture flashes, shows
  the last shot and a "Page N saved" message; imported/captured pages scroll into view highlighted; Combine PDFs has a
  file-name field.
- Web, for students: a full-screen **Preview** (page with arrows/swipe, zoom, jump to the editor), a **Show original**
  compare button in the editor, and a **Resize images** tool (presets or custom pixels, JPEG/PNG, optional "keep each
  image under X MB" for upload portals, before/after sizes, individual files or one ZIP). Browser-side only.
- Web: the Export dialog shows the **estimated PDF size** (KB/MB) for each quality, adds a **Tiny** preset, and has an optional
  "Keep under (MB)" box that picks the best quality that fits (estimates were within 0-5% of the real size in a test with
  two 3000x4000 photos).
- Web: detected crops get a small outward margin; `npm run bench` scores the detector on a folder of real photos.
- Detector fix (Android and web): a full-frame page with text no longer yields a crop of the text block; the side
  contrast now compares paper levels (band maximum) instead of means.
- New page detector (Canny + Hough + scored quadrilaterals) replacing the brightness-only heuristic.
- Auto-crop is optional: separate switches for camera and imports (imports off by default); per-page controls;
  long-press multi-select with bulk auto-crop, remove crop, rotate, filter and delete.
- New **Enhanced** filter (shadow removal, white paper, colour kept) and default-filter setting.
- PDF export quality presets (High, Balanced, Small file).
- Import PDFs to combine, split and reorder pages; resize and compress images tool.
- Settings sheet; version label; docs reorganised; CI publishes a plain APK to a rolling `latest-debug` release.
- Fixes: lost updates on rapid bulk edits, page labels missing before thumbnails load, empty-state layout on
  short screens, silent failure on empty PDFs, temp-file cleanup races, unreadable-image errors.
