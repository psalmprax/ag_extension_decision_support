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
    pendingCalls.clear();
    flushDelayMs = MIRROR_FLUSH_DELAY_MS;
    retryDelayMs = MIRROR_RETRY_DELAY_MS;
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
    try {
        const stored = await browser.storage.local.get('authToken');
        const token = (stored as Record<string, unknown>)?.authToken;
        return typeof token === 'string' && token.length > 0
            ? { Authorization: `Bearer ${token}` }
            : {};
    } catch {
        return {};
    }
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
    if (pendingCalls.size > 0) {
        scheduleFlush(retryDelayMs);
    }
}
