import { Queue } from 'bullmq';
import { redisConnection } from './connection';
import { config } from '@/config';

export interface ScheduledSmsJobData {
    scheduledSmsId: string;
    to: string;
    message: string;
    senderId: string | null;
    farmerId: string | null;
    provider: string;
}

export const scheduledSmsQueue = config.nodeEnv !== 'test'
    ? new Queue<ScheduledSmsJobData>('scheduled-sms-queue', {
        connection: redisConnection,
        defaultJobOptions: {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
            removeOnComplete: true,
            removeOnFail: false,
        },
    })
    : (null as unknown as Queue<ScheduledSmsJobData>);

export const addScheduledSmsJob = async (data: ScheduledSmsJobData, delayMs: number) => {
    return await scheduledSmsQueue!.add('send-scheduled-sms', data, { delay: Math.max(0, delayMs) });
};
