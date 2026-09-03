// API Queue Service for offline synchronization

import { isJwtExpired } from './authToken';
import type { OfflineStatus, QueuedRequest as PersistedQueuedRequest } from './offlineTypes';

export type { OfflineStatus };

export interface QueuedRequestInput {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string | Record<string, unknown>;
    maxRetries?: number;
    idempotencyKey?: string;
    attachmentRefs?: string[];
}

type QueueEvent = 'statusChange';
type QueueListener = (isOnline: boolean) => void;

interface OnlineStatusMessage {
    action: 'online_status_changed';
    isOnline: boolean;
}

const isOnlineStatusMessage = (message: unknown): message is OnlineStatusMessage => {
    if (!message || typeof message !== 'object') return false;
    const candidate = message as Partial<OnlineStatusMessage>;
    return candidate.action === 'online_status_changed' && typeof candidate.isOnline === 'boolean';
};

class APIQueueService {
    private isOnline: boolean = navigator.onLine;

    constructor() {
        // Listen for online/offline events
        globalThis.addEventListener('online', () => {
            this.isOnline = true;
            this.notifyStatusChange(true);
        });

        globalThis.addEventListener('offline', () => {
            this.isOnline = false;
            this.notifyStatusChange(false);
        });

        // Listen for messages from background script
        const browserAPI = browser;
        if (browserAPI?.runtime) {
            browserAPI.runtime.onMessage.addListener((message: unknown) => {
                if (isOnlineStatusMessage(message)) {
                    this.isOnline = message.isOnline;
                    this.emit('statusChange', this.isOnline);
                }
            });
        }
    }

    private listeners: Partial<Record<QueueEvent, QueueListener[]>> = {};

    private emit(event: QueueEvent, data: boolean) {
        this.listeners[event]?.forEach(callback => callback(data));
    }

