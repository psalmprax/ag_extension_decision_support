/**
 * Small distributed-state primitives backed by Redis when available, with a
 * process-local fallback so single-node/dev/test deployments keep working.
 *
 * Every horizontally-scaled concern (rate limits, one-time codes, idempotency,
 * revocation caches) should go through these instead of a module-scope Map.
 * The fallback is explicitly *per process*: when Redis is down, multiple
 * replicas will each have their own view — that's logged once so it's visible.
 */
import { getCache } from './cacheService';
import { logger } from '@/utils/logger';

let warnedFallback = false;
function fallbackWarn(what: string): void {
    if (warnedFallback) return;
    warnedFallback = true;
    logger.warn(`[sharedState] Redis unavailable — ${what} is using process-local memory. Multi-replica limits/tokens will not be shared.`);
}

function redis() {
    const c = getCache();
    return c && c.isOpen ? c : null;
}

// ─── Fixed-window counter (rate limits, attempt counters) ───────────────────

const localCounters = new Map<string, { n: number; resetAt: number }>();

/** Increment `key` within a window; returns the new count and when the window resets. */
export async function incrWindow(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const r = redis();
    if (r) {
        try {
            const count = await r.incr(key);
            if (typeof count !== 'number') throw new Error('non-numeric INCR reply');
            if (count === 1) await r.pExpire(key, windowMs);
            const ttl = await r.pTTL(key);
            return { count, resetAt: Date.now() + (typeof ttl === 'number' && ttl > 0 ? ttl : windowMs) };
        } catch (err) {
            logger.warn('[sharedState] incrWindow redis error, falling back:', err);
        }
    }
    fallbackWarn('rate limiting');
    const now = Date.now();
    const cur = localCounters.get(key);
    if (!cur || cur.resetAt <= now) {
        const entry = { n: 1, resetAt: now + windowMs };
        localCounters.set(key, entry);
        if (localCounters.size > 50_000) for (const [k, v] of localCounters) if (v.resetAt <= now) localCounters.delete(k);
        return { count: 1, resetAt: entry.resetAt };
    }
    cur.n++;
    return { count: cur.n, resetAt: cur.resetAt };
}

export async function resetWindow(key: string): Promise<void> {
    const r = redis();
    if (r) { try { await r.del(key); return; } catch { /* fall through */ } }
    localCounters.delete(key);
}

// ─── TTL key/value (one-time codes, short caches) ───────────────────────────

const localKv = new Map<string, { v: string; exp: number }>();

export async function setWithTtl(key: string, value: string, ttlMs: number): Promise<void> {
    const r = redis();
    if (r) { try { await r.set(key, value, { PX: ttlMs }); return; } catch (err) { logger.warn('[sharedState] set redis error:', err); } }
    fallbackWarn('ttl key/value');
    localKv.set(key, { v: value, exp: Date.now() + ttlMs });
    if (localKv.size > 50_000) { const now = Date.now(); for (const [k, e] of localKv) if (e.exp <= now) localKv.delete(k); }
}

export async function getTtl(key: string): Promise<string | null> {
    const r = redis();
    if (r) {
        try {
            const v = await r.get(key);
            // Treat undefined (mocked/partial clients) exactly like a Redis nil reply.
            return typeof v === 'string' ? v : null;
        } catch (err) { logger.warn('[sharedState] get redis error:', err); }
    }
    const e = localKv.get(key);
    if (!e) return null;
    if (e.exp <= Date.now()) { localKv.delete(key); return null; }
    return e.v;
}

export async function delKey(key: string): Promise<void> {
    const r = redis();
    if (r) { try { await r.del(key); return; } catch { /* fall through */ } }
    localKv.delete(key);
}

/** Atomically read-and-delete (consume a one-time token). */
export async function consumeTtl(key: string): Promise<string | null> {
    const r = redis();
    if (r) {
        try {
            const v = await r.getDel(key);
            return typeof v === 'string' ? v : null;
        } catch (err) { logger.warn('[sharedState] getDel redis error:', err); }
    }
    const v = await getTtl(key);
    if (v !== null) localKv.delete(key);
    return v;
}

/** SET NX — returns true if this caller acquired the key. */
export async function setNx(key: string, value: string, ttlMs: number): Promise<boolean> {
    const r = redis();
    if (r) {
        try {
            const res = await r.set(key, value, { PX: ttlMs, NX: true });
            if (res !== 'OK' && res !== null) throw new Error('unexpected SET NX reply');
            return res === 'OK';
        } catch (err) { logger.warn('[sharedState] setNx redis error:', err); }
    }
    fallbackWarn('locks');
    const e = localKv.get(key);
    if (e && e.exp > Date.now()) return false;
    localKv.set(key, { v: value, exp: Date.now() + ttlMs });
    return true;
}

// ─── Set membership with TTL (revocation lists) ─────────────────────────────

export async function addToSet(setKey: string, member: string, ttlMs: number): Promise<void> {
    // Model as individual keys so each member can expire independently.
    await setWithTtl(`${setKey}:${member}`, '1', ttlMs);
}
export async function inSet(setKey: string, member: string): Promise<boolean> {
    return (await getTtl(`${setKey}:${member}`)) !== null;
}

/** Test hook. */
export function __resetSharedStateForTests(): void {
    localCounters.clear();
    localKv.clear();
    warnedFallback = false;
}
