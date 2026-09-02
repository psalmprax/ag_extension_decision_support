import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queues/connection';
import { EmailJobData } from '../queues/emailQueue';
import { emailService } from '../services/emailService';
import { logger } from '../utils/logger';
import { config } from '../config';

let _emailWorker: Worker<EmailJobData> | null = null;

function getEmailWorker(): Worker<EmailJobData> | null {
    if (config.nodeEnv === 'test') return null;
    if (!_emailWorker) {
        _emailWorker = new Worker<EmailJobData>(
            'email-queue',
            async (job: Job<EmailJobData>) => {
                const { to, subject = 'No Subject', text = '', html = '' } = job.data;
                
                logger.info(`Processing email job ${job.id} to ${to}`);
                
                try {
                    await emailService.sendDirect({
                        to,
                        subject,
                        text,
                        html,
                        useQueue: false // Ensure it doesn't try to queue itself again
                    });
                    logger.info(`Email job ${job.id} completed successfully`);
                } catch (error) {
                    logger.error(`Email job ${job.id} failed:`, error);
                    throw error; // Rethrow to allow BullMQ to handle retries
                }
            },
            {
                connection: redisConnection,
                concurrency: 5,
            }
        );

        _emailWorker.on('completed', (job) => {
            logger.info(`Worker: Job ${job.id} completed`);
        });

        _emailWorker.on('failed', (job, err) => {
            logger.error(`Worker: Job ${job?.id} failed with error: ${err.message}`);
        });
    }
    return _emailWorker;
}// Export the lazy getter — no Redis connection until first call
export { getEmailWorker };

export function startEmailWorker(): void {
    try {
        getEmailWorker();
        logger.info('Email worker started (email-queue)');
    } catch (err) {
        logger.warn('Email worker not started (redis unavailable in this env):', err instanceof Error ? err.message : err);
    }
}
