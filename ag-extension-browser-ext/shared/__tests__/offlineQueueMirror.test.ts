import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
    mirrorUpsert,
    mirrorRetry,
    mirrorDelete,
    flushMirrorQueue,
    setMirrorOptionsForTests,
    getMirrorOutbox,
    resetMirrorForTests,
} from '../offlineQueueMirror';
import type { QueuedRequest } from '../offlineTypes';

const makeItem = (overrides: Partial<QueuedRequest> = {}): QueuedRequest => ({
    id: 'req-1',
    idempotencyKey: 'req-1',
    url: 'https://api.example.test/visits',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    timestamp: 1234,
    retries: 0,
    maxRetries: 3,
    state: 'pending',
    ...overrides,
});

const fetchCalls = (): Array<{ url: string; init: RequestInit }> =>
    (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls
        .map(([url, init]) => ({ url: url as string, init: init as RequestInit }));

describe('offlineQueueMirror', () => {
    beforeEach(() => {
        fakeBrowser.reset();
        resetMirrorForTests();
        // Instant flush scheduling in tests.
        setMirrorOptionsForTests({ flushDelayMs: 0, retryDelayMs: 0 });
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        resetMirrorForTests();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    const setAuthToken = async (token: string | null) => {
        if (token === null) {
            await browser.storage.local.remove('authToken');
        } else {
            await browser.storage.local.set({ authToken: token });
        }
    };

    it('delivers an upsert to /offline/queue with sanitized payload', async () => {
        await setAuthToken('token-1');
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('{}', { status: 200 }));

        mirrorUpsert(makeItem({
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer secret' },
            lastError: 'HTTP 500',
        }));
        await flushMirrorQueue();

        const calls = fetchCalls();
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toContain('/offline/queue');
        const payload = JSON.parse(calls[0].init.body as string);
        expect(payload).toMatchObject({ id: 'req-1', state: 'pending', lastError: 'HTTP 500' });
        expect(payload.headers).toEqual({ 'Content-Type': 'application/json' });
        expect(payload.headers.Authorization).toBeUndefined();
        expect(getMirrorOutbox()).toHaveLength(0);
    });

    it('delivers retry and delete to their endpoints', async () => {
        await setAuthToken('token-1');
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('{}', { status: 200 }));

        mirrorRetry('req-2');
        mirrorDelete('req-3');
        await flushMirrorQueue();

        const calls = fetchCalls();
        expect(calls.map(c => c.url)).toEqual([
            expect.stringContaining('/offline/retry'),
            expect.stringContaining('/offline/delete'),
        ]);
        expect(JSON.parse(calls[0].init.body as string)).toEqual({ id: 'req-2' });
        expect(JSON.parse(calls[1].init.body as string)).toEqual({ id: 'req-3' });
    });

    it('holds calls pending while no auth token is available, then delivers after login', async () => {
        await setAuthToken(null);
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('{}', { status: 200 }));

        mirrorUpsert(makeItem());
        await flushMirrorQueue();
        expect(fetchCalls()).toHaveLength(0);
        expect(getMirrorOutbox()).toHaveLength(1);

        await setAuthToken('late-token');
        await flushMirrorQueue();
        expect(fetchCalls()).toHaveLength(1);
        expect(fetchCalls()[0].init.headers).toMatchObject({ Authorization: 'Bearer late-token' });
    });

    it('coalesces repeated upserts of the same item onto the latest payload', async () => {
        await setAuthToken('token-1');
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('{}', { status: 200 }));

        mirrorUpsert(makeItem({ state: 'pending' }));
        mirrorUpsert(makeItem({ state: 'conflict', lastError: 'HTTP 409' }));
        await flushMirrorQueue();

        expect(fetchCalls()).toHaveLength(1);
        const payload = JSON.parse(fetchCalls()[0].init.body as string);
        expect(payload.state).toBe('conflict');
        expect(payload.lastError).toBe('HTTP 409');
    });

    it('retries on 5xx then succeeds on a later flush', async () => {
        await setAuthToken('token-1');
        (globalThis.fetch as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(new Response('boom', { status: 500 }))
            .mockResolvedValue(new Response('{}', { status: 200 }));

        mirrorUpsert(makeItem());
        await flushMirrorQueue();
        expect(fetchCalls()).toHaveLength(1);
        expect(getMirrorOutbox()).toHaveLength(1);
        expect(getMirrorOutbox()[0].attempts).toBe(1);

        await flushMirrorQueue();
        expect(fetchCalls()).toHaveLength(2);
        expect(getMirrorOutbox()).toHaveLength(0);
    });

    it('drops the call on non-retryable client errors', async () => {
        await setAuthToken('token-1');
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('bad', { status: 400 }));

        mirrorUpsert(makeItem());
        await flushMirrorQueue();

        expect(fetchCalls()).toHaveLength(1);
        expect(getMirrorOutbox()).toHaveLength(0);
    });

    it('drops retry/delete calls when the server never saw the item (404)', async () => {
        await setAuthToken('token-1');
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('nf', { status: 404 }));

        mirrorDelete('gone');
        await flushMirrorQueue();
        expect(getMirrorOutbox()).toHaveLength(0);
    });

    it('abandons a call after max attempts', async () => {
        await setAuthToken('token-1');
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('down', { status: 503 }));

        mirrorUpsert(makeItem());
        for (let i = 0; i < 5; i++) {
            await flushMirrorQueue();
        }
        expect(fetchCalls()).toHaveLength(3);
        expect(getMirrorOutbox()).toHaveLength(0);
    });

    it('preserves ordering: a failing upsert blocks the delete behind it until retried', async () => {
        await setAuthToken('token-1');
        (globalThis.fetch as ReturnType<typeof vi.fn>)
            .mockResolvedValueOnce(new Response('down', { status: 500 }))
            .mockResolvedValue(new Response('{}', { status: 200 }));

        mirrorUpsert(makeItem({ id: 'first' }));
        mirrorDelete('second');
        await flushMirrorQueue();

        // Only the upsert attempted; the delete stays queued behind it.
        expect(fetchCalls()).toHaveLength(1);
        expect(getMirrorOutbox()[0]).toMatchObject({ id: 'first', attempts: 1 });
        expect(getMirrorOutbox().map(c => c.id)).toContain('second');

        // The scheduled auto-retry drains the outbox in order.
        await vi.waitFor(() => expect(getMirrorOutbox()).toHaveLength(0));
        const urls = fetchCalls().map(c => c.url);
        expect(urls[0]).toContain('/offline/queue');
        expect(urls.filter(u => u.includes('/offline/queue'))).toHaveLength(2);
        expect(urls[urls.length - 1]).toContain('/offline/delete');
        expect(getMirrorOutbox()).toHaveLength(0);
    });

    it('schedules an automatic flush after enqueue', async () => {
        await setAuthToken('token-1');
        (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response('{}', { status: 200 }));

        mirrorUpsert(makeItem());
        await vi.waitFor(() => {
            expect(fetchCalls()).toHaveLength(1);
        });
        expect(getMirrorOutbox()).toHaveLength(0);
    });
});
