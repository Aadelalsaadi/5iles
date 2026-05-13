// sw.js — 5iles Service Worker
// HTML pages are NEVER cached — always fetched fresh from network
 
const CACHE_NAME = 'files-v4';
const STATIC_ASSETS = [
  '/styles.css',
  '/manifest.json'
];
 
// Install — cache only static assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});
 
// Activate — delete all old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
 
// Fetch — HTML always from network, static assets from cache
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
 
  // Always fetch HTML fresh — never serve from cache
  if (event.request.destination === 'document' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }
 
  // For static assets: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
