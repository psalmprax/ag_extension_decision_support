import { Worker, Job } from 'bullmq';
import { redisConnection } from '../queues/connection';
import { ScheduledSmsJobData } from '../queues/scheduledSmsQueue';
import { query } from '../services/databaseService';
import { smsService } from '../services/smsService';
import { logger } from '../utils/logger';
import { config } from '../config';

let _worker: Worker<ScheduledSmsJobData> | null = null;

async function processScheduledSmsJob(job: Job<ScheduledSmsJobData>): Promise<void> {
    const { scheduledSmsId, to, message, senderId, farmerId } = job.data;
    logger.info(`Processing scheduled SMS job ${job.id} → ${to}`);
    try {
        const success = await smsService.sendSMS({ to, message, senderId: senderId ?? undefined, farmerId: farmerId ?? undefined });
        await query(`UPDATE scheduled_sms SET status = $1, updated_at = NOW() WHERE id = $2`, [success ? 'sent' : 'failed', scheduledSmsId]);
        if (!success) throw new Error('SMS provider reported failure');
        logger.info(`Scheduled SMS job ${job.id} completed`);
    } catch (error) {
        logger.error(`Scheduled SMS job ${job.id} failed:`, error);
        await markScheduledSmsFailed(scheduledSmsId, job.id);
        throw error;
    }
}

async function markScheduledSmsFailed(scheduledSmsId: string, jobId: string | undefined): Promise<void> {
    try {
        await query(`UPDATE scheduled_sms SET status = $1, updated_at = NOW() WHERE id = $2`, ['failed', scheduledSmsId]);
    } catch (updateErr) {
        logger.error(`Scheduled SMS job ${jobId}: failed to mark as failed:`, updateErr);
    }
}

function getScheduledSmsWorker(): Worker<ScheduledSmsJobData> | null {
    if (config.nodeEnv === 'test') return null;
    if (!_worker) {
        _worker = new Worker<ScheduledSmsJobData>(
            'scheduled-sms-queue',
            processScheduledSmsJob,
            { connection: redisConnection, concurrency: 5 }
        );
        _worker.on('completed', j => logger.info(`Scheduled SMS worker: Job ${j.id} completed`));
        _worker.on('failed', (j, err) => logger.error(`Scheduled SMS worker: Job ${j?.id} failed: ${err.message}`));
    }
    return _worker;
}

export function startScheduledSmsWorker(): void {
    try { getScheduledSmsWorker(); logger.info('Scheduled SMS worker started (scheduled-sms-queue)'); }
    catch (err) { logger.warn('Scheduled SMS worker not started:', err instanceof Error ? err.message : err); }
}
