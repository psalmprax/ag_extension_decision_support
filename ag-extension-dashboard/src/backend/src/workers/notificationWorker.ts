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

                logger.info(`Processing notification job ${job.id} for user ${userId} via ${channel}`);

                try {
                    await notificationService.send({
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