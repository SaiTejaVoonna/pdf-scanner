# PDF Scanner

A native Android document scanner built with Kotlin, Jetpack Compose and Material 3.
Scan pages with the camera or import photos, straighten and clean them up, reorder them, and export a
real multipage PDF — **entirely offline, on your device**. No accounts, no ads, no analytics, no uploads.

## Screenshots

_Screenshots are not available yet: the app has not been run on a device or emulator by its author.
Add them under `docs/screenshots/` and reference them here._

| Home | Capture | Crop | Export |
| --- | --- | --- | --- |
| _placeholder_ | _placeholder_ | _placeholder_ | _placeholder_ |

## Features (implemented)

- **Library** of locally saved documents with search, rename, delete-with-confirmation and share.
  A prominent **Scan** button, and an *Import photos* shortcut, are always one tap away.
- **Capture** pages with CameraX (flash toggle, multiple pages per document) or **import** images with
  the Android Photo Picker (multi-select, no storage permission needed).
- **Automatic edge detection** finds the page in each photo, with **adjustable crop corners** and
  **perspective correction**. A manual fallback is always available: if detection fails, you get the full
  image and draggable corners (plus *Auto-detect* / *Full image* buttons).
- **Rotate** and apply **Original / Grayscale / Black & white** filters (the B&W filter is adaptive, so it
  copes with shadows and uneven lighting). Edits are non-destructive and can be changed later.
- **Review** all pages in a grid: reorder, add more, remove, or tap to edit.
- **Export** a genuine multipage PDF with a custom **file name** and **page size** (A4, US Letter, or match
  each scan). Save anywhere through the **Storage Access Framework**, or **share** via a `FileProvider`
  `content://` URI with a temporary read grant.
- **Drafts**: a scan in progress is stored as you go, so it survives rotation, process death and leaving the
  app; the home screen offers to resume or discard it.
- Dark mode, TalkBack labels, 48dp touch targets, and keyboard/accessibility actions for moving crop corners
  and reordering pages.

## Planned / not implemented

These are **not** part of the app today: OCR and searchable PDFs, cloud sync (Drive or otherwise),
custom page sizes and margins, a signed release / Play Store build, and on-device (instrumented) UI tests.

## Download the APK from GitHub Actions

Every push and pull request builds a debug APK you can install on a test device:

1. Open the repository on GitHub and click the **Actions** tab.
2. Click the **Android CI** workflow, then the latest run for your branch
   (for example `claude/amazing-babbage-qr2tmb`) with a green check.
3. Scroll to the **Artifacts** section at the bottom of the run summary.
4. Download **`pdf-scanner-<version>-<commit>-debug-apk`** (a zip containing
   `pdf-scanner-<version>-<commit>-debug.apk`). Artifacts are kept for 30 days and require being signed in
   to GitHub with read access to the repository.
5. Unzip it, copy the APK to your phone, and open it. You must allow *Install unknown apps* for your file
   manager or browser. Or install over USB: `adb install pdf-scanner-*-debug.apk`.

The debug APK is signed with the standard Android debug key. It is for testing and sideloading only.

**Releases:** if the owner pushes an explicit version tag matching `versionName` in `app/build.gradle.kts`
(for example `git tag v1.0.0 && git push origin v1.0.0`), the workflow also publishes a GitHub *pre-release*
with that debug APK attached. Nothing is published unless such a tag is pushed.

**Play Store / production:** the workflow's `assembleRelease` output is *unsigned* and **cannot be
installed**; it is built only to prove the minified release configuration compiles. Distributing through
Google Play requires a properly signed Android App Bundle (`bundleRelease`) with an upload key managed by
the owner (kept in repository *secrets*, never committed). No signing is configured or attempted here.

## Requirements

| Tool | Version |
| --- | --- |
| JDK | 17 or newer (21 works) |
| Android SDK | Platform 35, Build-Tools 35 (Android Studio installs these) |
| Device | Android 8.0 (API 26) or newer; a camera is optional (import works without one) |

Gradle 8.11.1 and the Android Gradle Plugin 8.7.3 are pinned through the included wrapper; dependency
versions live in [`gradle/libs.versions.toml`](gradle/libs.versions.toml).

## Build and run

1. Open the project in **Android Studio** (Ladybug or newer) and press **Run**, or from a terminal:

   ```bash
   # Point Gradle at your SDK once (Android Studio does this automatically)
   echo "sdk.dir=$ANDROID_HOME" > local.properties

   ./gradlew assembleDebug          # app/build/outputs/apk/debug/app-debug.apk
   ./gradlew installDebug           # install on a connected device/emulator
   ```

2. Run all checks:

   ```bash
   ./gradlew testDebugUnitTest lintDebug
   ```

   Test reports: `app/build/reports/tests/testDebugUnitTest/index.html`.

3. A minified release build is `./gradlew assembleRelease` (**unsigned and not installable**; for Play distribution
   the owner must add their own signing config and build a signed AAB. Keystores and credentials are
   git-ignored and must never be committed).

## Project layout

