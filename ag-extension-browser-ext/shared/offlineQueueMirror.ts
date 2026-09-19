/**
 * Server-side mirror of the extension's offline request queue.
 *
 * The extension's IndexedDB queue remains the source of truth for replay.
 * This module mirrors every queue state transition (queue, conflict, failure,
 * dead-letter, retry, delete) to the durable backend store
 * (POST /offline/queue, /offline/retry, /offline/delete) so queue state
 * survives extension reinstates and is visible across devices/instances.
 *
 * Delivery is fire-and-forget with bounded retries: mirroring must never
 * throw into the queue paths that keep visits working offline.
 */

import { browser } from 'wxt/browser';
import { CONFIG } from './config';
import { getAuthToken } from './authToken';
import type { QueuedRequest } from './offlineTypes';

const MIRROR_FLUSH_DELAY_MS = 1_000;
const MIRROR_RETRY_DELAY_MS = 5_000;
const MIRROR_MAX_ATTEMPTS = 3;

type MirrorKind = 'upsert' | 'retry' | 'delete';

interface MirrorCall {
    kind: MirrorKind;
    id: string;
    payload: Record<string, unknown>;
    attempts: number;
}

const pendingCalls = new Map<string, MirrorCall>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;
let outboxRehydrated = false;

/**
 * The outbox is persisted to browser.storage.local.
 *
 * MV3 workers are torn down ~30s after their last event, which used to destroy this
 * Map (and its pending setTimeout retries) mid-flight — silently losing mirror calls.
 * Persisting on every mutation and rehydrating on module load means an evicted worker
 * resumes its outbox on the next wake instead of dropping it.
 */
const OUTBOX_STORAGE_KEY = 'offlineQueueMirrorOutbox';

async function persistOutbox(): Promise<void> {
    try {
        await browser.storage.local.set({
            [OUTBOX_STORAGE_KEY]: [...pendingCalls.entries()].map(([key, call]) => ({ key, ...call })),
        });
    } catch (error) {
        console.warn('Offline queue mirror could not persist its outbox:',
            error instanceof Error ? error.message : error);
    }
}

interface PersistedMirrorCall {
    key?: string;
    kind?: MirrorKind;
    id?: string;
    payload?: Record<string, unknown>;
    attempts?: number;
}

async function rehydrateOutbox(): Promise<void> {
    if (outboxRehydrated) return;
    outboxRehydrated = true;
    try {
        const stored = await browser.storage.local.get(OUTBOX_STORAGE_KEY);
        const entries = (stored as Record<string, unknown>)?.[OUTBOX_STORAGE_KEY];
        if (!Array.isArray(entries)) return;
        for (const raw of entries as PersistedMirrorCall[]) {
            if (!raw || typeof raw !== 'object') continue;
            const { key, kind, id, payload, attempts } = raw;
            if (typeof key !== 'string' || typeof id !== 'string') continue;
            if (kind !== 'upsert' && kind !== 'retry' && kind !== 'delete') continue;
            pendingCalls.set(key, {
                kind,
                id,
                payload: payload && typeof payload === 'object' ? payload : {},
                attempts: typeof attempts === 'number' ? attempts : 0,
            });
        }
        if (pendingCalls.size > 0) scheduleFlush(flushDelayMs);
    } catch (error) {
        console.warn('Offline queue mirror could not rehydrate its outbox:',
            error instanceof Error ? error.message : error);
    }
}

let flushDelayMs = MIRROR_FLUSH_DELAY_MS;
let retryDelayMs = MIRROR_RETRY_DELAY_MS;
const maxAttempts = MIRROR_MAX_ATTEMPTS;

/** Test hooks: override delays and inspect/clear the pending outbox. */
export function setMirrorOptionsForTests(options: { flushDelayMs?: number; retryDelayMs?: number }): void {
    if (options.flushDelayMs !== undefined) flushDelayMs = options.flushDelayMs;
    if (options.retryDelayMs !== undefined) retryDelayMs = options.retryDelayMs;
}

export function getMirrorOutbox(): Array<{ kind: MirrorKind; id: string; attempts: number }> {
    return [...pendingCalls.values()].map(({ kind, id, attempts }) => ({ kind, id, attempts }));
}

export function resetMirrorForTests(): void {
    if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
    }
    flushing = false;
    outboxRehydrated = true; // do not re-read storage between tests
    pendingCalls.clear();
    flushDelayMs = MIRROR_FLUSH_DELAY_MS;
    retryDelayMs = MIRROR_RETRY_DELAY_MS;
    void persistOutbox();
}

