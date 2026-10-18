# Changelog

## 1.0.0-beta.1
First beta.
- **New web app** (`web/`): offline PWA with camera/import, auto-detect crop, filters, reorder, bulk actions, PDF export
  (size and quality), combine PDFs, settings; 34 unit tests and 10 real-browser tests including offline.
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
