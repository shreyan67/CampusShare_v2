import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

const VAPID_PUBLIC_KEY = "BIuW0xcAAAN5e2bk9EoNmQBh_7bRKwjC7AI2lPimt7lkOdbNBe1MfwqL_ku10h3LmsFO9xzod9O5an7m5dTwyZ4";

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
}

export async function checkPushPermission() {
  if (Capacitor.isNativePlatform()) {
    const status = await PushNotifications.checkPermissions();
    return status.receive; // 'granted', 'denied', or 'prompt'
  }
  if ('Notification' in window) {
    return Notification.permission; // 'granted', 'denied', or 'default'
  }
  return 'denied';
}

export async function subscribeToPush(token) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  // ── NATIVE ANDROID/IOS (Firebase FCM) ────────────────────────────────────
  if (Capacitor.isNativePlatform()) {
    try {
      // 1. Check current permission
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') return;

      // 2. Attach listeners BEFORE register()
      await PushNotifications.removeAllListeners();

      PushNotifications.addListener('registration', async (tokenObj) => {
        const fcmToken = tokenObj.value;
        try {
          await fetch(`${apiUrl}/push/subscribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ subscription: { fcm_token: fcmToken }, type: 'user' })
          });
        } catch (err) {
          console.error('[Push] Network error saving token:', err.message);
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('[Push] FCM registration error:', error);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        // Foreground notifications handled by the OS notification channel, but we also want in-app toast
        window.dispatchEvent(new CustomEvent('app:push', { detail: `📣 ${notification.title}: ${notification.body}` }));
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push] Notification tapped:', action);
      });

      // 3. Register — triggers 'registration' or 'registrationError'
      await PushNotifications.register();

    } catch (err) {
      console.error('[Push] Fatal error:', err.message);
    }
    return;
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

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    await fetch(`${apiUrl}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ subscription, type: 'user' })
    });
  } catch (err) {
    console.error('[Push] Web Push failed:', err);
  }
}
