import { Worker } from 'bullmq';
import { redisConnection } from '@/queues/connection';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { seasonalAdvisoryService } from '@/services/seasonalAdvisoryService';

const ADVISORY_CYCLE_QUEUE = 'advisory-cycle-queue';
const CRON_EXPRESSION = process.env.ADVISORY_CRON || '0 4 * * *'; // 04:00 server time daily

let _worker: Worker | null = null;

/**
 * Starts the repeatable daily advisory cycle. Enabled by default in non-test
 * environments. Disable with ADVISORY_ENGINE_ENABLED=false.
 * Idempotent: BullMQ upserts the repeatable job by jobId.
 */
export const startAdvisoryScheduler = async (): Promise<void> => {
    if (config.nodeEnv === 'test') return;
    if (process.env.ADVISORY_ENGINE_ENABLED === 'false') {
        logger.info('Advisory engine disabled via ADVISORY_ENGINE_ENABLED=false');
        return;
    }
    if (!redisConnection) return;

    try {
        const { Queue } = await import('bullmq');
        const queue = new Queue(ADVISORY_CYCLE_QUEUE, { connection: redisConnection });
        queue.on('error', (err) => logger.warn('Advisory queue error:', err instanceof Error ? err.message : err));
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
        _worker.on('error', (err) => logger.warn('Advisory worker error:', err instanceof Error ? err.message : err));
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
