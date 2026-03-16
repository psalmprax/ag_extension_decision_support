import { Queue } from 'bullmq';
import { redisConnection } from './connection';

export interface EmailJobData {
    to: string;
    subject: string;
    text: string;
    html?: string;
    template?: string;
    templateData?: Record<string, unknown>;
}

export const emailQueue = new Queue<EmailJobData>('email-queue', {
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
});

export const addEmailJob = async (data: EmailJobData) => {
    return await emailQueue.add('send-email', data);
};