| Path (`app/src/main/java/com/saiteja/pdfscanner/`) | Responsibility |
| --- | --- |
| `ui/home`, `ui/camera`, `ui/document`, `ui/edit` | Compose screens and their ViewModels |
| `ui/components`, `ui/theme`, `ui/Navigation.kt` | Shared widgets, Material 3 theme, navigation graph |
| `domain/` | Pure models and logic (geometry, page ordering, file names) |
| `data/` | Room database, repository, on-disk file store |
| `imaging/` | Edge detection, perspective warp, filters, import, rendering, thumbnails |
| `pdf/` | PDF writer and exporter |

Tests mirror this layout under `app/src/test/`. See [CONTRIBUTING.md](CONTRIBUTING.md) for workflow tips.

## Architecture

```
app/src/main/java/com/saiteja/pdfscanner/
├── domain/    Pure Kotlin models and logic: geometry (Quad), page ordering, file names
├── imaging/   EdgeDetector, PerspectiveTransform, ImageFilters (pure, JVM-testable) and the
│              Android glue: ImageImporter (EXIF + size cap), PageRenderer, ThumbnailCache, PageIngestor
├── pdf/       PdfWriter (dependency-free PDF 1.4 writer) and PdfExporter
├── data/      Room database, DocumentRepository, FileStore
└── ui/        Compose screens + ViewModels: home, camera, document (review/export), edit
```

- **MVVM** with `ViewModel`s, `StateFlow`, `SavedStateHandle` and coroutines; manual dependency wiring in
  `AppContainer` (small enough that a DI framework would cost more than it saves).
- **Persistence**: Room stores documents and pages (edit parameters: crop corners, rotation, filter). Page
  images live in app-private storage. A document is a *draft* from the first captured page until you save
  it, which is how drafts survive configuration changes and process death.
- **Non-destructive editing**: each page keeps a normalised, EXIF-corrected source JPEG (capped at 3000 px)
  plus edit parameters; thumbnails, previews and exports are rendered from those on demand.
- **PDF writer**: pages embed the rendered JPEG verbatim (`DCTDecode`), one page at a time, so memory stays
  bounded and files stay small. Exports render at ≈300 dpi on A4 (2480 px long edge).
- **Large images** are decoded with `inSampleSize`, capped on import, and all heavy work runs off the main
  thread; out-of-memory conditions surface as a message rather than a crash.
- **Edge detection** is implemented in plain Kotlin (blur → Otsu threshold → largest quadrilateral-like
  region → corner extremes). It has no native or Play-services dependency, so it works on every device.

## Permissions and privacy

- Declared permissions: **`CAMERA` only**, requested when you open the scanner. There is **no `INTERNET`
  permission**, so the app cannot send anything off the device even by accident.
- Importing uses the system **Photo Picker**; exporting uses the system **file picker**. The app never
  needs broad storage access.
- If camera access is denied (or no camera exists) the scanner screen explains why and offers *Import
  photos*, *Allow camera* and, if the denial is permanent, a shortcut to app settings.
- Scans are stored in app-private storage, excluded from cloud backup and device transfer
  (`allowBackup=false` plus data-extraction rules). Shared PDFs are temporary copies in the cache folder
  exposed only through a narrowly scoped `FileProvider` (`cache/exports/`) and cleared on next launch.
- No accounts, ads, analytics, crash reporters or third-party services. No Google Play services are
  required, and nothing is downloaded after installation.

## Testing

`./gradlew testDebugUnitTest` runs 81 JVM tests (Robolectric is used for Room, bitmaps and Compose):

- **PDF generation**: structural validity (header, xref offsets, `startxref`, `%%EOF`), page count, media
  boxes for A4/Letter/match-image, orientation, embedded JPEG integrity, UTF-16 titles, lazy page loading.
- **Export pipeline**: real bitmaps → crop/perspective → filter → rotation → multipage PDF, page order,
  failure modes (empty document, missing image, unwritable destination).
- **Document and page operations**: create/draft/finalize, add, reorder, remove, rename, delete (including
  files), persistence of edits, isolation between documents, search.
- **Imaging**: edge detection (rotated, dark-on-light, printed text, no-document, noise), homography and
  warp, adaptive thresholding under uneven lighting.
- **ViewModels and UI**: editor state (including a regression test for an infinite re-render loop),
  saved-state restoration, import with auto-crop, and Compose tests of the home screen (empty state, search,
  rename, delete confirmation, draft resume).

Generated PDFs were additionally validated with `pdfinfo` (Poppler) and `pypdf` in strict mode.

## Limitations

- Edge detection is heuristic. It works well for a light page on a contrasting surface, but busy
  backgrounds or pages rotated near 45° may need the manual corners (that fallback is always offered).
- There is no OCR / searchable text layer; PDFs contain page images only.
- Page-size options are A4, US Letter and *match image*; there are no custom dimensions or margins.
- `minSdk` is 26 (Android 8.0). Releases are not signed or published; there is no Play Store listing.
- Automated tests run on the JVM. The camera capture path, the system pickers and on-device rendering
  were **not** exercised on a physical device or emulator in the build environment, so please smoke-test on
  hardware before relying on a build.

## Continuous integration

`.github/workflows/android.yml` runs on every push and pull request (JDK 17, Android SDK 35, Gradle
caching): unit tests, lint, `assembleDebug` and `assembleRelease`, then verifies the debug APK exists and
uploads it (30-day retention) plus test/lint reports (14 days). It uses no secrets.

## License

**No license has been selected.** Until the repository owner chooses and adds one, all rights are
reserved by default and others have no permission to reuse the code.
