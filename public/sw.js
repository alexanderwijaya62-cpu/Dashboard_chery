const STATIC_CACHE = 'chery-static-v2';
const NAV_CACHE = 'chery-nav-v2';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/cherylogo.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== STATIC_CACHE && k !== NAV_CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('push', (e) => {
  const data = e.data?.json() || {};
  const title = data.title || 'Panggilan Antrian';
  const options = {
    body: data.body || 'Silahkan menuju counter',
    icon: '/cherylogo.png',
    badge: '/cherylogo.png',
    vibrate: [200, 100, 200, 100, 400],
    data: { url: data.url || '/' },
    requireInteraction: true
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      const existing = windowClients.find(c => c.url === url);
      if (existing) { existing.focus(); return; }
      clients.openWindow(url);
    })
  );
});

// ── Fetch: Network-first for HTML, Cache-first for assets ──
self.addEventListener('fetch', (e) => {
  if (!e.request.url.startsWith(self.location.origin) || e.request.method === 'POST') {
    return;
  }

  const { pathname } = new URL(e.request.url);

  // API calls: network only, no cache
  if (pathname.startsWith('/api/')) {
    return;
  }

  // Navigation / HTML: network-first, fallback to cache
  if (e.request.mode === 'navigate' || pathname === '/' || pathname === '/index.html') {
    e.respondWith(
      fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(NAV_CACHE).then((c) => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request).then((c) => c || caches.match('/index.html')))
    );
    return;
  }

  // Static assets with hashed names: cache-first, update cache in background
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetchAndCache = fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      });
      return cached || fetchAndCache;
    })
  );
});
