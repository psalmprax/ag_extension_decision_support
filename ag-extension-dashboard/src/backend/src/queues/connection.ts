import { ConnectionOptions } from 'bullmq';
import { config } from '@/config';

export const redisConnection: ConnectionOptions = {
    url: config.redis.url,
    // Max duration to retry a connection
    maxRetriesPerRequest: null,
};
