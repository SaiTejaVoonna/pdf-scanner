# Architecture

MVVM with Kotlin coroutines and Jetpack Compose (Material 3). Dependencies are wired by hand in
`AppContainer`; the app is small enough that a DI framework would cost more than it saves.

| Package | Responsibility |
| --- | --- |
| `ui/home`, `ui/camera`, `ui/document`, `ui/edit`, `ui/tools` | One screen + ViewModel each. ViewModels expose `StateFlow`s and one-shot event channels; navigation arguments arrive in `SavedStateHandle`. |
| `ui/components`, `ui/theme`, `ui/Navigation.kt` | Shared composables, Material 3 theme (light and dark), navigation graph. |
| `domain/` | Pure Kotlin, no Android classes: `Quad` geometry, `PageOrder`, `FileNames`, `ImageSizing`, models. |
| `data/` | Room (`documents`, `pages`), `DocumentRepository` (single source of truth), `AppSettings`, `FileStore`. |
| `imaging/` | `EdgeDetector` (+ `CannyEdges`, `HoughLines`, `RegionCandidates`), `PerspectiveTransform`, `ImageFilters`, `ImageImporter`, `PageRenderer`, `ThumbnailCache`, `PageIngestor`, `PdfPageImporter`, `ImageResizer`. |
| `pdf/` | `PdfWriter` (dependency-free PDF 1.4 writer) and `PdfExporter`. |

## Key decisions
- **Drafts.** A document is created as a draft on the first page and becomes a library entry when saved, so work
  survives rotation, process death and leaving the app.
- **Non-destructive pages.** Each page stores an upright, size-capped source JPEG plus edit parameters (crop
  corners, rotation, filter). Thumbnails, previews and exports are rendered from those on demand.
- **Atomic bulk edits.** Bulk page edits read and write inside one database transaction
  (`DocumentRepository.editPages`), so quick consecutive actions cannot overwrite each other.
- **PDF output.** Each page embeds its rendered JPEG verbatim (`DCTDecode`), one page at a time, so memory stays
  bounded and files stay small.
- **PDF input.** Android's built-in `PdfRenderer` rasterises pages at about 200 dpi; no extra library.
- **Pure core.** Detection, warping, filters, sizing and the PDF writer have no Android dependencies, so they are
  tested on the JVM.
- **Large images** are decoded with `inSampleSize`, capped on import (3000 px), and processed off the main thread;
  out-of-memory becomes a message, not a crash.

## Web app
`web/` is a separate TypeScript project (Vite, no framework, `pdf-lib`). `src/core` is pure and DOM-free so it is
tested in Node; the page detector there is a port of the Kotlin one and both share the same scene tests. State lives
in `src/store.ts` (IndexedDB for page images, localStorage for settings); rendering and detection glue is in
`src/imaging.ts`. A service worker caches the app shell for offline use.