    public on(event: QueueEvent, callback: QueueListener) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    public off(event: QueueEvent, callback: QueueListener) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }

    private notifyStatusChange(isOnline: boolean) {
        this.emit('statusChange', isOnline);
    }

    private isReplaySafeBody(body: BodyInit | null | undefined): boolean {
        return body === undefined || typeof body === 'string' || (typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob) && !(body instanceof ArrayBuffer));
    }

    private rejectUnqueueableBody(body: BodyInit | null | undefined): void {
        if (!this.isReplaySafeBody(body)) {
            throw new Error('File uploads require an active connection and cannot be queued as a visit mutation');
        }
    }

    public async isCurrentlyOnline(): Promise<boolean> {
        try {
            const browserAPI = browser;
            if (browserAPI?.runtime) {
                const response = await browserAPI.runtime.sendMessage({ action: 'get_offline_status' });
                if (response.success) {
                    this.isOnline = response.status.isOnline;
                    return this.isOnline;
                }
            }
        } catch (error) {
            console.error('Failed to get offline status:', error);
        }
        return this.isOnline;
    }

    public async storeOfflineAttachment(file: File, farmerId: string): Promise<string> {
        const browserAPI = browser;
        if (!browserAPI?.runtime) throw new Error('Browser API not available');
        const response = await browserAPI.runtime.sendMessage({
            action: 'store_offline_attachment',
            attachment: { file, farmerId },
        });
        if (!response.success || !response.id) throw new Error(response.error || 'Unable to store photo offline');
        return response.id as string;
    }

    public async queueRequest(request: QueuedRequestInput): Promise<void> {
        const browserAPI = browser;
        if (!browserAPI?.runtime) {
            throw new Error('Browser API not available');
        }

        const response = await browserAPI.runtime.sendMessage({
            action: 'queue_request',
            request: {
                url: request.url,
                method: request.method,
                headers: request.headers,
                body: request.body,
                maxRetries: request.maxRetries || 3,
                idempotencyKey: request.idempotencyKey,
                attachmentRefs: request.attachmentRefs,
            }
        });

        if (!response.success) {
            throw new Error(response.error || 'Failed to queue request');
        }
    }

    public async makeRequest(url: string, options: RequestInit = {}): Promise<Response> {
        const isOnline = await this.isCurrentlyOnline();
        const method = (options.method || 'GET').toUpperCase();
        const isMutation = !['GET', 'HEAD', 'OPTIONS'].includes(method);
        const idempotencyKey = isMutation
            ? (typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : (typeof crypto !== 'undefined' && crypto.getRandomValues
                    ? `ext_${Date.now()}_${crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(2, 10)}`
                    : `ext_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`))
            : undefined;
        const requestHeaders = new Headers(options.headers);
        if (idempotencyKey) requestHeaders.set('Idempotency-Key', idempotencyKey);
        // Inject JWT if stored by extension login (graceful fallback when not logged in)
        await this.injectAuthToken(requestHeaders);
        const requestOptions: RequestInit = { ...options, method, headers: requestHeaders };

        const attachmentRefs = this.getAttachmentRefs(options.body);

        if (!isOnline) {
            this.rejectUnqueueableBody(options.body);
            // Queue the request
            await this.queueRequest({
                url,
                method,
                headers: Object.fromEntries(requestHeaders.entries()),
                body: options.body as string | Record<string, unknown> | undefined,
                maxRetries: 3,
                idempotencyKey,
                attachmentRefs,
            });

            // Return a mock response for offline state
            return new Response(JSON.stringify({
                success: false,
                message: 'Request queued for offline processing',
                queued: true
            }), {
                status: 202,
                statusText: 'Accepted (Queued)',
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Make the request normally
        try {
            const response = await fetch(url, requestOptions);
            return response;
        } catch (error) {
            // Binary bodies cannot be serialized safely for replay. Keep them
            // visible as failed instead of silently queuing an empty object.
            this.rejectUnqueueableBody(options.body);
            console.warn('Request failed, queuing for later:', error);
            await this.queueRequest({
                url,
                method,
                headers: Object.fromEntries(requestHeaders.entries()),
                body: options.body as string | Record<string, unknown> | undefined,
                maxRetries: 3,
                idempotencyKey,
                attachmentRefs,
            });

            throw error;
        }
    }

    /** Last auth-injection problem, exposed so the UI can show "not signed in / storage error". */
    public lastAuthWarning: string | null = null;

    private async injectAuthToken(headers: Headers): Promise<void> {
        if (headers.has('Authorization')) return;
        try {
            const stored = await browser.storage.local.get('authToken');
            const token = (stored as Record<string, unknown>)?.authToken as string | undefined;
            if (token && isJwtExpired(token)) {
                // Sending a known-expired token only produces 401s; drop it so the popup
                // shows "signed out" and the user re-authenticates.
                this.lastAuthWarning = 'Session expired — sign in again from the extension popup';
                await browser.storage.local.remove('authToken').catch(() => {});
            } else if (token) {
                headers.set('Authorization', `Bearer ${token}`);
                this.lastAuthWarning = null;
            } else {
                this.lastAuthWarning = 'Not signed in — open the extension popup to log in';
            }
        } catch (error) {
            // Do NOT throw: a storage hiccup must not lose an offline-first write.
            // The request proceeds unauthenticated (backend returns 401 → queued item is
            // parked as failed for re-login), and the warning is surfaced to the UI.
            this.lastAuthWarning = 'Could not read auth token from extension storage';
            console.error('Failed to inject auth token (storage error):', error);
        }
    }

    private getAttachmentRefs(body: BodyInit | null | undefined): string[] | undefined {
        if (typeof body !== 'string') return undefined;
        try {
            const parsed = JSON.parse(body) as { attachmentRefs?: unknown };
            return Array.isArray(parsed.attachmentRefs) && parsed.attachmentRefs.every(ref => typeof ref === 'string')
                ? parsed.attachmentRefs
                : undefined;
        } catch {
            return undefined;
        }
    }

    public async getQueuedRequests(): Promise<PersistedQueuedRequest[]> {
        const browserAPI = browser;
        if (!browserAPI?.runtime) {
            return [];
        }

        try {
            const response = await browserAPI.runtime.sendMessage({ action: 'get_queued_requests' });
            return response.success && Array.isArray(response.requests)
                ? response.requests as PersistedQueuedRequest[]
                : [];
        } catch (error) {
            console.error('Failed to get queued requests:', error);
            return [];
        }
    }

    public async syncNow(): Promise<void> {
        const browserAPI = browser;
        if (!browserAPI?.runtime) {
            throw new Error('Browser API not available');
        }

        const response = await browserAPI.runtime.sendMessage({ action: 'sync_now' });
        if (!response.success) {
            throw new Error(response.error || 'Sync failed');
        }
    }
}

// Export singleton instance
export const apiQueue = new APIQueueService();