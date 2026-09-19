/**
 * Leader election unit tests.
 *
 * Uses a mocked cacheService to cover the Redis-available path without a live
 * Redis: acquisition (NX), renewal by the holder, deposal (lease lost → token
 * cleared → re-acquirable), fail-closed when Redis is down, and the explicit
 * ALLOW_STATELESS_LEADER=true dev escape hatch.
 */
process.env.NODE_ENV = 'test';

jest.mock('../services/cacheService', () => ({
    getCache: jest.fn(),
}));

import { runIfLeader, isLeader, getToken, release, resetForTests, LEASE_KEY_PREFIX } from '../services/leaderElection';
import { getCache } from '../services/cacheService';

const mockGetCache = getCache as jest.Mock;

type Store = Map<string, { value: string; expiresAt: number | null }>;

/** Minimal TTL'd SET/NX/GET/PEXPIRE/DEL Redis stand-in. */
function makeFakeRedis() {
    const store: Store = new Map();
    const client = {
        isOpen: true,
        async set(key: string, value: string, opts?: { PX?: number; NX?: boolean }) {
            const now = Date.now();
            if (opts?.NX && (store.has(key) && (store.get(key)!.expiresAt === null || store.get(key)!.expiresAt! > now))) {
                return null;
            }
            store.set(key, { value, expiresAt: opts?.PX ? now + opts.PX : null });
            return 'OK';
        },
        async get(key: string) {
            const e = store.get(key);
            if (!e) return null;
            if (e.expiresAt !== null && e.expiresAt <= Date.now()) {
                store.delete(key);
                return null;
            }
            return e.value;
        },
        async pExpire(key: string, ms: number) {
            const e = store.get(key);
            if (!e) return 0;
            e.expiresAt = Date.now() + ms;
            return 1;
        },
        async del(key: string) {
            return store.delete(key) ? 1 : 0;
        },
    };
    return { client, store };
}

describe('leaderElection', () => {
    beforeEach(() => {
        resetForTests();
        jest.clearAllMocks();
        delete process.env.ALLOW_STATELESS_LEADER;
    });

    afterEach(() => {
        resetForTests();
        delete process.env.ALLOW_STATELESS_LEADER;
    });

    it('acquires the lease via NX and runs the callback when Redis is available', async () => {
        const { client } = makeFakeRedis();
        mockGetCache.mockReturnValue(client);

        let ran = 0;
        const result = await runIfLeader('svc', () => { ran += 1; return 'ok'; });

        expect(result).toBe('ok');
        expect(ran).toBe(1);
        expect(isLeader('svc')).toBe(true);
        expect(getToken('svc')).not.toBeNull();
    });

    it('does not run the callback when another replica holds the lease', async () => {
        const { client, store } = makeFakeRedis();
        mockGetCache.mockReturnValue(client);
        // Simulate a foreign leader pre-holding the lease.
        await client.set(`${LEASE_KEY_PREFIX}svc`, 'foreign-token', { PX: 30_000 });
        expect(store.size).toBe(1);

        let ran = 0;
        const result = await runIfLeader('svc', () => { ran += 1; });

        expect(result).toBeNull();
        expect(ran).toBe(0);
        expect(isLeader('svc')).toBe(false);
    });

    it('renews an existing lease and keeps the same token', async () => {
        const { client } = makeFakeRedis();
        mockGetCache.mockReturnValue(client);

        await runIfLeader('svc', () => null);
        const first = getToken('svc');

        await runIfLeader('svc', () => 'second');
        expect(getToken('svc')).toBe(first);
        expect(isLeader('svc')).toBe(true);
    });

    it('stops running after being deposed (token cleared), and can re-acquire later', async () => {
        const { client, store } = makeFakeRedis();
        mockGetCache.mockReturnValue(client);

        await runIfLeader('svc', () => null);
        const ourToken = getToken('svc')!;
        expect(isLeader('svc')).toBe(true);

        // Leader dies without releasing: the lease expires and another replica
        // takes the key with its own token.
        store.set(`${LEASE_KEY_PREFIX}svc`, { value: 'usurper', expiresAt: Date.now() + 30_000 });

        let ran = 0;
        const result = await runIfLeader('svc', () => { ran += 1; });
        expect(result).toBeNull();
        expect(ran).toBe(0);
        expect(isLeader('svc')).toBe(false); // token cleared
        expect(getToken('svc')).toBeNull();

        // Once the usurper's lease lapses, we can win again.
        store.delete(`${LEASE_KEY_PREFIX}svc`);
        await runIfLeader('svc', () => 'back');
        expect(isLeader('svc')).toBe(true);
        expect(getToken('svc')).not.toBe(ourToken); // fresh identity
    });

    it('is fail-closed when Redis is unavailable (nobody runs)', async () => {
        mockGetCache.mockReturnValue(null);

        let ran = 0;
        const result = await runIfLeader('svc', () => { ran += 1; });

        expect(result).toBeNull();
        expect(ran).toBe(0);
        expect(isLeader('svc')).toBe(false);
    });

    it('ALLOW_STATELESS_LEADER=true lets every replica run without Redis (dev mode)', async () => {
        mockGetCache.mockReturnValue(null);
        process.env.ALLOW_STATELESS_LEADER = 'true';

        let ran = 0;
        const result = await runIfLeader('svc', () => { ran += 1; return 'ran'; });

        expect(result).toBe('ran');
        expect(ran).toBe(1);
        expect(isLeader('svc')).toBe(true); // stateless self-declared leadership
    });

    it('release() clears local state and removes the Redis key', async () => {
        const { client, store } = makeFakeRedis();
        mockGetCache.mockReturnValue(client);

        await runIfLeader('svc', () => null);
        expect(store.has(`${LEASE_KEY_PREFIX}svc`)).toBe(true);

        await release('svc');
        expect(isLeader('svc')).toBe(false);
        expect(store.has(`${LEASE_KEY_PREFIX}svc`)).toBe(false);
    });

    it('propagates callback failures as a null result instead of throwing', async () => {
        const { client } = makeFakeRedis();
        mockGetCache.mockReturnValue(client);

        const result = await runIfLeader('svc', () => { throw new Error('boom'); });
        expect(result).toBeNull();
    });
});
