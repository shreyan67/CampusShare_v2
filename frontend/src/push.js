import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

const VAPID_PUBLIC_KEY = "BIuW0xcAAAN5e2bk9EoNmQBh_7bRKwjC7AI2lPimt7lkOdbNBe1MfwqL_ku10h3LmsFO9xzod9O5an7m5dTwyZ4";

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
}

export async function subscribeToPush(token) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  // ── NATIVE ANDROID/IOS (Firebase FCM) ────────────────────────────────────
  if (Capacitor.isNativePlatform()) {
    try {
      // 1. Check / request permission
      let permStatus = await PushNotifications.checkPermissions();
      console.log('[Push] Permission status:', permStatus.receive);

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
        console.log('[Push] After request:', permStatus.receive);
      }

      if (permStatus.receive !== 'granted') {
        console.warn('[Push] Native notification permission denied.');
        return;
      }

      // 2. Remove old listeners BEFORE registering, then add fresh ones
      await PushNotifications.removeAllListeners();

      // 3. Attach listeners BEFORE calling register()
      PushNotifications.addListener('registration', async (tokenObj) => {
        const fcmToken = tokenObj.value;
        console.log('[Push] FCM token received:', fcmToken.slice(0, 30) + '...');

        try {
          const resp = await fetch(`${apiUrl}/push/subscribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ subscription: { fcm_token: fcmToken }, type: 'user' })
          });
          const data = await resp.json();
          console.log('[Push] Subscription saved to server:', data);
        } catch (err) {
          console.error('[Push] Failed to save FCM token to server:', err);
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('[Push] FCM Registration Error:', JSON.stringify(error));
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        // App is in foreground — show it as an in-app alert or toast
        console.log('[Push] Foreground notification received:', notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push] Notification tapped:', action);
      });

      // 4. Now register — this triggers the 'registration' event above
      await PushNotifications.register();
      console.log('[Push] PushNotifications.register() called');

    } catch (err) {
      console.error('[Push] Native Push Error:', err);
    }
    return; // Never fall through to Web Push on native
  }

  // ── WEB PWA (VAPID) ────────────────────────────────────────────────────────
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] Service workers or PushManager not supported.');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      updateViaCache: 'none'
    });
    await navigator.serviceWorker.ready;
    console.log('[Push] Service Worker is active.');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[Push] Notification permission denied.');
      return;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      console.log('[Push] New VAPID subscription created.');
    } else {
      console.log('[Push] Reusing existing VAPID subscription.');
    }

    const res = await fetch(`${apiUrl}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ subscription, type: 'user' })
    });

    if (res.ok) {
      console.log('[Push] VAPID subscription saved to server ✓');
    } else {
      console.warn('[Push] Server registration failed:', res.status);
    }
  } catch (err) {
    console.error('[Push] Web Push subscription failed:', err);
  }
}
