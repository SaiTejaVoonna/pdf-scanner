# UI reference: calm glass

The build reference for the next UI pass. Mocks: `docs/mocks/ref-*.png` (built by `docs/mocks/build_mocks_ref.py`). Style rules: `ref-8-style.png`.

| Mock | Screen | Today's code |
|---|---|---|
| ref-1-home | Home (light, dark, first run, search, PDF menu) | `ui/app.ts` `renderHome`, `openDocMenu` |
| ref-2-capture | Camera (found, guidance, spread, blocked), Import sheet | `ui/camera.ts`, `ui/app.ts` `openImport` |
| ref-3-pages-edit | Pages, selecting, Edit page, Edit spread, page menu | `ui/app.ts` `card`, `renderBar`, `ui/editor.ts`, `ui/spreadEditor.ts` |
| ref-4-pdf | Make PDF, saved, reopened + "Save changes", Undo, Recently deleted | `ui/exportDialog.ts`, `ui/app.ts`, `ui/trashDialog.ts` |
| ref-5-tools | Tools hub, Compress, Resize photo, Combine, Split | `ui/toolsHub.ts` and the dialogs next to it |
| ref-6-settings | Settings, Add pages, update banner, storage full, install tip | `ui/settingsDialog.ts`, `ui/updateBanner.ts` |
| ref-7-desktop | Desktop home and open PDF | same screens, sidebar layout from 720 px |

Not built yet: the floating glass bar with the round Scan button, Settings as a tab, the Edit page screen as drawn (tools row + filter thumbnails),
PDF menu items Make smaller / Share / Back up, and removal of the camera "Lines" chip.

## Built (October 2026) and how close it is to the mocks

Screens of the real app: `docs/screenshots/ui-*.png` (made by `web/e2e/screenshots.mjs`), next to the mocks `docs/mocks/ref-*.png`.

| Mock | Status | Differences from the mock |
|---|---|---|
| Home (light, dark, empty, search, PDF menu) | Built | Import is a round button next to the title (the mock had none); each row has a menu button instead of a chevron |
| Dock / sidebar | Built | Floating glass bar with PDFs, Tools, Settings and the round Scan button; sidebar from 720 px |
| Settings | Built as a tab | Adds Auto-capture, its speed, Filter for new pages and Recently deleted rows |
| Tools and the four tool pages | Built | Pages have a file card and full-width buttons; no photo preview on Resize photo |
| Camera (found, guidance, spread, blocked) | Built | The status pill is also the Auto-capture switch; the flashlight button appears only where the browser supports it |
| Import and Add sheets | Built | |
| Pages, selecting, page menu | Built | Cards have a menu button (the mock shows only the number); a yellow dot marks "Check" |
| Edit page | Built | Tools row (Crop, Rotate, Auto, Look) and filter thumbnails with real previews |
| Edit spread | Built | Filter thumbnails are plain swatches, not previews |
| Make PDF sheet, PDF saved | Built | A "Keep scanning" link under the buttons; Share appears only where the browser can share files |
| Reopened PDF "Save changes", Undo toast, Recently deleted | Built | |
| Desktop | Built | Sidebar plus a 4-column grid |

Not in the mocks and not built: Share Target, the PDF file handler, Drive backup, "Back up to my cloud" in the PDF menu.
