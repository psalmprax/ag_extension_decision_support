import { cacheGet, cacheSet, getCache } from '@/services/cacheService';
import { incrWindow } from '@/services/sharedState';
import { logger } from '@/utils/logger';

// ─── Cross-replica Rate Limiter (fixed window per external API domain) ──
//
// The token-bucket parameters (maxTokens, refillRate) are mapped to an
// equivalent fixed window: `maxTokens` requests per `maxTokens / refillRate`
// seconds. Counters live in Redis (sharedState) so N replicas share the same
// upstream quota; in-memory fallback applies when Redis is unavailable.

async function tryAcquireToken(domain: string, maxTokens: number, refillRate: number): Promise<boolean> {
  const windowMs = Math.max(1000, Math.round((maxTokens / Math.max(refillRate, 0.001)) * 1000));
  const { count } = await incrWindow(`ext-api:${domain}`, windowMs);
  return count <= maxTokens;
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
  if (!(await tryAcquireToken(config.domain, config.maxTokens, config.refillRate))) {
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
export function getExternalApiStatus(): Record<string, { maxRequests: number; windowSeconds: number; store: 'redis' | 'process-local' }> {
  const store = getCache()?.isOpen ? 'redis' : 'process-local';
  const status: Record<string, { maxRequests: number; windowSeconds: number; store: 'redis' | 'process-local' }> = {};
  for (const [name, cfg] of Object.entries(API_CONFIGS)) {
    status[name] = {
      maxRequests: cfg.maxTokens,
      windowSeconds: Math.round(cfg.maxTokens / Math.max(cfg.refillRate, 0.001)),
      store,
    };
  }
  return status;
}