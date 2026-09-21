import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { purgePrivateApiCache } from './lib/privateApiCache';

// Minimal ServiceWorker shape used in this file. The project tsconfig does not
// include the 'webworker' lib so we cannot rely on PushEvent/NotificationEvent
// or the WebWorker-scoped WindowClient type.
interface ServiceWorkerSelf {
  addEventListener(type: string, listener: (event: unknown) => void): void;
  registration: { showNotification(title: string, options?: NotificationOptions): Promise<void> };
  clients: { openWindow(url: string): Promise<unknown>; claim(): Promise<void> };
  skipWaiting(): Promise<void>;
}

// @ts-expect-error - __WB_MANIFEST is injected by workbox
precacheAndRoute(self.__WB_MANIFEST);

// Cache public assets only. Private responses must never survive an account change.
registerRoute(
  ({ url }: { url: URL }) => /^(?:[a-z]\.)?tile\.openstreetmap\.org$/.test(url.hostname) || url.hostname === 'server.arcgisonline.com',
  new CacheFirst({ cacheName: 'map-tiles', plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 8000, maxAgeSeconds: 30 * 24 * 60 * 60 })] })
);
registerRoute(
  ({ url }: { url: URL }) => url.pathname.startsWith('/api/'),
  new NetworkOnly({ fetchOptions: { cache: 'no-store' } })
);
registerRoute(
  ({ url }: { url: URL }) => url.origin === self.location.origin && /^\/models\/.*\.onnx$/.test(url.pathname),
  new CacheFirst({ cacheName: 'ml-models', plugins: [new CacheableResponsePlugin({ statuses: [200] }), new ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 30 * 24 * 60 * 60 })] })
);
registerRoute(
  ({ url }: { url: URL }) => url.origin === self.location.origin && /^\/models\/ort\/.*\.(?:wasm|mjs)$/.test(url.pathname),
  new CacheFirst({ cacheName: 'ml-runtime', plugins: [new CacheableResponsePlugin({ statuses: [200] }), new ExpirationPlugin({ maxEntries: 6, maxAgeSeconds: 30 * 24 * 60 * 60 })] })
);

// Offline navigation fallback — serve cached index
const OFFLINE_URL = '/index.html';

const sw = self as unknown as ServiceWorkerSelf;

sw.addEventListener('install', event => {
  (event as Event & { waitUntil(p: Promise<unknown>): void }).waitUntil(sw.skipWaiting());
});

sw.addEventListener('activate', event => {
  (event as Event & { waitUntil(p: Promise<unknown>): void }).waitUntil(
    purgePrivateApiCache().then(() => sw.clients.claim())
  );
});

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
