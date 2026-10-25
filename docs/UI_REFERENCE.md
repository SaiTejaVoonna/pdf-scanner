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
