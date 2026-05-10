// Registers service worker and subscribes to Web Push (VAPID-based).
// This is what enables background notifications even when the app is closed.

const VAPID_PUBLIC_KEY = "BIuW0xcAAAN5e2bk9EoNmQBh_7bRKwjC7AI2lPimt7lkOdbNBe1MfwqL_ku10h3LmsFO9xzod9O5an7m5dTwyZ4";

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
}

export async function subscribeToPush(token) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] Service workers or PushManager not supported.');
    return;
  }

  try {
    // Register SW — updateViaCache:'none' ensures we always get the latest sw.js
    const registration = await navigator.serviceWorker.register('/sw.js', {
      updateViaCache: 'none'
    });

    // Wait for SW to be active (handles fresh install + existing SW cases)
    await navigator.serviceWorker.ready;
    console.log('[Push] Service Worker is active.');

    // Ask for notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[Push] Notification permission denied.');
      return;
    }

    // Check if already subscribed — reuse existing subscription if valid
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      console.log('[Push] New push subscription created.');
    } else {
      console.log('[Push] Reusing existing push subscription.');
    }

    // Send subscription to backend
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    const res = await fetch(`${apiUrl}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ subscription, type: 'user' })
    });

    if (res.ok) {
      console.log('[Push] Successfully registered with server.');
    } else {
      console.warn('[Push] Server registration failed:', res.status);
    }
  } catch (err) {
    console.error('[Push] Subscription failed:', err);
  }
}
