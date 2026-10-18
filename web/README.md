# PDF Scanner (web)

A small, offline-first progressive web app: import or capture pages, crop and clean them up, then export one
PDF, or combine existing PDFs. Everything runs in your browser; **nothing is uploaded**, and the app makes no
requests to any other site.

```bash
cd web
npm ci
npm run dev        # http://localhost:5173
npm test           # unit tests (Node)
npm run build      # production build in dist/
npm run e2e        # browser tests: needs `npx playwright install chromium` (or CHROMIUM_PATH)
E2E_CPU_THROTTLE=6 npm run e2e   # same tests on a 6x slower CPU, to catch timing assumptions
```

## Layout
```
src/core/     Pure TypeScript, no DOM: geometry, filters, perspective warp, page detection (Canny + Hough +
              scored quadrilaterals), PDF building (pdf-lib). Unit-tested in Node.
src/imaging.ts  Browser glue: decode (EXIF-aware), normalise, render a page, run detection.
src/store.ts    State, settings (localStorage) and persistence (IndexedDB).
src/ui/         Screens: main view, editor, camera, export, combine, settings.
public/         Manifest, icons, service worker (offline).
e2e/            Playwright tests (real Chromium, fake camera) and the screenshot script.
```

## Notes
- Runtime dependency: `pdf-lib` only. Dev: Vite, TypeScript, Vitest, Playwright.
- Camera needs HTTPS (or localhost). If the live camera is blocked, "Take photo" opens the phone's own camera.
- Scans are kept in IndexedDB on the device. Browsers can clear site data (Safari after about a week without
  use unless the app is installed to the home screen), so export what matters.
- Offline: a service worker caches the app after the first visit.
