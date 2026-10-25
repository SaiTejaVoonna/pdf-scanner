// Offline support: cache the app shell on install, then serve from cache and refresh in the background.
// VERSION is replaced at build time (vite.config.ts), so every release is a different file and the browser sees an update.
// An updated worker waits until the page asks it to take over (the "Update ready" banner), so an open editor is never
// swapped under the user; the very first install activates straight away.
const VERSION = '__BUILD_ID__';

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    const index = await fetch('./', { cache: 'reload' });
    const html = await index.clone().text();
    const urls = new Set(['./', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './model/corners.bin']);
    for (const m of html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)) urls.add(m[1]);
    await cache.put('./', index);
    await Promise.all([...urls].filter((u) => u !== './').map((u) => cache.add(u).catch(() => undefined)));
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreSearch: true, ignoreVary: true });
    const refresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => undefined);
    if (cached) { event.waitUntil(refresh); return cached; }
    const res = await refresh;
    if (res) return res;
    if (req.mode === 'navigate') { const shell = await cache.match('./', { ignoreVary: true }); if (shell) return shell; }
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  })());
});
