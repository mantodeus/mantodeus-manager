// Service Worker for Mantodeus Manager PWA
// Version number - increment this to force update
const VERSION = 'v3.3.0'; // Force update: Fix loading screen to use logo instead of skeleton boxes
const CACHE_NAME = `mantodeus-${VERSION}`;
const RUNTIME_CACHE = `mantodeus-runtime-${VERSION}`;

// Assets to cache on install (ONLY static images, NO HTML/JS)
const PRECACHE_ASSETS = [
  '/manifest.json',
  '/logo_green.PNG',
  '/logo_pink.PNG',
];

// Install event - cache ONLY static assets, skip waiting immediately
self.addEventListener('install', (event) => {
  console.log(`[SW ${VERSION}] Installing...`);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => {
        console.log(`[SW ${VERSION}] Installed, skipping waiting`);
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error(`[SW ${VERSION}] Install failed:`, err);
        // Still skip waiting even if cache fails
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches and take control immediately
self.addEventListener('activate', (event) => {
  console.log(`[SW ${VERSION}] Activating...`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      // Delete ALL old caches (not just non-matching ones) to force fresh content
      return Promise.all(
        cacheNames.map((name) => {
          console.log(`[SW ${VERSION}] Deleting cache: ${name}`);
          return caches.delete(name);
        })
      );
    }).then(() => {
      console.log(`[SW ${VERSION}] All caches cleared, claiming clients`);
      // Don't force reload - let the app continue working
      // The new service worker will be used on next page load
      return self.clients.claim();
    })
  );
});

// Fetch event - NEVER cache HTML/JS/CSS, always fetch from network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests (including S3 uploads)
  if (url.origin !== location.origin) {
    return;
  }

  // Skip Vite-specific paths - these should always go directly to Vite dev server
  // /@fs/ - Vite's file system access for files outside project root
  // /@vite/ - Vite's internal HMR and module resolution
  // /node_modules/ - Vite's node_modules access
  // /@id/ - Vite's virtual module IDs
  if (url.pathname.startsWith('/@fs/') || 
      url.pathname.startsWith('/@vite/') || 
      url.pathname.startsWith('/@id/') ||
      url.pathname.startsWith('/node_modules/') ||
      url.pathname.includes('?import') ||
      url.pathname.includes('&import')) {
    return; // Let Vite handle these directly, no service worker interception
  }

  // NEVER cache POST, PUT, DELETE, PATCH requests (mutations)
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    return; // Let browser handle directly, no caching
  }

  // NEVER cache OPTIONS requests (CORS preflight)
  if (request.method === 'OPTIONS') {
    return;
  }

  // NEVER cache critical app files - always fetch from network
  const isCriticalFile = 
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.css') ||
    url.pathname === '/' ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/src/');

  if (isCriticalFile) {
    // For critical files, ALWAYS fetch from network, NO caching, NO fallback
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch((err) => {
        console.error(`[SW ${VERSION}] Network fetch failed for critical file: ${url.pathname}`, err);
        // Return error response instead of cached version
        return new Response('Network error - please check your connection', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain',
          }),
        });
      })
    );
    return;
  }

  // For non-critical files (images, fonts, etc.), use network-first with cache fallback
  event.respondWith(
    fetch(request, { cache: 'no-store' })
      .then((response) => {
        // Only cache static assets (images, fonts) if they're successful
        if (response && response.ok && request.method === 'GET') {
          const contentType = response.headers.get('content-type') || '';
          const isStaticAsset = 
            contentType.startsWith('image/') ||
            contentType.startsWith('font/') ||
            url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|eot)$/i);
          
          if (isStaticAsset) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
        }
        return response;
      })
      .catch(() => {
        // Only fallback to cache for static assets (images, fonts)
        if (request.method === 'GET') {
          const contentType = request.headers.get('accept') || '';
          const isStaticAsset = 
            contentType.includes('image/') ||
            contentType.includes('font/') ||
            url.pathname.match(/\.(png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|eot)$/i);
          
          if (isStaticAsset) {
            console.log(`[SW ${VERSION}] Network failed, trying cache for static asset: ${url.pathname}`);
            return caches.match(request).then((cachedResponse) => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // Return error for static assets if cache also fails
              return new Response('Offline - content not available', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                  'Content-Type': 'text/plain',
                }),
              });
            });
          }
        }
        // For non-static assets, just let them fail
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
