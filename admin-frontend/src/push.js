const VAPID_PUBLIC_KEY = "BL4sny3aXOdDC9VkYlEdgGbdKctD7F4SKAY5aQEm87TMO7rkwJCPRSMeTZhzq-BfGuqsmCU1kpDxloFT07M1jZA";

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
}

export async function subscribeToPush(adminSecret, baseUrl) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Admin Push] Not supported in this browser.');
    return;
  }

  try {
    // Register SW — updateViaCache:'none' ensures latest sw.js is always used
    const registration = await navigator.serviceWorker.register('/sw.js', {
      updateViaCache: 'none'
    });

    // Wait until SW is fully active
    await navigator.serviceWorker.ready;
    console.log('[Admin Push] Service Worker is active.');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[Admin Push] Notification permission denied.');
      return;
    }

    // Reuse existing subscription if still valid
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      console.log('[Admin Push] New push subscription created.');
    } else {
      console.log('[Admin Push] Reusing existing push subscription.');
    }

    const res = await fetch(`${baseUrl}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, type: 'admin', adminSecret })
    });

    if (res.ok) {
      console.log('[Admin Push] Successfully registered with server.');
    } else {
      console.warn('[Admin Push] Server registration failed:', res.status);
    }
  } catch (err) {
    console.error('[Admin Push] Subscription failed:', err);
  }
}
