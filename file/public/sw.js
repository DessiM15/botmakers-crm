const CACHE_NAME = 'bm-crm-v1';
const OFFLINE_URL = '/offline.html';

// Pre-cache the offline page and icons on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        OFFLINE_URL,
        '/icons/icon-192.png',
        '/icons/icon-512.png',
      ])
    )
  );
  self.skipWaiting();
});

// Clean up old caches on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Network-first strategy; fall back to offline page for navigation requests
self.addEventListener('fetch', (event) => {
  // Skip non-GET, API routes, auth callbacks, and chrome-extension requests
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/api/') ||
    event.request.url.includes('/auth/') ||
    !event.request.url.startsWith('http')
  ) {
    return;
  }

  // Only intercept navigation requests (HTML pages)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
  }
});
