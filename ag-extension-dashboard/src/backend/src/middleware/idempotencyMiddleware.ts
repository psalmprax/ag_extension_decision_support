import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '@/utils/logger';
import { getTtl, setWithTtl, setNx, delKey, __resetSharedStateForTests } from '@/services/sharedState';

interface CachedResponse {
  statusCode: number;
  body: unknown;
  cachedAt: number;
}

// Idempotency records live in sharedState (Redis, with process-local fallback) so a
// retried mobile submission that lands on a different replica is still recognised.
// Keys are scoped to the caller (user id, or client IP for anonymous requests) +
// method + path so a key can never replay another principal's response.
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const INFLIGHT_TTL_MS = 60 * 1000; // a single request should not take longer than this

function scopedKey(req: Request, rawKey: string): string {
  const principal = req.user?.userId ? `u:${req.user.userId}` : `ip:${req.ip || 'unknown'}`;
  const material = `${principal}|${req.method}|${req.baseUrl || ''}${req.path}|${rawKey}`;
  return crypto.createHash('sha256').update(material).digest('hex');
}

/**
 * Idempotency Middleware for High-Reliability Mobile Submissions
 * Prevents double-creation of visits, charges, or SMS alerts during spotty 2G mobile retransmissions.
 */
export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Only apply to state-mutating requests
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    return next();
  }

  const rawKey = (req.headers['x-idempotency-key'] || req.headers['idempotency-key']) as string | undefined;

  if (!rawKey || rawKey.length > 256) {
    return next();
  }

  const key = scopedKey(req, rawKey);
  const cacheKey = `idem:${key}`;
  const inflightKey = `idem:inflight:${key}`;

  // Return cached result if key was already processed within TTL
  const cachedRaw = await getTtl(cacheKey);
  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw) as CachedResponse;
      logger.info(`Idempotency hit: Replaying cached response for key ${rawKey.slice(0, 12)}…`);
      res.setHeader('X-Cache-Lookup', 'HIT-IDEMPOTENT');
      res.status(cached.statusCode).json(cached.body);
      return;
    } catch {
      await delKey(cacheKey);
    }
  }

  // Concurrent duplicate while the first is still processing → 409 rather than
  // executing the side effect twice.
  const acquired = await setNx(inflightKey, '1', INFLIGHT_TTL_MS);
  if (!acquired) {
    res.status(409).json({ success: false, error: 'Duplicate request in progress', errorCode: 'IDEMPOTENT_IN_FLIGHT' });
    return;
  }

  // Intercept the json response to cache the result
  const originalJson = res.json.bind(res);
  res.json = (body: unknown): Response => {
    void delKey(inflightKey);
    // Only cache successful status codes (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const record: CachedResponse = { statusCode: res.statusCode, body, cachedAt: Date.now() };
      void setWithTtl(cacheKey, JSON.stringify(record), IDEMPOTENCY_TTL_MS);
    }
    return originalJson(body);
  };
  if (typeof res.on === 'function') res.on('close', () => { void delKey(inflightKey); });

  next();
}

export function clearIdempotencyStore(): void {
  __resetSharedStateForTests();
}
