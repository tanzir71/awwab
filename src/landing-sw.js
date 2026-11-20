const cachePrefix = "awwab-landing-";
const cacheName = cachePrefix + __LANDING_CACHE_VERSION__;
const files = new Set(__LANDING_CACHE_FILES__);
const scope = new URL(self.registration.scope);

self.addEventListener("install", event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll([...files].map(file => new Request(new URL(file, scope), { cache: "reload" })))
  ).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith(cachePrefix) && key !== cacheName)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || !request.url.startsWith(scope.href)) return;
  const url = new URL(request.url);
  const file = url.pathname.slice(scope.pathname.length) || "index.html";
  if (!files.has(file)) return;

  const cached = () => caches.open(cacheName).then(cache => cache.match(new URL(file, scope)));
  if (file.endsWith(".html")) {
    event.respondWith(fetch(request)
      .then(async response => response.ok ? response : await cached() ?? response)
      .catch(async () => await cached() ?? Response.error()));
  } else {
    event.respondWith(cached().then(response => response ?? fetch(request)));
  }
});
