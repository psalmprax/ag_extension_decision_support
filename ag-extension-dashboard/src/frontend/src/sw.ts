import { precacheAndRoute } from 'workbox-precaching';

// Minimal ServiceWorker shape used in this file. The project tsconfig does not
// include the 'webworker' lib so we cannot rely on PushEvent/NotificationEvent
// or the WebWorker-scoped WindowClient type.
interface ServiceWorkerSelf {
  addEventListener(type: string, listener: (event: unknown) => void): void;
  registration: { showNotification(title: string, options?: NotificationOptions): Promise<void> };
  clients: { openWindow(url: string): Promise<unknown> };
}

// @ts-expect-error - __WB_MANIFEST is injected by workbox
precacheAndRoute(self.__WB_MANIFEST);

const sw = self as unknown as ServiceWorkerSelf;

sw.addEventListener('push', event => {
  const pushEvent = event as Event & {
    data?: { json(): { body: string; title: string; url?: string } };
    waitUntil(promise: Promise<unknown>): void;
  };
  if (pushEvent.data) {
    const payload = pushEvent.data.json();
    const options: NotificationOptions = {
      body: payload.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: { url: payload.url || '/' },
    };
    pushEvent.waitUntil(sw.registration.showNotification(payload.title, options));
  }
});

sw.addEventListener('notificationclick', event => {
  const clickEvent = event as Event & {
    notification: { close(): void; data: { url: string } };
    waitUntil(promise: Promise<unknown>): void;
  };
  clickEvent.notification.close();
  clickEvent.waitUntil(sw.clients.openWindow(clickEvent.notification.data.url));
});
