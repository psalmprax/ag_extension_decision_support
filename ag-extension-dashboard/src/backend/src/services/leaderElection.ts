/**
 * Leader election via Redis lease (SET NX PX + token-checked renewals).
 *
 * Interval workers that must run exactly once per deployment (alert checks,
 * ingestion crawls, outreach queue dispatch, self-healing, agent loop, the
 * scheduled-SMS polling fallback) register a `runIfLeader` callback here.
 * Exactly one replica holds the lease at a time; if the leader dies, the lease
 * expires and another replica takes over within LEASE_TTL_MS.
 *
 * Semantics:
 *  - No Redis → **fail-closed**: nobody is leader (log once). With
 *    ALLOW_STATELESS_LEADER=true, single-node/dev deployments fall back to
 *    "everyone leads" so local development keeps working.
 *  - Fencing token (the lease value, a random 128-bit hex string) is exposed
 *    via `getToken()` so side-effectful jobs can verify their leadership is
 *    still current before committing irrevocable work.
 *  - Renewal runs on an interval slightly faster than the lease TTL; a renewed
 *    leader keeps the same token, a deposed one stops renewing.
 *  - `stopAll()` releases leases best-effort (fenced DEL) so rolling restarts
 *    hand over leadership immediately instead of waiting out the TTL.
 *
 * This deliberately uses the shared cache Redis (not the BullMQ queue Redis):
 * elections are a coordination concern, not queue traffic.
 */
import { randomBytes } from 'crypto';
import { getCache } from './cacheService';
import { logger } from '@/utils/logger';

export const LEASE_KEY_PREFIX = 'ag:leader:';
export const LEASE_TTL_MS = 30_000;
export const RENEW_INTERVAL_MS = 10_000;

interface Lease {
    key: string;
    token: string;
    timer: NodeJS.Timeout | null;
}

const leases = new Map<string, Lease>();
let statelessWarned = false;

function redisAvailable(): boolean {
    const c = getCache();
    return !!(c && c.isOpen);
}

function statelessModeEnabled(): boolean {
    return process.env.ALLOW_STATELESS_LEADER === 'true';
}

async function tryAcquire(key: string, token: string): Promise<boolean> {
    const c = getCache();
    if (!c) return false;
    // SET key val NX PX ttl — atomic create-if-absent with expiry.
    const acquired = await c.set(key, token, { PX: LEASE_TTL_MS, NX: true });
    if (acquired) return true;
    // Already held — if WE hold it (renewal race after a lost/re-established
    // connection), re-assert the TTL so the lease doesn't lapse mid-flight.
    const current = await c.get(key);
    if (current === token) {
        await c.pExpire(key, LEASE_TTL_MS);
        return true;
    }
    return false;
}

async function renew(key: string, token: string): Promise<boolean> {
    const c = getCache();
    if (!c) return false;
    // WATCH-free check-and-extend: a straight GET-compare + pExpire is safe here
    // because the only writer that may extend is the token holder itself, and a
    // lost race merely means this replica stops renewing (lease lapses).
    const current = await c.get(key);
    if (current !== token) return false;
    await c.pExpire(key, LEASE_TTL_MS);
    return true;
}

/**
 * Try to become (or remain) the leader for `name`. Resolves true when this
 * replica currently holds the lease; the provided callback then runs.
 * Returns false when another replica leads, Redis is unavailable, or the
 * callback chose not to run.
 */
export async function runIfLeader<T>(
    name: string,
    fn: () => Promise<T> | T,
    opts: { force?: boolean } = {}
): Promise<T | null> {
    const key = `${LEASE_KEY_PREFIX}${name}`;

    // Test escape hatch: allow explicit leadership claim in unit tests.
    if (opts.force) {
        return await fn();
    }

    if (!redisAvailable()) {
        return runStatelessFallback(fn);
    }

    const existing = leases.get(name);
    // Reuse our live token (renewal path); a deposed ('' token) or missing
    // lease gets a fresh identity.
    const token = existing?.token || randomBytes(16).toString('hex');
    if (!(await tryAcquire(key, token))) {
        await learnDeposal(name, key, existing);
        return null;
    }

    ensureRenewalTimer(name, key, token, existing);
    return runLeaderTask(name, fn);
}

