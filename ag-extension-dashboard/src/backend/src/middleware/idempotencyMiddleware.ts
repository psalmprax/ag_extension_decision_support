import { Request, Response, NextFunction } from 'express';
import { logger } from '@/utils/logger';

interface CachedResponse {
  statusCode: number;
  body: unknown;
  cachedAt: number;
}

// In-memory / cache store for idempotency keys (TTL: 24h)
const idempotencyStore = new Map<string, CachedResponse>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Idempotency Middleware for High-Reliability Mobile Submissions
 * Prevents double-creation of visits, charges, or SMS alerts during spotty 2G mobile retransmissions.
 */
export function idempotencyMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Only apply to state-mutating requests
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    return next();
  }

  const idempotencyKey = (req.headers['x-idempotency-key'] || req.headers['idempotency-key']) as string;

  if (!idempotencyKey) {
    return next();
  }

  const now = Date.now();
  const cached = idempotencyStore.get(idempotencyKey);

  // Return cached result if key was already processed within TTL
  if (cached && now - cached.cachedAt < IDEMPOTENCY_TTL_MS) {
    logger.info(`Idempotency hit: Replaying cached response for key ${idempotencyKey}`);
    res.setHeader('X-Cache-Lookup', 'HIT-IDEMPOTENT');
    res.status(cached.statusCode).json(cached.body);
    return;
  }

  // Intercept the json response to cache the result
  const originalJson = res.json.bind(res);
  res.json = (body: unknown): Response => {
    // Only cache successful status codes (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyStore.set(idempotencyKey, {
        statusCode: res.statusCode,
        body,
        cachedAt: Date.now(),
      });
    }
    return originalJson(body);
  };

  next();
}

export function clearIdempotencyStore(): void {
  idempotencyStore.clear();
}
