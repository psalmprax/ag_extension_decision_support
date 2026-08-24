import { createClient, RedisClientType } from 'redis';
import { config } from '@/config';
import { logger } from '@/utils/logger';

let redisClient: RedisClientType | null = null;

export async function initializeCache(): Promise<void> {
    try {
        redisClient = createClient({
            url: config.redis.url,
            socket: {
                connectTimeout: 2000,
                reconnectStrategy: (retries) => {
                    if (retries > 3) {
                        return new Error('Retry limit reached');
                    }
                    return 500;
                }
            }
        });

        redisClient.on('error', (err) => logger.error('Redis error:', err));
        redisClient.on('connect', () => logger.info('Redis connected'));

        await redisClient.connect();
    } catch (error) {
        logger.warn('Failed to initialize Redis cache, continuing without cache');
        redisClient = null;
    }
}

export function getCache(): RedisClientType | null {
    return redisClient;
}

export async function cacheGet(key: string): Promise<string | null> {
    if (!redisClient) return null;
    try {
        return await redisClient.get(key);
    } catch (error) {
        logger.error('Cache get error:', error);
        return null;
    }
}

export async function cacheSet(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!redisClient) return false;
    try {
        if (ttlSeconds) {
            await redisClient.setEx(key, ttlSeconds, value);
        } else {
            await redisClient.set(key, value);
        }
        return true;
    } catch (error) {
        logger.error('Cache set error:', error);
        return false;
    }
}

export async function cacheDelete(key: string): Promise<boolean> {
    if (!redisClient) return false;
    try {
        await redisClient.del(key);
        return true;
    } catch (error) {
        logger.error('Cache delete error:', error);
        return false;
    }
}

export async function cacheHSet(key: string, field: string, value: string): Promise<boolean> {
    if (!redisClient) return false;
    try {
        await redisClient.hSet(key, field, value);
        return true;
    } catch (error) {
        logger.error('Cache hSet error:', error);
        return false;
    }
}

export async function cacheHGetAll(key: string): Promise<Record<string, string> | null> {
    if (!redisClient) return null;
    try {
        return await redisClient.hGetAll(key);
    } catch (error) {
        logger.error('Cache hGetAll error:', error);
        return null;
    }
}

export async function cacheHDel(key: string, ...fields: string[]): Promise<boolean> {
    if (!redisClient || fields.length === 0) return false;
    try {
        await redisClient.hDel(key, fields);
        return true;
    } catch (error) {
        logger.error('Cache hDel error:', error);
        return false;
    }
}

export async function cacheExpire(key: string, seconds: number): Promise<boolean> {
    if (!redisClient) return false;
    try {
        await redisClient.expire(key, seconds);
        return true;
    } catch (error) {
        logger.error('Cache expire error:', error);
        return false;
    }
}

export async function closeCache(): Promise<void> {
    if (redisClient) {
        await redisClient.quit();
        redisClient = null;
        logger.info('Redis connection closed');
    }
}
