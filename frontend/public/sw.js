// CampusShare Service Worker
// Handles background push notifications even when app is closed

const CACHE_NAME = 'campusshare-v2';

// Install: activate immediately without waiting for old SW to die
self.addEventListener('install', (event) => {
  console.log('[SW] Installed');
  self.skipWaiting(); // take control immediately
});

// Activate: claim all open clients so this SW controls them right away
self.addEventListener('activate', (event) => {
  console.log('[SW] Activated');
  event.waitUntil(clients.claim());
});

// Fetch: passthrough (no caching for now — app is not static)
self.addEventListener('fetch', () => {});

// ── PUSH NOTIFICATION HANDLER ─────────────────────────────────────────────────
// This fires even when the app tab is closed or phone screen is off.
// The OS will wake up the service worker, show the notification with sound.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'CampusShare', body: event.data?.text() || 'You have a new update.' };
  }

  const title = data.title || 'CampusShare';
  const options = {
    body: data.body || 'You have a new update.',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    vibrate: [200, 100, 200],          // buzz pattern like WhatsApp
    requireInteraction: false,          // auto-dismiss after a few seconds
    silent: false,                      // allow device sound/vibration
    data: { url: data.url || '/' },
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── NOTIFICATION CLICK HANDLER ────────────────────────────────────────────────
// Open / focus the app when user taps the notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If app already open, focus it
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});