import { Request, Response, NextFunction } from 'express';
import { getCache } from '@/services/cacheService';
import { logger } from '@/utils/logger';

const WINDOW_MS = 60 * 60 * 1000; // 60 minutes
const MAX_QUERIES = 10;
const KEY_PREFIX = 'rl:public-demo:';

// In-memory sliding window fallback
const localSlidingWindows = new Map<string, number[]>();

// fallow-ignore-next-line unused-export
export function __resetPublicDemoRateLimitForTests(): void {
  localSlidingWindows.clear();
}

interface SlidingWindowResult {
  allowed: boolean;
  remaining: number;
  resetTimeMs: number;
  retryAfterSeconds: number;
}

async function checkRedisSlidingWindow(
  key: string,
  now: number,
  windowStart: number
): Promise<SlidingWindowResult | null> {
  const redis = getCache();
  if (!redis || !redis.isOpen) return null;

  try {
    await redis.zRemRangeByScore(key, 0, windowStart);
    const count = await redis.zCard(key);

    if (count >= MAX_QUERIES) {
      const oldestEntries = await redis.zRangeWithScores(key, 0, 0);
      const oldestTime = oldestEntries.length > 0 ? oldestEntries[0].score : windowStart;
      const resetTimeMs = oldestTime + WINDOW_MS;
      const retryAfterSeconds = Math.max(1, Math.ceil((resetTimeMs - now) / 1000));
      return { allowed: false, remaining: 0, resetTimeMs, retryAfterSeconds };
    }

    const member = `${now}:${Math.random().toString(36).substring(2, 9)}`;
    await redis.zAdd(key, [{ score: now, value: member }]);
    await redis.pExpire(key, WINDOW_MS);

    return {
      allowed: true,
      remaining: Math.max(0, MAX_QUERIES - count - 1),
      resetTimeMs: now + WINDOW_MS,
      retryAfterSeconds: 0,
    };
  } catch (err) {
    logger.warn('[publicDemoRateLimit] Redis error, falling back to local memory:', err);
    return null;
  }
}

function checkMemorySlidingWindow(
  key: string,
  now: number,
  windowStart: number
): SlidingWindowResult {
  const timestamps = (localSlidingWindows.get(key) || []).filter((t) => t > windowStart);

  if (timestamps.length >= MAX_QUERIES) {
    const oldestTime = timestamps[0] ?? windowStart;
    const resetTimeMs = oldestTime + WINDOW_MS;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetTimeMs - now) / 1000));
    localSlidingWindows.set(key, timestamps);
    return { allowed: false, remaining: 0, resetTimeMs, retryAfterSeconds };
  }

  timestamps.push(now);
  localSlidingWindows.set(key, timestamps);
  return {
    allowed: true,
    remaining: Math.max(0, MAX_QUERIES - timestamps.length),
    resetTimeMs: now + WINDOW_MS,
    retryAfterSeconds: 0,
  };
}

async function checkSlidingWindowRateLimit(ip: string): Promise<SlidingWindowResult> {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const key = `${KEY_PREFIX}${ip}`;

  const redisResult = await checkRedisSlidingWindow(key, now, windowStart);
  if (redisResult !== null) {
    return redisResult;
  }

  return checkMemorySlidingWindow(key, now, windowStart);
}

export async function publicDemoRateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (
    process.env.RATE_LIMIT_DISABLED === 'true' ||
    req.headers['x-bypass-rate-limit'] === 'true'
  ) {
    return next();
  }

  const clientIp = req.ip || req.socket.remoteAddress || '127.0.0.1';
  const result = await checkSlidingWindowRateLimit(clientIp);

  res.setHeader('X-RateLimit-Limit', String(MAX_QUERIES));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(result.resetTimeMs / 1000)));

  if (!result.allowed) {
    res.setHeader('Retry-After', String(result.retryAfterSeconds));
    logger.warn(`Public demo rate limit exceeded for IP: ${clientIp}`);
    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message:
        'Demo rate limit exceeded (10 queries/hour). Please sign up for full access or try again later.',
    });
    return;
  }

  next();
}
