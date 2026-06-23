import { precacheAndRoute } from 'workbox-precaching';

// @ts-expect-error - __WB_MANIFEST is injected by workbox
precacheAndRoute(self.__WB_MANIFEST);

 
const sw = self as unknown;

 
sw.addEventListener('push', (event: unknown) => {
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

 
sw.addEventListener('notificationclick', (event: unknown) => {
    event.notification.close();
    event.waitUntil(
        sw.clients.openWindow(event.notification.data.url)
    );
});
