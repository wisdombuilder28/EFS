// ============================================================
// SERVICE WORKER — Emeakaroha Foundation School
// Handles: PWA caching (offline support) + push notifications
// MUST live in the ROOT folder (same level as index.html)
// ============================================================

const CACHE_NAME   = 'efs-pwa-v2';
const OFFLINE_URL  = '/index.html';

// All files to pre-cache so the app works offline
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/news.html',
  '/gallery.html',
  '/AI.html',
  '/study.html',
  '/developers.html',
  '/style.css',
  '/nav.css',
  '/gallery.css',
  '/gallery.js',
  '/theme.js',
  '/manifest.json',
  '/IMG-20260326-WA0001~2.jpg',
];

// ── INSTALL — pre-cache all core files ──────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE — clean up old caches ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => clients.claim())
  );
});

// ── FETCH — serve from cache, fall back to network ──────────────────────────
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests (fonts, CDN, APIs etc.)
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Serve from cache, but update cache in background (stale-while-revalidate)
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cloned = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return networkResponse;
        }).catch(() => {});
        return cachedResponse;
      }

      // Not in cache — fetch from network and cache it
      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const cloned = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return networkResponse;
      }).catch(() => {
        // Network failed and not in cache — serve offline fallback
        if (event.request.destination === 'document') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// ── PUSH — fires when server sends a notification ────────────────────────────
self.addEventListener('push', (event) => {
  let payload = {
    title:    'Emeakaroha Foundation School',
    body:     'A new announcement has been posted.',
    category: 'general',
    icon:     '/IMG-20260326-WA0001~2.jpg',
    badge:    '/IMG-20260326-WA0001~2.jpg',
    url:      '/news.html'
  };

  if (event.data) {
    try {
      const data = event.data.json();
      payload.title    = data.title    || payload.title;
      payload.body     = data.body     || payload.body;
      payload.category = data.category || payload.category;
    } catch (e) {
      payload.body = event.data.text() || payload.body;
    }
  }

  const categoryEmoji = {
    urgent:   '🚨',
    academic: '📚',
    events:   '🎉',
    sports:   '⚽',
    general:  '📢',
  };
  const emoji = categoryEmoji[payload.category] || '📢';

  const options = {
    body:               `${emoji} ${payload.body}`,
    icon:               payload.icon,
    badge:              payload.badge,
    tag:                'efs-announcement',
    renotify:           true,
    requireInteraction: false,
    data:               { url: payload.url },
    actions: [
      { action: 'view',    title: 'View Announcement' },
      { action: 'dismiss', title: 'Dismiss' },
    ]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

// ── NOTIFICATION CLICK — opens the correct page ──────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/news.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
