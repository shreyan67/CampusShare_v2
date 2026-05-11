import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

const VAPID_PUBLIC_KEY = "BIuW0xcAAAN5e2bk9EoNmQBh_7bRKwjC7AI2lPimt7lkOdbNBe1MfwqL_ku10h3LmsFO9xzod9O5an7m5dTwyZ4";

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
}

// Dispatch a visible toast from push.js (read by App.jsx's toast listener)
function pushToast(msg) {
  window.dispatchEvent(new CustomEvent('push:status', { detail: msg }));
}

export async function subscribeToPush(token) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

  // ── NATIVE ANDROID/IOS (Firebase FCM) ────────────────────────────────────
  if (Capacitor.isNativePlatform()) {
    try {
      // 1. Check current permission
      let permStatus = await PushNotifications.checkPermissions();
      pushToast(`[Push] Permission: ${permStatus.receive}`);

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
        pushToast(`[Push] After request: ${permStatus.receive}`);
      }

      if (permStatus.receive !== 'granted') {
        pushToast('[Push] DENIED — go to Settings > Apps > CampusShare > Notifications and enable');
        return;
      }

      // 2. Remove old listeners, then add fresh ones BEFORE register()
      await PushNotifications.removeAllListeners();

      PushNotifications.addListener('registration', async (tokenObj) => {
        const fcmToken = tokenObj.value;
        pushToast('[Push] FCM token obtained! Saving to server...');

        try {
          const resp = await fetch(`${apiUrl}/push/subscribe`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ subscription: { fcm_token: fcmToken }, type: 'user' })
          });
          if (resp.ok) {
            pushToast('[Push] ✅ FCM registered! Notifications are active.');
          } else {
            pushToast(`[Push] ❌ Server rejected FCM token: ${resp.status}`);
          }
        } catch (err) {
          pushToast(`[Push] ❌ Network error saving token: ${err.message}`);
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        pushToast(`[Push] ❌ FCM Error: ${JSON.stringify(error)}`);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        // App is in foreground — show as in-app toast
        pushToast(`📣 ${notification.title}: ${notification.body}`);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push] Notification tapped:', action);
      });

      // 3. Register — triggers 'registration' or 'registrationError'
      await PushNotifications.register();
      pushToast('[Push] register() called — waiting for FCM token...');

    } catch (err) {
      pushToast(`[Push] Fatal error: ${err.message}`);
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
