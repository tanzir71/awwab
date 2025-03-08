
// Cache name with version
const CACHE_NAME = 'prayertracker-v1';

// Files to cache
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/og-image.png'
];

// Install event handler - cache critical assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[ServiceWorker] Skip waiting on install');
        return self.skipWaiting();
      })
  );
});

// Activate event handler - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[ServiceWorker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch event - cache-first strategy for static assets, network-first for API calls
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip API calls - use network for those
  if (event.request.url.includes('api.aladhan.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        console.log('[ServiceWorker] Return cached version', event.request.url);
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => {
          // Don't cache if not a valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
              console.log('[ServiceWorker] Cached new resource:', event.request.url);
            });

          return response;
        })
        .catch(() => {
          // If network fetch fails, return offline page if available
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return;
        });
    })
  );
});
