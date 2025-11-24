// Service Worker for Mantodeus Manager PWA
// Version number - increment this to force update
const VERSION = 'v2.0.0';
const CACHE_NAME = `mantodeus-${VERSION}`;
const RUNTIME_CACHE = `mantodeus-runtime-${VERSION}`;

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install event - cache core assets and skip waiting immediately
self.addEventListener('install', (event) => {
  console.log(`[SW ${VERSION}] Installing...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => {
        console.log(`[SW ${VERSION}] Installed, skipping waiting`);
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches and take control immediately
self.addEventListener('activate', (event) => {
  console.log(`[SW ${VERSION}] Activating...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log(`[SW ${VERSION}] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log(`[SW ${VERSION}] Activated, claiming clients`);
      return self.clients.claim();
    })
  );
});

// Fetch event - NETWORK FIRST for everything to always get fresh content
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Network first strategy for ALL requests
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone and cache successful responses
        if (response && response.ok) {
          const responseClone = response.clone();
          const cacheName = url.pathname.startsWith('/api/') ? RUNTIME_CACHE : CACHE_NAME;
          caches.open(cacheName).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Only fallback to cache if network fails
        console.log(`[SW ${VERSION}] Network failed, trying cache for: ${url.pathname}`);
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return offline page or error
          return new Response('Offline - content not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain',
            }),
          });
        });
      })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log(`[SW ${VERSION}] Received SKIP_WAITING message`);
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: VERSION });
  }
});

// Notify clients when a new service worker is waiting
self.addEventListener('controllerchange', () => {
  console.log(`[SW ${VERSION}] Controller changed, reloading page`);
});
