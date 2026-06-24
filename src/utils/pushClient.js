import { db } from './dbClient';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export async function pushSubscribe(plat) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications not supported');
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();

    if (existing) {
      const sub = existing.toJSON();
      const { data: existingRow } = await db.select('push_subscriptions', {
        select: 'id',
        eq: { plat: plat.toUpperCase(), endpoint: sub.endpoint },
        maybeSingle: true
      });

      if (existingRow) return true;
      await db.insert('push_subscriptions', {
        plat: plat.toUpperCase(),
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth
      });
      return true;
    }

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    const sub = subscription.toJSON();
    const { error } = await db.insert('push_subscriptions', {
      plat: plat.toUpperCase(),
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth
    });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Push subscribe error:', err.message);
    return false;
  }
}

export async function pushUnsubscribe(plat) {
  if (!('serviceWorker' in navigator)) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const subJson = sub.toJSON();
      await db.delete('push_subscriptions', { eq: { plat: plat.toUpperCase(), endpoint: subJson.endpoint } });
      await sub.unsubscribe();
    }
  } catch (err) {
    console.error('Push unsubscribe error:', err.message);
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(ch => ch.charCodeAt(0)));
}
