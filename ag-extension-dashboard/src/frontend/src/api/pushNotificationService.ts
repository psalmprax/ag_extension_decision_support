import apiClient from './client';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

async function resolveVapidKey(): Promise<string> {
  let vapidKey = VAPID_PUBLIC_KEY || '';
  try {
    const res = await apiClient.get<{ success: boolean; publicKey: string }>(
      '/v1/notifications/vapid-public-key'
    );
    if (res.data?.success && res.data.publicKey) {
      vapidKey = res.data.publicKey;
    }
  } catch (err) {
    console.warn('Failed to fetch VAPID key from backend, using env fallback:', err);
  }
  return vapidKey;
}

function isPushPermissionDenied(error: unknown): boolean {
  if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.code === 20)) {
    return true;
  }
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: string }).message).toLowerCase().includes('denied');
  }
  return false;
}

export const subscribeUserToPush = async () => {
  try {
    if (typeof window === 'undefined') return null;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    if ('Notification' in window && Notification.permission === 'denied') return null;

    const vapidKey = await resolveVapidKey();
    if (!vapidKey) {
      console.warn('VAPID_PUBLIC_KEY not configured. Push notifications will not work.');
      return null;
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      });
    }

    await apiClient.post('/v1/notifications/subscribe', subscription);
    return subscription;
  } catch (error: unknown) {
    if (isPushPermissionDenied(error)) {
      console.info('[Push] Push notification permission was not granted by the user.');
      return null;
    }

    console.warn('[Push] Could not complete push notification subscription:', error);
    return null;
  }
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  if (!base64String) {
    throw new Error('VAPID public key is empty or undefined');
  }
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