/** No-Redis path: stateless single-node fallback or fail-closed. */
async function runStatelessFallback<T>(fn: () => Promise<T> | T): Promise<T | null> {
    if (statelessModeEnabled()) {
        warnOnce('[leaderElection] Redis unavailable + ALLOW_STATELESS_LEADER=true — every replica treats itself as leader (single-node/dev only).');
        return await fn();
    }
    warnOnce('[leaderElection] Redis unavailable — singleton workers will NOT run on any replica (fail-closed). Set ALLOW_STATELESS_LEADER=true for single-node dev.');
    return null;
}

function warnOnce(message: string): void {
    if (statelessWarned) return;
    statelessWarned = true;
    logger.warn(message);
}

/**
 * Learn deposal inline instead of waiting for the renewal timer: if the key
 * is now held by someone else, clear our token immediately so
 * isLeader()/getToken() stop reporting stale leadership.
 */
async function learnDeposal(name: string, key: string, existing: Lease | undefined): Promise<void> {
    if (!existing || !existing.token) return;
    const c = getCache();
    const current = c ? await c.get(key).catch(() => null) : null;
    if (current !== existing.token) {
        if (existing.timer) clearInterval(existing.timer);
        existing.token = '';
    }
    logger.debug(`[leaderElection] deposal check for "${name}"`);
}

/** Start the renewal timer for a newly acquired lease (no-op when reusing). */
function ensureRenewalTimer(name: string, key: string, token: string, existing: Lease | undefined): void {
    if (existing && existing.token) return;
    if (existing?.timer) clearInterval(existing.timer);
    const lease: Lease = { key, token, timer: null };
    lease.timer = setInterval(() => {
        void renew(key, lease.token).then(ok => {
            if (!ok) stopRenewing(lease);
        }).catch(err => logger.warn('[leaderElection] renew failed:', err instanceof Error ? err.message : err));
    }, RENEW_INTERVAL_MS);
    lease.timer.unref?.();
    leases.set(name, lease);
    logger.info(`[leaderElection] acquired leadership for "${name}"`);
}

/**
 * Stop renewing after deposal (crashed leader's lease expired and someone
 * else took over, or Redis was flushed). The next runIfLeader call
 * re-attempts acquisition fresh.
 */
function stopRenewing(lease: Lease): void {
    if (lease.timer) clearInterval(lease.timer);
    lease.token = '';
}

/** Run the leader callback; task failure resolves null (never throws). */
async function runLeaderTask<T>(name: string, fn: () => Promise<T> | T): Promise<T | null> {
    try {
        return await fn();
    } catch (err) {
        logger.warn(`[leaderElection] leader task "${name}" failed:`, err instanceof Error ? err.message : err);
        return null;
    }
}

/** True when this replica currently holds the lease for `name`. */
export function isLeader(name: string): boolean {
    if (!redisAvailable()) return statelessModeEnabled();
    const lease = leases.get(name);
    return !!(lease && lease.token);
}

/** Current fencing token for `name`, or null when not leading. */
export function getToken(name: string): string | null {
    const lease = leases.get(name);
    return lease && lease.token ? lease.token : null;
}

/** Release a single lease (best-effort fenced DEL) and stop its renewal timer. */
export async function release(name: string): Promise<void> {
    const lease = leases.get(name);
    if (!lease) return;
    if (lease.timer) clearInterval(lease.timer);
    leases.delete(name);
    const c = getCache();
    if (!c || !lease.token) return;
    try {
        // Fenced delete: only removes the key if we still hold it.
        const current = await c.get(lease.key);
        if (current === lease.token) await c.del(lease.key);
    } catch (err) {
        logger.warn('[leaderElection] release failed:', err instanceof Error ? err.message : err);
    }
}

/** Release every lease held by this replica — called during graceful shutdown. */
export async function stopAll(): Promise<void> {
    const names = Array.from(leases.keys());
    await Promise.all(names.map(n => release(n)));
    if (names.length > 0) logger.info(`[leaderElection] released ${names.length} lease(s): ${names.join(', ')}`);
}

/** Test helper: drop all local lease state without touching Redis. */
export function resetForTests(): void {
    for (const lease of leases.values()) {
        if (lease.timer) clearInterval(lease.timer);
    }
    leases.clear();
}
