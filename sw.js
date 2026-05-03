// 5iles Service Worker — PWA Offline Support
const CACHE_NAME = '5iles-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/compress-pdf.html',
  '/merge-pdf.html',
  '/pdf-to-word.html',
  '/pdf-to-excel.html',
  '/compress-image.html',
  '/jpg-to-pdf.html',
  '/pdf-to-jpg.html',
  '/sign-pdf.html',
  '/sitemap.xml',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
];

// Install — cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS.map(url => {
        return new Request(url, { mode: 'no-cors' });
      })))
      .then(() => self.skipWaiting())
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(key => key !== CACHE_NAME)
        .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch — serve from cache, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET and PayPal/analytics requests
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('paypal.com')) return;
  if (event.request.url.includes('google-analytics.com')) return;
   if (event.request.url.includes('googletagmanager.com')) return;
    if (event.request.url.includes('/.netlify/functions/')) return;
    if (event.request.url.endsWith('index.html') || event.request.url.endsWith('/')) { event.respondWith(fetch(event.request)); return; }

  event.respondWith(
    caches.match(event.request)
      .then(cached => {
        if (cached) return cached;
        return fetch(event.request)
          .then(response => {
            if (!response || response.status !== 200) return response;
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            return response;
          })
          .catch(() => {
            // Offline fallback
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Push notifications (for future use)
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || '5iles', {
    body: data.body || 'Your file is ready!',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/' }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
