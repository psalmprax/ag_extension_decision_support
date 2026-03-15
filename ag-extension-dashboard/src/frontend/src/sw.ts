import { precacheAndRoute } from 'workbox-precaching';

// @ts-ignore
precacheAndRoute(self.__WB_MANIFEST);

const sw = self as any;

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

sw.addEventListener('notificationclick', (event: any) => {
    event.notification.close();
    event.waitUntil(
        sw.clients.openWindow(event.notification.data.url)
    );
});
