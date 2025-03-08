
// Cache name with version
const CACHE_NAME = 'prayertracker-v1';

// Files to cache
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install event handler - cache critical assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching Files');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: All Files Cached');
        return self.skipWaiting();
      })
  );
});

// Activate event handler - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - network first with cache fallback strategy
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Make a copy of the response
        const responseClone = response.clone();
        
        // Open cache
        caches.open(CACHE_NAME)
          .then((cache) => {
            // Add response to cache
            cache.put(event.request, responseClone);
          });
        return response;
      })
      .catch(() => {
        console.log('Service Worker: Fetching from Cache');
        return caches.match(event.request);
      })
  );
});
