import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

const VAPID_PUBLIC_KEY = "BIuW0xcAAAN5e2bk9EoNmQBh_7bRKwjC7AI2lPimt7lkOdbNBe1MfwqL_ku10h3LmsFO9xzod9O5an7m5dTwyZ4";

function urlB64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
}

      // 1. Check current permission
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') return;

      // 2. Remove old listeners, then add fresh ones BEFORE register()
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
        console.error(`[Push] FCM Error:`, error);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        // notification logic here (currently relies on OS)
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push] Notification tapped:', action);
      });

      // 3. Register — triggers 'registration' or 'registrationError'
      await PushNotifications.register();

    } catch (err) {
      console.error(`[Push] Fatal error:`, err.message);
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
