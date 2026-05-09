// CampusShare Admin Service Worker
// Handles background push notifications even when admin app is closed

// Install: activate immediately
self.addEventListener('install', (event) => {
  console.log('[Admin SW] Installed');
  self.skipWaiting();
});

// Activate: claim all open clients
self.addEventListener('activate', (event) => {
  console.log('[Admin SW] Activated');
  event.waitUntil(clients.claim());
});

// Fetch: passthrough
self.addEventListener('fetch', () => {});

// ── PUSH NOTIFICATION HANDLER ─────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'CampusShare Admin', body: event.data?.text() || 'You have a new admin alert.' };
  }

  const title = data.title || 'CampusShare Admin';
  const options = {
    body: data.body || 'You have a new admin alert.',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    vibrate: [200, 100, 200, 100, 200], // stronger buzz for admin alerts
    requireInteraction: true,           // stays on screen until dismissed
    silent: false,
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Open Admin' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── NOTIFICATION CLICK HANDLER ────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
