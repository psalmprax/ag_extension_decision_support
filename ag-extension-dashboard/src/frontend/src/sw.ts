import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

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

// Runtime caching: map tiles + API (NetworkFirst with Cache fallback)
registerRoute(
  ({ url }) => url.hostname.includes('tile.openstreetmap.org'),
  new CacheFirst({ cacheName: 'map-tiles', plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 8000, maxAgeSeconds: 30 * 24 * 60 * 60 })] })
);
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: 'api-cache', networkTimeoutSeconds: 4, plugins: [new CacheableResponsePlugin({ statuses: [200] }), new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 5 * 60 })] })
);

// Offline navigation fallback — serve cached index
const OFFLINE_URL = '/index.html';

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

sw.addEventListener('fetch', event => {
  const fetchEvent = event as Event & { request: Request; respondWith(r: Promise<Response>): void };
  if (fetchEvent.request.mode === 'navigate') {
    fetchEvent.respondWith(
      fetch(fetchEvent.request).catch(() => caches.match(OFFLINE_URL).then(r => r || Response.error())) as Promise<Response>
    );
  }
});

sw.addEventListener('sync', event => {
  const syncEvent = event as Event & { tag: string; waitUntil(p: Promise<unknown>): void };
  // Background Sync: replay offline queue when network returns (complements window 'online' listener)
  if (syncEvent.tag === 'ag-sync-queue') {
    syncEvent.waitUntil(
      (async () => {
        // Trigger a message to any client to process queue — clients handle actual replay
        const allClients = await (self as unknown as { clients: { matchAll(o: unknown): Promise<Array<{ postMessage(m: unknown): void }>> } }).clients.matchAll({ type: 'window' });
        allClients.forEach(c => c.postMessage({ action: 'background-sync-queue' }));
      })()
    );
  }
});
