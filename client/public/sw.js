// Service Worker for Mantodeus Manager PWA
// Version number - increment this to force update
const VERSION = 'v3.1.0'; // CRITICAL: Never cache TRPC API responses
const CACHE_NAME = `mantodeus-${VERSION}`;

// Assets to cache on install - only static assets
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

// Activate event - clean up ALL old caches and take control immediately
self.addEventListener('activate', (event) => {
  console.log(`[SW ${VERSION}] Activating...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
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

// Fetch event - NETWORK ONLY for API, NETWORK FIRST for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests (including S3 uploads)
  if (url.origin !== location.origin) {
    return;
  }

  // Skip Vite-specific paths - these should always go directly to Vite dev server
  if (url.pathname.startsWith('/@fs/') || 
      url.pathname.startsWith('/@vite/') || 
      url.pathname.startsWith('/@id/') ||
      url.pathname.startsWith('/node_modules/') ||
      url.pathname.includes('?import') ||
      url.pathname.includes('&import')) {
    return; // Let Vite handle these directly
  }

  // CRITICAL: Never intercept API/TRPC requests - always go to network
  // This ensures fresh data is always fetched and prevents stale cache issues
  if (url.pathname.startsWith('/api/')) {
    return; // Let browser handle API requests directly, no SW interception
  }

  // Never cache POST, PUT, DELETE, PATCH requests (mutations)
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    return;
  }

  // Never cache OPTIONS requests (CORS preflight)
  if (request.method === 'OPTIONS') {
    return;
  }

  // Network first strategy for static assets only
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful GET responses for static assets
        if (response && response.ok && request.method === 'GET') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache only for static assets
        if (request.method === 'GET') {
          console.log(`[SW ${VERSION}] Network failed, trying cache for: ${url.pathname}`);
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response('Offline - content not available', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({ 'Content-Type': 'text/plain' }),
            });
          });
        }
        throw new Error('Network request failed');
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
