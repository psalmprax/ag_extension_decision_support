/* eslint-disable @typescript-eslint/no-explicit-any */
import webpush from 'web-push';
import { getPrisma } from './prismaService';
import { logger } from '../utils/logger';

// Configure Web Push with VAPID keys
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || '';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@ag-extension.com';

if (publicVapidKey && privateVapidKey) {
    webpush.setVapidDetails(vapidEmail, publicVapidKey, privateVapidKey);
} else {
    logger.warn('VAPID keys not configured. Push notifications will not work.');
}

/**
 * Subscribe a user to push notifications
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const subscribeUser = async (userId: string, subscription: any) => {
    const prisma = getPrisma();
    try {
        const { endpoint, keys } = subscription;
        await prisma.pushSubscription.upsert({
            where: { endpoint },
            update: {
                userId,
                p256dh: keys.p256dh,
                auth: keys.auth
            },
            create: {
                userId,
                endpoint,
                p256dh: keys.p256dh,
                auth: keys.auth
            }
        });
        return true;
    } catch (error) {
        logger.error('Error in subscribeUser:', error);
        throw error;
    }
};

/**
 * Unsubscribe a user from push notifications
 */
export const unsubscribeUser = async (endpoint: string) => {
    const prisma = getPrisma();
    try {
        await prisma.pushSubscription.delete({
            where: { endpoint }
        });
        return true;
    } catch (error) {
        logger.error('Error in unsubscribeUser:', error);
        return false;
    }
};

/**
 * Send a push notification to a specific user
 */
export const sendPushNotification = async (userId: string, title: string, body: string, url: string = '/') => {
    const prisma = getPrisma();
    try {
        const subscriptions = await prisma.pushSubscription.findMany({
            where: { userId }
        });

        const notificationPayload = JSON.stringify({
            title,
            body,
            url
        });

        const promises = subscriptions.map(async (sub) => {
            const pushConfig = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            try {
                await webpush.sendNotification(pushConfig, notificationPayload);
            } catch (error) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if ((error as any).statusCode === 410 || (error as any).statusCode === 404) {
                    // Subscription has expired or is no longer valid
                    logger.info(`Unsubscribing invalid endpoint: ${sub.endpoint}`);
                    await unsubscribeUser(sub.endpoint);
                } else {
                    logger.error(`Error sending push notification to endpoint: ${sub.endpoint}`, error);
                }
            }
        });

        await Promise.all(promises);
        return true;
    } catch (error) {
        logger.error('Error in sendPushNotification:', error);
        return false;
    }
};
