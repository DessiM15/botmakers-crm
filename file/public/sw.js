const CACHE_NAME = 'bm-crm-v2';
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

// No fetch interception — this CRM requires a live database connection,
// so offline fallback pages cause more confusion than they solve.
// The SW exists only to enable PWA install prompts.
