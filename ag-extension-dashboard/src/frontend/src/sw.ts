import { precacheAndRoute } from 'workbox-precaching';

// @ts-expect-error - __WB_MANIFEST is injected by workbox
precacheAndRoute(self.__WB_MANIFEST);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sw = self as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
sw.addEventListener('push', (event: any) => {
    if (event.data) {
        const payload = event.data.json();
        const options = {
            body: payload.body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
            data: {
                url: payload.url || '/'
            }
        };

        event.waitUntil(
            sw.registration.showNotification(payload.title, options)
        );
    }
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
sw.addEventListener('notificationclick', (event: any) => {
    event.notification.close();
    event.waitUntil(
        sw.clients.openWindow(event.notification.data.url)
    );
});
