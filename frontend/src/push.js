export async function subscribeToPush(token) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered');

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const VAPID_PUBLIC_KEY = "BL4sny3aXOdDC9VkYlEdgGbdKctD7F4SKAY5aQEm87TMO7rkwJCPRSMeTZhzq-BfGuqsmCU1kpDxloFT07M1jZA";

    const urlB64ToUint8Array = (base64String) => {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
    };

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    await fetch(`${apiUrl}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        subscription,
        type: 'user'
      })
    });
    console.log("Subscribed to push notifications");
  } catch (err) {
    console.error('Push subscription failed:', err);
  }
}
