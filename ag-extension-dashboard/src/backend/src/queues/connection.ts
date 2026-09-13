import { ConnectionOptions } from 'bullmq';
import { config } from '@/config';

// Dedicated connection for ALL BullMQ queues and workers.
//
// Why a separate Redis: the general Redis (REDIS_URL) is shared with the cache
// layer and typically runs `allkeys-lru`. Under memory pressure LRU silently
// evicts BullMQ keys — pending jobs disappear with no error. Queue data must
// never be evictable: point QUEUE_REDIS_URL at an instance running
// `--maxmemory-policy noeviction` (see docker-compose redis-queue service).
// Falls back to REDIS_URL for single-Redis dev setups.
export const redisConnection: ConnectionOptions = {
    url: config.redis.queueUrl,
    // Max duration to retry a command while the connection is down
    maxRetriesPerRequest: null,
};
