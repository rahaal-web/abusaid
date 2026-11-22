const CACHE_NAME = 'abusaid-public-v1';
const PUBLIC_ASSETS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/manifest.webmanifest',
  '/styles/auth.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PUBLIC_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept or cache HTML, protected store routes, admin routes, or APIs
  if (
    PUBLIC_ASSETS.includes(url.pathname) ||
    url.pathname.startsWith('/icons/')
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (res && res.ok && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {});
          }
          return res;
        });
      })
    );
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      try {
        payload = { body: event.data.text() };
      } catch {
        payload = {};
      }
    }
  }

  const title =
    (payload && typeof payload.title === 'string' && payload.title.trim()) ||
    'أبو سعيد – إشعار جديد';
  const body =
    (payload && typeof payload.body === 'string' && payload.body.trim()) ||
    'يوجد تحديث جديد من متجر أبو سعيد.';
  const targetUrl =
    (payload && typeof payload.url === 'string' && payload.url.trim()) || '/';

  const options = {
    body,
    icon: (payload && payload.icon) || '/icons/icon-192.png',
    badge: (payload && payload.badge) || '/icons/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [140, 70, 140],
    tag: (payload && payload.tag) || 'abusaid-notice',
    renotify: true,
    requireInteraction: false,
    data: { url: targetUrl },
  };

  if (payload && payload.image && typeof payload.image === 'string') {
    options.image = payload.image;
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification?.data?.url || '/';
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clientList) => {
        for (const client of clientList) {
          if (client.url && client.url.startsWith(self.location.origin)) {
            if (typeof client.navigate === 'function' && client.url !== targetUrl) {
              try {
                await client.navigate(targetUrl);
              } catch {
                // ignore navigation error if cross-context
              }
            }
            if (typeof client.focus === 'function') {
              return client.focus();
            }
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return null;
      })
  );
});
