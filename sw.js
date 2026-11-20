// Service worker: shows reminder notifications and lets the app open without internet.
const CACHE = 'typ-v2';
const FILES = [
  './', 'index.html', 'admin.html', 'css/app.css', 'manifest.webmanifest',
  'js/gloria.js', 'js/admin.js', 'js/store.js', 'js/config.js', 'js/drugs.js', 'js/checks.js',
  'js/schedule.js', 'js/examples.js', 'js/appointments.js', 'icons/icon-192.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Always try the network first so updates show up; fall back to the saved copy when offline.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data && event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Time for your medicine', {
      body: data.body || 'Open My Pills before you take it.',
      tag: data.tag,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      requireInteraction: true,
      data: { url: data.url || './' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const existing = wins.find((w) => new URL(w.url).pathname.endsWith('/') || w.url.includes('index.html'));
      if (existing) {
        existing.postMessage({ open: url }); // the app opens the right screen
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
