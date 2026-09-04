import crypto from 'crypto';
import { Queue } from 'bullmq';
import { redisConnection } from './connection';
import { config } from '@/config';

export interface NotificationJobData {
    userId: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    channel: 'in_app' | 'email' | 'sms';
    /** Free-form metadata; `scheduledAt` (ISO) is read by the worker for >24h re-queues. */
    metadata?: Record<string, unknown> & { scheduledAt?: string; dedupKey?: string };
    sourceNotificationId?: string;
}

/**
 * Deterministic job id: same user + channel + title + scheduled time ⇒ same id, so a
 * retried `schedule()` (or a worker re-queue that crashed after `add`) collapses onto
 * one BullMQ job instead of producing duplicates. Callers may pass `metadata.dedupKey`
 * to override.
 */
export function notificationJobId(data: NotificationJobData): string {
    const raw = data.metadata?.dedupKey
        ?? `${data.userId}|${data.channel}|${data.title}|${data.metadata?.scheduledAt ?? 'now'}`;
    return `notif:${crypto.createHash('sha1').update(raw).digest('hex')}`;
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
    // BullMQ ignores a second `add` with an existing jobId (until the job completes/is removed).
    return await notificationQueue!.add('send-notification', data, { ...options, jobId: notificationJobId(data) });
};