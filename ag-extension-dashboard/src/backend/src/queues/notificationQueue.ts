import { Queue } from 'bullmq';
import { redisConnection } from './connection';
import { config } from '@/config';

export interface NotificationJobData {
    userId: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    channel: 'in_app' | 'email' | 'sms';
    metadata?: Record<string, unknown>;
    sourceNotificationId?: string;
}

export const notificationQueue = config.nodeEnv !== 'test'
    ? new Queue<NotificationJobData>('notification-queue', {
        connection: redisConnection,
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 1000,
            },
            removeOnComplete: true,
            removeOnFail: false,
        },
    })
    : (null as unknown as Queue<NotificationJobData>);

export const addNotificationJob = async (data: NotificationJobData, options?: { delay?: number }) => {
    return await notificationQueue!.add('send-notification', data, options);
};