function scheduleFlush(delayMs: number): void {
    if (flushTimer !== null) return;
    flushTimer = setTimeout(() => {
        flushTimer = null;
        void flushMirrorQueue();
    }, delayMs);
}

function enqueue(kind: MirrorKind, id: string, payload: Record<string, unknown>): void {
    const key = `${kind}:${id}`;
    const existing = pendingCalls.get(key);
    // Coalesce repeated upserts of the same item onto the latest payload,
    // but never reset an in-flight retry budget for other kinds.
    if (existing && kind === 'upsert') {
        pendingCalls.set(key, { ...existing, payload });
    } else if (!existing) {
        pendingCalls.set(key, { kind, id, payload, attempts: 0 });
    }
    void persistOutbox();
    scheduleFlush(flushDelayMs);
}

/**
 * Mirror a queued request (any state) to the durable backend queue.
 * Called whenever the extension adds or updates a queue item.
 */
export function mirrorUpsert(item: QueuedRequest): void {
    enqueue('upsert', item.id, {
        id: item.id,
        idempotencyKey: item.idempotencyKey || item.id,
        url: item.url,
        method: item.method,
        // The backend strips Authorization before persisting; omitting it here
        // avoids writing bearer tokens into request bodies entirely.
        headers: Object.fromEntries(
            Object.entries(item.headers || {}).filter(([key]) => key.toLowerCase() !== 'authorization'),
        ),
        body: item.body,
        attachmentRefs: item.attachmentRefs || [],
        retries: item.retries || 0,
        maxRetries: item.maxRetries || 3,
        state: item.state || 'pending',
        lastError: item.lastError,
    });
}

/** Mirror a retry (dead-letter -> pending). */
export function mirrorRetry(id: string): void {
    enqueue('retry', id, { id });
}

/** Mirror a deletion (replay success or explicit user delete). */
export function mirrorDelete(id: string): void {
    enqueue('delete', id, { id });
}

async function getAuthHeaders(): Promise<Record<string, string>> {
    const token = await getAuthToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Errors worth retrying (network, 5xx, 429). Anything else — validation,
 * not-found, unauthorized with no token — is dropped: mirroring is best-effort.
 */
function isRetryableFailure(status: number | undefined): boolean {
    return status === undefined || status === 429 || status >= 500;
}

async function attemptCall(call: MirrorCall): Promise<void> {
    const authHeaders = await getAuthHeaders();
    if (!authHeaders.Authorization) {
        // Not signed in (or storage unavailable) — keep the call pending;
        // a later flush after login will deliver it.
        throw new Error('mirror skipped: no auth token available');
    }

    const path = call.kind === 'upsert' ? '/offline/queue' : `/offline/${call.kind}`;
    const response = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(call.payload),
    });
    if (response.ok) return;
    if (response.status === 404) {
        // retry/delete for an item the server never saw (upsert raced ahead
        // server-side or state was pruned) — nothing to mirror anymore.
        console.warn(`Offline queue mirror dropped ${call.kind} ${call.id}: not found server-side`);
        return;
    }
    const error = new Error(`mirror ${call.kind} ${call.id} failed: HTTP ${response.status}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
}

/** Exported for tests and for the sidepanel to force a flush on demand. */
export async function flushMirrorQueue(): Promise<void> {
    if (flushing || pendingCalls.size === 0) return;
    flushing = true;
    try {
        // In-order delivery: a delete must never overtake an earlier upsert.
        for (const [key, call] of [...pendingCalls.entries()]) {
            call.attempts += 1;
            try {
                await attemptCall(call);
                pendingCalls.delete(key);
            } catch (error) {
                const status = (error as { status?: number }).status;
                if (call.attempts >= maxAttempts || !isRetryableFailure(status)) {
                    pendingCalls.delete(key);
                    console.warn(`Offline queue mirror abandoned ${call.kind} ${call.id}:`,
                        error instanceof Error ? error.message : error);
                    continue;
                }
                console.warn(`Offline queue mirror retry scheduled for ${call.kind} ${call.id}:`,
                    error instanceof Error ? error.message : error);
                break; // preserve ordering; resume after backoff
            }
        }
    } finally {
        flushing = false;
    }
    void persistOutbox();
    if (pendingCalls.size > 0) {
        scheduleFlush(retryDelayMs);
    }
}

// Resume any outbox that outlived the previous service-worker instance.
void rehydrateOutbox();
