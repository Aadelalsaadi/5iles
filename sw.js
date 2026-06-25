// 5iles service worker
// Purpose: satisfies PWA installability requirements (a registered, controlling
// service worker is required by Chrome/Edge/Android before "Install App" can
// be offered). Kept deliberately minimal — no offline caching of tool pages,
// since file conversion tools require a live network connection to the
// backend anyway, so aggressive caching would not improve the experience and
// risks serving stale app code after updates.

const CACHE_NAME = '5iles-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Pass-through fetch handler — required for installability, but intentionally
// does not intercept or cache conversion requests, file uploads, or API calls.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
