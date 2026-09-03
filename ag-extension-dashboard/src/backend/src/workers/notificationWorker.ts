import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queues/connection';
import { NotificationJobData } from '../queues/notificationQueue';
import { notificationService } from '../services/notificationService';
import { logger } from '../utils/logger';
import { config } from '../config';

let _notificationWorker: Worker<NotificationJobData> | null = null;

function getNotificationWorker(): Worker<NotificationJobData> | null {
    if (config.nodeEnv === 'test') return null;
    if (!_notificationWorker) {
        _notificationWorker = new Worker<NotificationJobData>(
            'notification-queue',
            async (job: Job<NotificationJobData>) => {
                const { userId, type, title, message, channel, metadata, sourceNotificationId } = job.data;

                // Deliveries scheduled more than 24h out are re-queued in 24h hops
                // (see notificationService.schedule) until the target time is reached.
                const scheduledAt = typeof metadata?.scheduledAt === 'string' ? Date.parse(metadata.scheduledAt) : NaN;
                if (Number.isFinite(scheduledAt) && scheduledAt - Date.now() > 60_000) {
                    const remaining = scheduledAt - Date.now();
                    const { addNotificationJob } = await import('../queues/notificationQueue');
                    // Hop counter makes each re-queue a distinct, deterministic job id so the
                    // *current* (completing) job's id is not reused while it still exists.
                    const hop = Number(metadata?.requeueHop ?? 0) + 1;
                    await addNotificationJob(
                        { ...job.data, metadata: { ...metadata, requeueHop: hop, dedupKey: `${job.data.userId}|${job.data.channel}|${job.data.title}|${metadata?.scheduledAt}|hop${hop}` } },
                        { delay: Math.min(remaining, 24 * 60 * 60 * 1000) }
                    );
                    logger.info(`Notification job ${job.id} re-queued; ${Math.round(remaining / 1000)}s until scheduled time`);
                    return;
                }

                logger.info(`Processing notification job ${job.id} for user ${userId} via ${channel}`);

                try {
                    // sendOrThrow propagates failures so BullMQ's attempts/backoff apply.
                    await notificationService.sendOrThrow({
                        userId,
                        type,
                        title,
                        message,
                        channel,
                        metadata: { ...metadata, sourceNotificationId },
                    });
                    logger.info(`Notification job ${job.id} completed successfully`);
                } catch (error) {
                    logger.error(`Notification job ${job.id} failed:`, error);
                    throw error;
                }
            },
            {
                connection: redisConnection,
                concurrency: 10,
            }
        );

        _notificationWorker.on('completed', (job) => {
            logger.info(`Notification worker: Job ${job.id} completed`);
        });

        _notificationWorker.on('failed', (job, err) => {
            logger.error(`Notification worker: Job ${job?.id} failed with error: ${err.message}`);
        });
    }
    return _notificationWorker;
}

export function startNotificationWorker(): void {
    try {
        getNotificationWorker();
        logger.info('Notification worker started (notification-queue)');
    } catch (err) {
        logger.warn('Notification worker not started (redis unavailable in this env):', err instanceof Error ? err.message : err);
    }
}