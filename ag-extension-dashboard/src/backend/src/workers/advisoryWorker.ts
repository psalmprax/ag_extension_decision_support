import { Worker } from 'bullmq';
import { redisConnection } from '@/queues/connection';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { seasonalAdvisoryService } from '@/services/seasonalAdvisoryService';

export const ADVISORY_CYCLE_QUEUE = 'advisory-cycle-queue';
const CRON_EXPRESSION = process.env.ADVISORY_CRON || '0 4 * * *'; // 04:00 server time daily

let _worker: Worker | null = null;

/**
 * Starts the repeatable daily advisory cycle. Env-gated so it never runs in
 * tests or against disabled deployments. Idempotent: BullMQ upserts the
 * repeatable job by jobId.
 */
export const startAdvisoryScheduler = async (): Promise<void> => {
    if (config.nodeEnv === 'test') return;
    if (process.env.ADVISORY_ENGINE_ENABLED !== 'true') {
        logger.info('Advisory engine disabled (ADVISORY_ENGINE_ENABLED != true)');
        return;
    }
    if (!redisConnection) return;

    try {
        const { Queue } = await import('bullmq');
        const queue = new Queue(ADVISORY_CYCLE_QUEUE, { connection: redisConnection });
        await queue.add(
            'daily-advisory-cycle',
            {},
            { repeat: { pattern: CRON_EXPRESSION }, jobId: 'daily-advisory-cycle' }
        );

        _worker = new Worker(
            ADVISORY_CYCLE_QUEUE,
            async () => {
                const result = await seasonalAdvisoryService.runDailyCycle();
                logger.info(`Advisory cycle complete: ${result.districtsEvaluated} districts, ${result.advisoriesSent} advisories`);
                return result;
            },
            { connection: redisConnection, concurrency: 1 }
        );
        _worker.on('failed', (job, error) => logger.error(`Advisory cycle job failed: ${job?.id}`, error));
        logger.info(`Advisory scheduler started (cron: ${CRON_EXPRESSION})`);
    } catch (error) {
        logger.error('Failed to start advisory scheduler:', error);
    }
};

export const stopAdvisoryScheduler = async (): Promise<void> => {
    if (_worker) {
        await _worker.close();
        _worker = null;
    }
};
