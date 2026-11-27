/**
 * Counts failed requests and browser errors per hour, so problems that only show in a
 * browser console (a route that answers 400 on every click, photos that 404) reach a
 * person: scripts/failureSummary.ts reads these counts and an hourly GitHub workflow
 * (error-watch.yml) opens an issue from them.
 *
 * Counts live in Redis hashes, one per UTC hour, kept 48 hours. Without Redis they fall
 * back to a small per-process map, so recording never fails a request.
 */
import { getCache } from './cacheService';
import { logger } from '@/utils/logger';

export type FailureKind = 'server' | 'browser';

export interface FailureCount {
  kind: FailureKind;
  method: string;
  route: string;
  status: number;
  count: number;
  /** The most recent detail seen for this failure (error message), if any. */
  sample?: string;
}

const RETENTION_SECONDS = 48 * 60 * 60;
const MAX_LOCAL_HOURS = 48;
const SAMPLE_LENGTH = 240;

/** 401 is a signed-out or expired session, the normal way a session ends; not a fault. */
const IGNORED_STATUSES = new Set([401]);

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]{1,8})?/gi;

/** One route per failure, whatever ids it carried: /farmers/:id, /upload/file/:id. */
export function routePattern(path: string): string {
  return (
    path
      .split('?')[0]
      .replace(/^\/api\/v1(?=\/)/, '/api')
      .replace(UUID, ':id')
      .split('/')
      .map(part => (/^\d+$/.test(part) || /^[0-9a-f]{16,}$/i.test(part) ? ':id' : part))
      .join('/')
      .slice(0, 160) || '/'
  );
}

/** Email addresses and long digit runs (phone numbers) are removed from anything kept. */
export function withoutPersonalData(value: string): string {
  return value.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]').replace(/\+?\d[\d\s-]{7,}\d/g, '[number]');
}

export function hourKey(date = new Date()): string {
  return date.toISOString().slice(0, 13).replace(/[-T]/g, '');
}

const field = (kind: FailureKind, method: string, route: string, status: number) => `${kind}|${method}|${route}|${status}`;

const local = new Map<string, Map<string, { count: number; sample?: string }>>();

function recordLocally(hour: string, key: string, sample?: string): void {
  let bucket = local.get(hour);
  if (!bucket) {
    bucket = new Map();
    local.set(hour, bucket);
    while (local.size > MAX_LOCAL_HOURS) local.delete(local.keys().next().value as string);
  }
  const entry = bucket.get(key) ?? { count: 0 };
  entry.count += 1;
  if (sample) entry.sample = sample;
  bucket.set(key, entry);
}

/** Records one failure. Never throws: monitoring must not break the request it watches. */
export async function recordFailure(kind: FailureKind, method: string, route: string, status: number, sample?: string): Promise<void> {
  if (IGNORED_STATUSES.has(status)) return;
  const hour = hourKey();
  const key = field(kind, method.toUpperCase(), routePattern(route), status);
  const detail = sample ? withoutPersonalData(sample.replace(/\s+/g, ' ').trim()).slice(0, SAMPLE_LENGTH) || undefined : undefined;
  const redis = getCache();
  if (!redis?.isOpen) {
    recordLocally(hour, key, detail);
    return;
  }
  try {
    const counts = `failures:${hour}`;
    const samples = `failures:${hour}:samples`;
    await redis.hIncrBy(counts, key, 1);
    await redis.expire(counts, RETENTION_SECONDS);
    if (detail) {
      await redis.hSet(samples, key, detail);
      await redis.expire(samples, RETENTION_SECONDS);
    }
  } catch (error) {
    logger.warn('[failureMonitor] Redis unavailable, counting locally:', error);
    recordLocally(hour, key, detail);
  }
}

/** Failures over the last `hours` hours (this hour included), most frequent first. */
export async function failureSummary(hours = 1, now = new Date()): Promise<FailureCount[]> {
  const merged = new Map<string, { count: number; sample?: string }>();
  const add = (key: string, count: number, sample?: string) => {
    const entry = merged.get(key) ?? { count: 0 };
    entry.count += count;
    if (sample) entry.sample = sample;
    merged.set(key, entry);
  };
  const redis = getCache();
  for (let i = 0; i < hours; i++) {
    const hour = hourKey(new Date(now.getTime() - i * 3600_000));
    if (redis?.isOpen) {
      const [counts, samples] = await Promise.all([redis.hGetAll(`failures:${hour}`), redis.hGetAll(`failures:${hour}:samples`)]);
      for (const [key, value] of Object.entries(counts)) add(key, Number(value), samples[key]);
    }
    for (const [key, value] of local.get(hour) ?? []) add(key, value.count, value.sample);
  }
  return [...merged.entries()]
    .map(([key, value]) => {
      const [kind, method, route, status] = key.split('|');
      return { kind: kind as FailureKind, method, route, status: Number(status), count: value.count, sample: value.sample };
    })
    .sort((a, b) => b.count - a.count);
}

export function __resetFailureMonitorForTests(): void {
  local.clear();
}
