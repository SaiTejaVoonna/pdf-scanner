# Changelog

## 1.0.0-beta.1
First beta.
- Web, **one engine for every input** (batch B, part 1): a single `findPage` (core/find.ts) now finds the page for new photos, the editor's Auto-detect and bulk Auto-crop, always in the background worker, and rates the outline high, medium or low. An unsure or missing automatic crop marks the page with a yellow **Check** badge (cleared when you edit it) instead of looking certain. 4 new unit tests. The trained model is not in the app yet: it is still training and must beat the rules on real photos first.
- Web, **Tools hub and Material look** (batch C): Tools opens a hub with Compress PDF (re-encodes the photos inside a scanned PDF to reach a size; says so when a PDF has no photos), Resize photo (form presets, exact size in px or mm at a DPI, crop-to-fill or fit-on-white, smallest and largest file size; a minimum is reached by padding a JPEG with harmless metadata), Combine PDFs and Split PDF (keep pages like `1-3, 5`, or every page in a ZIP). Icons are now Material Symbols (Apache-2.0, inline SVG, `docs/THIRD_PARTY.md`); Material 3 shapes and tonal buttons. 13 new unit tests and 4 new browser tests.
- Web, **new home and one draft** (batch A, steps 1–3): the home screen is three ways in (Scan, Import, Tools), a "Continue scanning" banner for the unfinished draft (open or discard, with Undo) and one flat list of finished PDFs with search. New photos go into the one unfinished draft; making the PDF turns it into a list entry and the next scan starts a new draft. Reopening a PDF to add or delete pages flags it "Edited, save to update", and making it again replaces the file instead of keeping copies. An open document has its own bar, two pages across, a book spread as one joined tile on its own row, "N to check" in the header and a bottom bar (Add, Preview, Make PDF); Add opens a sheet with Scan pages, Import images, Take photo and the Single page / Book spread switch. 3 new store tests and 4 new browser tests.
- Web, **spread editor** (batch A, step 4): the warnings become one short bar over the photo (it no longer pushes the photo around), the long hint is one line, and the tool buttons and filter chips take less room, so the photo gets more of the screen. The mode switch moved to the Import and Add sheets and the camera screen.
- **New web app** (`web/`): offline PWA with camera/import, auto-detect crop, filters, reorder, bulk actions, PDF export
  (size and quality), combine PDFs, settings; 34 unit tests and 10 real-browser tests including offline.
- Web, **book spreads**: Single page / Book spread mode; review screen with 4 outer corners + a tiltable fold (2 handles)
  or independent per-page corners; 3 spreads give 6 ordered pages; mixed single pages and spreads; retake (others kept),
  side deletion, reorder; one shared source per spread with non-destructive edits; the fold is never guessed silently
  (uncertain fold must be confirmed) and writing touching a crop edge is flagged. Known limit: the fold of the
  open-notebook test photo is found only by hand (flagged as uncertain), curved pages are not flattened, no OCR.
- Web detector: a writing-safety fallback. When the outline found runs through lines of handwriting (shadow or stacked sheets fooled the edge search), the crop becomes a box around the writing. Fixes a letterhead page in a folder whose left part was cut (16.5% of the content lost before, 0.2% after). Added the photo to the baseline (`baseline-5.json`).
- Web icons: the emoji are replaced by one hand-drawn outline icon set (`web/src/ui/icons.ts`, 24px grid, `currentColor`, no font or download), so icons look the same on every phone and follow light/dark mode. Preview sheet: `docs/screenshots/web-icons.png`.
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
- Web camera, **live detection and auto-capture** (on by default, Fast/Normal/Careful, persisted switch): the page outline is tracked a few times a second in a worker and the shot fires once the page is big, sharp and still; the same page is never captured twice and the camera re-arms when the page is turned. Fixed a shutter that silently ignored taps before the first video frame.
- Web camera, **book spread**: a visible fold line (dark core, white edges), a two-page check (an outline without a found fold is one page: amber warning, no auto-capture), a "Spread N · will be pages A & B" counter, and a shutter progress ring. A camera capture of a spread is now added at once (no review screen mid-scan) with an Undo; unsure captures get a "Check" badge in the page list. Import still opens the review screen. UI mocks are in `docs/mocks/`.
- Web camera, spread: the fold is taken from the on-screen centre guide instead of being searched for. Green = outline found and a valley is seen on the guide (auto-capture allowed); yellow = outline found but the fold is not confirmed (manual capture still works, the whole frame is kept and the pair is added with a "Check" badge). Slimmer guide bar and a wrapping status line.
- Web camera, **anchor lines** (single page, new `core/anchor.ts`, switchable in Settings and with a "Lines" chip): two guide lines; the edge or fold placed on one is pinned, the picture is cut there so the neighbouring page of an open book is never reached into, the existing detector finds the rest and the pinned side is put back on the line. Falls back to the normal search when nothing sits on a line. Not verified at scale: on one real notebook photo the left page and the right page outlines came out right when aligned, but the fold position is only as good as the alignment.
- Web camera, **stricter auto-capture**: only an outline that looks like a real page (bright, lighter than its surroundings, with writing or print) may auto-capture; a floor, a dark room or a blank sheet shows a plain "not sure" hint and waits for the shutter. Fixes auto-capture photographing the floor.
- Web camera layout v2: the preview now fills the screen width (cover) with the controls in bars above and below it, so nothing is laid over the page edges; detection, overlays, anchor lines and the saved photo all use the visible part. Tap the pages thumbnail on the live camera to open a pages sheet (see, move, delete, tap to edit). No outline or "blank page" message for things that cannot be a page (ceiling beams, walls at a slant).
- Web camera and capture, logic fixes: a photo is added the moment it is taken and its crop (or spread split) is found afterwards in a background worker, so the shutter is ready again straight away and the screen no longer stalls; the photo is encoded once (no double JPEG); a crop is only used if it is valid and the person has not touched the page meanwhile. The spread fold bar never moves (it only changes colour: green = both pages and the fold confirmed, amber = not confirmed); a spread is confirmed by a fold valley or by writing on both sides of an empty fold strip. Auto-capture needs a minimum sharpness and is paused while the pages sheet or an editor is open on top; a blurry capture offers Remove; outlines and "blank page" hints appear only where there is writing or a bright blank page; the camera restarts after switching apps and slows down while nothing is in view or the tab is hidden. Single-page guide lines are now off by default (setting `guideLines`).
- Web, **documents** (replaces the single pile of pages): every scan session is its own document with a name, saved automatically as a draft until a PDF is made. Home shows the documents list (thumbnail, name, pages, date, Draft / PDF made), a document opens to its own pages, the camera and imports add to the open document (or start a new one from the list), "Back" returns to the list and empty documents never pile up. The PDF that is made is kept with its document ("Saved PDFs": download again, remove). Deleting a document goes to "Recently deleted" for 30 days (restore or delete for good); deleting pages, a selection or a document shows Undo instead of a browser pop-up, and the editor's "discard changes?" and every other question are now in-app dialogs. Scans from the previous version become a document called "Earlier scans". Right-to-left books (Settings) put the right page first. The app asks the browser to keep its storage, tells the person honestly when it may not (iPhone) and can back everything up as one ZIP. Export estimates sizes from three sample pages and stops when the real export starts; the thumbnail cache is bounded.
