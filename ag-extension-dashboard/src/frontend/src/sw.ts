import { precacheAndRoute } from 'workbox-precaching';

// @ts-expect-error - __WB_MANIFEST is injected by workbox
precacheAndRoute(self.__WB_MANIFEST);

 
const sw = self as unknown as ServiceWorkerGlobalScope;

 
sw.addEventListener('push', (event: PushEvent) => {
    if (event.data) {
        const payload: { body: string; title: string; url?: string } = event.data.json();
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

 
sw.addEventListener('notificationclick', (event: NotificationEvent) => {
    event.notification.close();
    event.waitUntil(
        sw.clients.openWindow(event.notification.data.url)
    );
});
