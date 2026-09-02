import { cacheGet, cacheSet } from '@/services/cacheService';
import { logger } from '@/utils/logger';

// ─── In-Process Rate Limiter (token-bucket, per external API domain) ──

interface Bucket {
  tokens: number;
  maxTokens: number;
  refillRate: number; // tokens per second
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

function getBucket(domain: string, maxTokens: number, refillRate: number): Bucket {
  let bucket = buckets.get(domain);
  if (!bucket) {
    bucket = { tokens: maxTokens, maxTokens, refillRate, lastRefill: Date.now() };
    buckets.set(domain, bucket);
  }
  return bucket;
}

function refillBucket(bucket: Bucket): void {
  const now = Date.now();
  const elapsed = (now - bucket.lastRefill) / 1000;
  const refill = Math.floor(elapsed * bucket.refillRate);
  if (refill > 0) {
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + refill);
    bucket.lastRefill = now;
  }
}

function tryAcquireToken(domain: string, maxTokens: number, refillRate: number): boolean {
  const bucket = getBucket(domain, maxTokens, refillRate);
  refillBucket(bucket);
  if (bucket.tokens > 0) {
    bucket.tokens--;
    return true;
  }
  return false;
}

// ─── Rate-Limit Config per External API ────────────────────────────────

interface ExternalApiConfig {
  domain: string;
  maxTokens: number;
  refillRate: number;
  cacheTtlSeconds: number;
  cacheKeyPrefix: string;
}

const API_CONFIGS: Record<string, ExternalApiConfig> = {
  faostat: {
    domain: 'fenixservices.fao.org',
    maxTokens: 30,
    refillRate: 0.5,       // 1 token every 2s → 30 req/min
    cacheTtlSeconds: 6 * 3600,    // 6h (daily/monthly data)
    cacheKeyPrefix: 'ext:faostat:',
  },
  nasaPower: {
    domain: 'power.larc.nasa.gov',
    maxTokens: 20,
    refillRate: 0.33,      // ~20 req/min
    cacheTtlSeconds: 6 * 3600,    // 6h (daily data)
    cacheKeyPrefix: 'ext:nasa:',
  },
  usdaPsd: {
    domain: 'apps.fas.usda.gov',
    maxTokens: 30,
    refillRate: 0.5,       // 30 req/min
    cacheTtlSeconds: 24 * 3600,   // 24h (annual data)
    cacheKeyPrefix: 'ext:usda:',
  },
  openMeteo: {
    domain: 'api.open-meteo.com',
    maxTokens: 100,
    refillRate: 2,         // 120 req/min (API limit is 10k/day)
    cacheTtlSeconds: 15 * 60,     // 15m (forecast changes frequently)
    cacheKeyPrefix: 'ext:meteo:',
  },
  openERate: {
    domain: 'open.er-api.com',
    maxTokens: 30,
    refillRate: 0.5,       // 30 req/min
    cacheTtlSeconds: 3600,         // 1h (FX rates update hourly)
    cacheKeyPrefix: 'ext:fx:',
  },
  giews: {
    domain: 'fenixservices.fao.org',
    maxTokens: 30,
    refillRate: 0.5,       // shared with FAOSTAT
    cacheTtlSeconds: 6 * 3600,
    cacheKeyPrefix: 'ext:giews:',
  },
  weatherApi: {
    domain: 'api.weatherapi.com',
    maxTokens: 50,
    refillRate: 1,         // 60 req/min
    cacheTtlSeconds: 15 * 60,     // 15m
    cacheKeyPrefix: 'ext:weatherapi:',
  },
  soilGrids: {
    domain: 'rest.isric.org',
    maxTokens: 30,
    refillRate: 0.5,       // ~30 req/min — SoilGrids is generous but we cache heavily
    cacheTtlSeconds: 12 * 3600,    // 12h (soil baselines are static)
    cacheKeyPrefix: 'ext:soilgrids:',
  },
  soilMoisture: {
    domain: 'api.open-meteo.com',
    maxTokens: 100,
    refillRate: 2,
    cacheTtlSeconds: 30 * 60,     // 30m (soil moisture changes daily)
    cacheKeyPrefix: 'ext:soilmoisture:',
  },
};

// ─── Public API ────────────────────────────────────────────────────────

/**
 * Fetch an external URL with rate limiting + optional Redis caching.
 *
 * - If the request would exceed the rate limit for the target domain,
 *   returns stale cached data (if available), otherwise throws rate-limit error.
 * - On cache hit, returns cached data immediately (no external call).
 * - On cache miss, fetches externally, caches the result, and returns it.
 * - Cache TTL is configured per API in API_CONFIGS.
 */
export async function rateLimitedFetch<T>(
  apiName: keyof typeof API_CONFIGS,
  cacheKey: string,
  fetchFn: () => Promise<T>,
): Promise<T> {
  const config = API_CONFIGS[apiName];

  // 1. Try cache first
  const fullCacheKey = `${config.cacheKeyPrefix}${cacheKey}`;
  try {
    const cached = await cacheGet(fullCacheKey);
    if (cached !== null) {
      logger.debug(`[ext-api] cache hit: ${fullCacheKey}`);
      return JSON.parse(cached) as T;
    }
  } catch {
    // cacheGet error → proceed to live fetch
  }

  // 2. Check rate limit
  if (!tryAcquireToken(config.domain, config.maxTokens, config.refillRate)) {
    // Rate limited — try stale cache one more time
    try {
      const staleCached = await cacheGet(fullCacheKey);
      if (staleCached !== null) {
        logger.warn(`[ext-api] rate-limited (${apiName}), serving stale cache: ${fullCacheKey}`);
        return JSON.parse(staleCached) as T;
      }
    } catch { /* fall through */ }
    logger.warn(`[ext-api] rate-limited (${apiName}), no cache available: ${fullCacheKey}`);
    throw new Error(`External API rate limit exceeded for ${apiName}`);
  }

  // 3. Live fetch
  try {
    const data = await fetchFn();
    // Cache the result (fire-and-forget — don't block on cache failures)
    cacheSet(fullCacheKey, JSON.stringify(data), config.cacheTtlSeconds).catch(() => {});
    return data;
  } catch (err) {
    // 4. On fetch failure, try stale cache as fallback
    try {
      const staleCached = await cacheGet(fullCacheKey);
      if (staleCached !== null) {
        logger.warn(`[ext-api] fetch failed (${apiName}), serving stale cache: ${fullCacheKey}`);
        return JSON.parse(staleCached) as T;
      }
    } catch { /* fall through */ }
    throw err;
  }
}

/**
 * Returns a safe subset of API config for diagnostics / health checks.
 */
export function getExternalApiStatus(): Record<string, { tokens: number; maxTokens: number }> {
  const status: Record<string, { tokens: number; maxTokens: number }> = {};
  for (const bucket of buckets.entries()) {
    refillBucket(bucket[1]);
    status[bucket[0]] = { tokens: bucket[1].tokens, maxTokens: bucket[1].maxTokens };
  }
  return status;
}