import CONFIG, { healthUrl, apiUrl } from '../../shared/config';
import type { OfflineAttachment, OfflineStatus, QueuedRequest } from '../../shared/offlineTypes';
import { mirrorUpsert, mirrorRetry, mirrorDelete, flushMirrorQueue } from '../../shared/offlineQueueMirror';
import type { Browser } from 'wxt/browser';

/** Shape of a request the background queue accepts from the sidepanel/content script. */
interface BackgroundQueueRequest {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string | Record<string, unknown>;
    maxRetries: number;
    idempotencyKey?: string;
    attachmentRefs?: string[];
}

/** Messages the background worker handles. All other actions are rejected. */
type BackgroundRequestMessage =
    | { action: 'queue_request'; request: BackgroundQueueRequest }
    | { action: 'store_offline_attachment'; attachment: { file: Blob; farmerId: string } }
    | { action: 'get_queued_requests' }
    | { action: 'get_dead_letter_requests' }
    | { action: 'retry_dead_letter_request'; id: string }
    | { action: 'delete_dead_letter_request'; id: string }
    | { action: 'retry_queued_request'; id: string }
    | { action: 'delete_queued_request'; id: string }
    | { action: 'get_offline_status' }
    | { action: 'sync_now' }
    | { action: 'open_sidepanel'; tab?: string };

const BACKGROUND_ACTIONS: ReadonlySet<string> = new Set([
    'queue_request',
    'store_offline_attachment',
    'get_queued_requests',
    'get_dead_letter_requests',
    'retry_dead_letter_request',
    'delete_dead_letter_request',
    'retry_queued_request',
    'delete_queued_request',
    'get_offline_status',
    'sync_now',
    'open_sidepanel',
]);

const isBackgroundRequestMessage = (message: unknown): message is BackgroundRequestMessage => {
    if (!message || typeof message !== 'object') return false;
    const action = (message as { action?: unknown }).action;
    return typeof action === 'string' && BACKGROUND_ACTIONS.has(action);
};

const backgroundErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

// Encryption support for IndexedDB storage
// AES-GCM with a random per-install key persisted in browser.storage.local.
// The key never leaves the browser profile and is never hardcoded in source.
let encryptionKey: CryptoKey | null = null;

const ENCRYPTION_STORAGE_KEY = 'offlineAttachmentEncryptionKey';

const bufferToBase64 = (buf: ArrayBuffer): string => {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
};

const base64ToBuffer = (b64: string): ArrayBuffer => {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
};

const importRawAesKey = async (raw: ArrayBuffer): Promise<CryptoKey> =>
    crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);

const getEncryptionKey = async (): Promise<CryptoKey> => {
    if (encryptionKey) return encryptionKey;

    const stored = await browser.storage.local.get(ENCRYPTION_STORAGE_KEY);
    const storedB64 = stored?.[ENCRYPTION_STORAGE_KEY] as string | undefined;
    if (storedB64) {
        encryptionKey = await importRawAesKey(base64ToBuffer(storedB64));
        return encryptionKey;
    }

    encryptionKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt',
    ]);
    const exported = await crypto.subtle.exportKey('raw', encryptionKey);
    await browser.storage.local.set({ [ENCRYPTION_STORAGE_KEY]: bufferToBase64(exported) });
    return encryptionKey;
};

const encryptString = async (str: string): Promise<string> => {
    const key = await getEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(str)
    );
    const ivBuf = new Uint8Array(iv);
    const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
    combined.set(ivBuf, 0);
    combined.set(new Uint8Array(encrypted), ivBuf.byteLength);
    return btoa(String.fromCharCode(...combined));
};

const decryptString = async (encrypted: string): Promise<string> => {
    const combined = new Uint8Array(atob(encrypted).split('').map((c) => c.charCodeAt(0)));
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);
    const key = await getEncryptionKey();
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedData
    );
    return new TextDecoder().decode(decrypted);
};

export default defineBackground(() => {
    console.log('GPExts Background Script Active');

    // IndexedDB setup for offline queue
    const DB_NAME = 'AgExtensionOffline';
    const DB_VERSION = 3;
    const QUEUE_STORE = 'queuedRequests';
    const DEAD_LETTER_STORE = 'deadLetterQueue';
    const STATUS_STORE = 'offlineStatus';
    const ATTACHMENT_STORE = 'offlineAttachments';
    const ATTACHMENT_BUDGET_BYTES = 50 * 1024 * 1024;

    let db: IDBDatabase | null = null;

    // Use global browser/chrome API
    const chromeAPI = browser;

    // Initialize IndexedDB
    const initDB = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(new Error(request.error?.message || 'Database open failed'));
            request.onsuccess = () => {
                db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const dbInstance = (event.target as IDBOpenDBRequest).result;

                // Create queue store
                if (!dbInstance.objectStoreNames.contains(QUEUE_STORE)) {
                    const queueStore = dbInstance.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
                    queueStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Create dead letter store
                if (!dbInstance.objectStoreNames.contains(DEAD_LETTER_STORE)) {
                    const dlqStore = dbInstance.createObjectStore(DEAD_LETTER_STORE, { keyPath: 'id' });
                    dlqStore.createIndex('movedToDeadLetterAt', 'movedToDeadLetterAt', { unique: false });
                    dlqStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Create status store
                if (!dbInstance.objectStoreNames.contains(STATUS_STORE)) {
                    dbInstance.createObjectStore(STATUS_STORE, { keyPath: 'key' });
                }

                if (!dbInstance.objectStoreNames.contains(ATTACHMENT_STORE)) {
                    const attachmentStore = dbInstance.createObjectStore(ATTACHMENT_STORE, { keyPath: 'id' });
                    attachmentStore.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
        });
    };

    // Check online status with connectivity test
    const checkOnlineStatus = async (): Promise<boolean> => {
        // Basic navigator.onLine check
        if (!navigator.onLine) {
            return false;
        }

        // Additional connectivity check to backend (GET: some proxies drop HEAD).
        try {
            const response = await fetch(await healthUrl(), {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache',
                signal: AbortSignal.timeout(8000),
            });
            // 200 healthy / 200 degraded both mean "reachable"; 503 means the API is up
            // but unhealthy — still reachable for queue replay purposes.
            return response.status < 500 || response.status === 503;
        } catch (error) {
            console.warn('Connectivity check failed:', error);
            return false;
        }
    };

    // Get offline status from storage
    const getOfflineStatus = async (): Promise<OfflineStatus> => {
        if (!db) await initDB();

        return new Promise((resolve) => {
            const transaction = db!.transaction([STATUS_STORE], 'readonly');
            const store = transaction.objectStore(STATUS_STORE);
            const request = store.get('offlineStatus');

            request.onsuccess = () => {
                const status = request.result || { isOnline: true, lastChecked: Date.now() };
                resolve(status);
            };

            request.onerror = () => {
                resolve({ isOnline: true, lastChecked: Date.now() });
            };
        });
    };

    // Update offline status
    const updateOfflineStatus = async (isOnline: boolean): Promise<void> => {
        if (!db) await initDB();

        const status: OfflineStatus = {
            isOnline,
            lastChecked: Date.now()
        };

        return new Promise((resolve, reject) => {
            const transaction = db!.transaction([STATUS_STORE], 'readwrite');
            const store = transaction.objectStore(STATUS_STORE);
            const request = store.put({ key: 'offlineStatus', ...status });

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(request.error?.message || 'Update offline status failed'));
        });
    };

    const storeOfflineAttachment = async (input: { file: Blob; farmerId: string }): Promise<string> => {
        if (!db) await initDB();
        const randomPart = typeof crypto !== 'undefined' && crypto.getRandomValues
            ? crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(2, 10)
            : Math.random().toString(36).slice(2, 10);
        const id = `attachment-${Date.now()}-${randomPart}`;
        const encryptedFarmerId = await encryptString(input.farmerId);
        const attachment: OfflineAttachment = { id, file: input.file, farmerId: input.farmerId, sizeBytes: input.file.size, createdAt: Date.now(), encryptedFarmerId };
        await new Promise<void>((resolve, reject) => {
            const transaction = db!.transaction([ATTACHMENT_STORE], 'readwrite');
            const request = transaction.objectStore(ATTACHMENT_STORE).add(attachment);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(request.error?.message || 'Store attachment failed'));
        });

        const attachments = await new Promise<OfflineAttachment[]>((resolve, reject) => {
            const transaction = db!.transaction([ATTACHMENT_STORE], 'readonly');
            const request = transaction.objectStore(ATTACHMENT_STORE).getAll();
            request.onsuccess = () => resolve(request.result as OfflineAttachment[]);
            request.onerror = () => reject(new Error(request.error?.message || 'Read attachments failed'));
        });
        let total = attachments.reduce((sum, item) => sum + item.sizeBytes, 0);
        for (const oldest of attachments.sort((a, b) => a.createdAt - b.createdAt)) {
            if (total <= ATTACHMENT_BUDGET_BYTES) break;
            if (oldest.id === id) continue;
            await new Promise<void>((resolve, reject) => {
                const transaction = db!.transaction([ATTACHMENT_STORE], 'readwrite');
                const request = transaction.objectStore(ATTACHMENT_STORE).delete(oldest.id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error(request.error?.message || 'Evict attachment failed'));
            });
            total -= oldest.sizeBytes;
        }
        if (total > ATTACHMENT_BUDGET_BYTES) {
            await new Promise<void>((resolve, reject) => {
                const transaction = db!.transaction([ATTACHMENT_STORE], 'readwrite');
                const request = transaction.objectStore(ATTACHMENT_STORE).delete(id);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error(request.error?.message || 'Remove oversized attachment failed'));
            });
            throw new Error('Offline attachment storage is full; save the visit without a photo or free local storage');
        }
        return id;
    };

    const getOfflineAttachment = async (id: string): Promise<OfflineAttachment | null> => {
        if (!db) await initDB();
        const row = await new Promise<OfflineAttachment | undefined>((resolve, reject) => {
            const transaction = db!.transaction([ATTACHMENT_STORE], 'readonly');
            const request = transaction.objectStore(ATTACHMENT_STORE).get(id);
            request.onsuccess = () => resolve(request.result as OfflineAttachment | undefined);
            request.onerror = () => reject(new Error(request.error?.message || 'Read attachment failed'));
        });
        if (!row) return null;
        // Decrypt farmerId when an encrypted copy exists; fall back to the stored value on failure.
        const farmerId = row.encryptedFarmerId
            ? await decryptString(row.encryptedFarmerId).catch((error) => {
                  console.warn('Failed to decrypt offline attachment farmerId, using stored value:', error);
                  return row.farmerId;
              })
            : row.farmerId;
        return { ...row, farmerId };
    };

    const removeOfflineAttachment = async (id: string): Promise<void> => {
        if (!db) await initDB();
        await new Promise<void>((resolve, reject) => {
            const transaction = db!.transaction([ATTACHMENT_STORE], 'readwrite');
            const request = transaction.objectStore(ATTACHMENT_STORE).delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(request.error?.message || 'Remove attachment failed'));
        });
    };

    const uploadOfflineAttachment = async (attachment: OfflineAttachment, headers: Record<string, string>): Promise<string> => {
        if (attachment.uploadedId) return attachment.uploadedId;
        const formData = new FormData();
        formData.append('file', attachment.file, `${attachment.id}.jpg`);
        formData.append('farmerId', attachment.farmerId);
        const uploadHeaders = { ...headers };
        delete uploadHeaders['Content-Type'];
        delete uploadHeaders['content-type'];
        const response = await fetch(await apiUrl('/upload/upload'), { method: 'POST', headers: uploadHeaders, body: formData });
        const result = await response.json() as { success?: boolean; data?: { id?: string }; error?: string };
        if (!response.ok || !result.success || !result.data?.id) throw new Error(result.error || `Attachment upload failed (${response.status})`);
        attachment.uploadedId = result.data.id;
        await new Promise<void>((resolve, reject) => {
            const transaction = db!.transaction([ATTACHMENT_STORE], 'readwrite');
            const request = transaction.objectStore(ATTACHMENT_STORE).put(attachment);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(request.error?.message || 'Update attachment failed'));
        });
        return result.data.id;
    };

    // Promise-wrapped put so callers can await durability (MV3 workers can be
    // suspended mid-transaction; an un-awaited put may never commit).
    const idbPut = (storeName: string, value: unknown): Promise<void> => new Promise((resolve, reject) => {
        if (!db) return reject(new Error('IndexedDB not initialised'));
        const tx = db.transaction([storeName], 'readwrite');
        const req = tx.objectStore(storeName).put(value);
        req.onerror = () => reject(new Error(req.error?.message || `put into ${storeName} failed`));
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(new Error(tx.error?.message || `transaction on ${storeName} failed`));
    });

    // Replays must carry the *current* token, not the one captured at queue time
    // (which may have expired while offline).
    const freshAuthHeader = async (): Promise<Record<string, string>> => {
        try {
            const stored = await browser.storage.local.get('authToken');
            const token = (stored as Record<string, unknown>)?.authToken;
            return typeof token === 'string' && token ? { Authorization: `Bearer ${token}` } : {};
        } catch {
            return {};
        }
    };

    // Exponential backoff for automatic retries: 30s, 1m, 2m, ... capped at 30m.
    const backoffMs = (retries: number): number => Math.min(30 * 60 * 1000, 30_000 * 2 ** Math.max(0, retries - 1));

    // Queue a request
    const queueRequest = async (request: Omit<QueuedRequest, 'id' | 'idempotencyKey' | 'timestamp' | 'retries' | 'state'> & { idempotencyKey?: string }): Promise<void> => {
        if (!db) await initDB();

        const randomPart = typeof crypto !== 'undefined' && crypto.getRandomValues
            ? crypto.getRandomValues(new Uint32Array(1))[0].toString(36).substring(2, 11)
            : Math.random().toString(36).substring(2, 11);
        const id = `${Date.now()}-${randomPart}`;
        const queuedRequest: QueuedRequest = {
            ...request,
            id,
            idempotencyKey: request.idempotencyKey || id,
            timestamp: Date.now(),
            retries: 0,
            maxRetries: request.maxRetries || 3,
            state: 'pending',
        };

        return new Promise((resolve, reject) => {
            const transaction = db!.transaction([QUEUE_STORE], 'readwrite');
            const store = transaction.objectStore(QUEUE_STORE);
            const dbRequest = store.add(queuedRequest);

            dbRequest.onsuccess = () => {
                console.log('Request queued:', queuedRequest.id);
                // Notify UI about queue update
                notifyQueueUpdate();
                mirrorUpsert(queuedRequest);
                resolve();
            };
            dbRequest.onerror = () => reject(new Error(dbRequest.error?.message || 'Queue request failed'));
        });
    };

    // Get queued requests
    const getQueuedRequests = async (): Promise<QueuedRequest[]> => {
        if (!db) await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db!.transaction([QUEUE_STORE], 'readonly');
            const store = transaction.objectStore(QUEUE_STORE);
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'next');

            const requests: QueuedRequest[] = [];

            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    const value = cursor.value as Partial<QueuedRequest> & Pick<QueuedRequest, 'id'>;
                    requests.push({
                        ...value,
                        idempotencyKey: value.idempotencyKey || value.id,
                        attachmentRefs: value.attachmentRefs || [],
                        state: value.state || 'pending',
                        retries: value.retries || 0,
                        maxRetries: value.maxRetries || 3,
                    } as QueuedRequest);
                    cursor.continue();
                } else {
                    resolve(requests);
                }
            };

            request.onerror = () => reject(new Error(request.error?.message || 'Get queued requests failed'));
        });
    };

    // Remove request from queue
    const removeQueuedRequest = async (id: string): Promise<void> => {
        if (!db) await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db!.transaction([QUEUE_STORE], 'readwrite');
            const store = transaction.objectStore(QUEUE_STORE);
            const request = store.delete(id);

            request.onsuccess = () => {
                notifyQueueUpdate();
                resolve();
            };
            request.onerror = () => reject(new Error(request.error?.message || 'Remove queued request failed'));
        });
    };

    // Reset a queued request (failed/conflict) back to pending for replay.
    const retryQueuedRequest = async (id: string): Promise<void> => {
        if (!db) await initDB();

        const item = await new Promise<QueuedRequest | undefined>((resolve, reject) => {
            const transaction = db!.transaction([QUEUE_STORE], 'readwrite');
            const request = transaction.objectStore(QUEUE_STORE).get(id);
            request.onsuccess = () => resolve(request.result as QueuedRequest | undefined);
            request.onerror = () => reject(new Error(request.error?.message || 'Get queued request failed'));
        });
        if (!item) throw new Error('Queued request not found');

        item.state = 'pending';
        item.retries = 0;
        item.lastError = undefined;

        await new Promise<void>((resolve, reject) => {
            const transaction = db!.transaction([QUEUE_STORE], 'readwrite');
            const request = transaction.objectStore(QUEUE_STORE).put(item);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(request.error?.message || 'Reset queued request failed'));
        });
        mirrorUpsert(item);
        notifyQueueUpdate();
    };

    // Remove a queued request entirely (user discard).
    const deleteQueuedRequest = async (id: string): Promise<void> => {
        await removeQueuedRequest(id);
        mirrorDelete(id);
    };

    // Get dead letter queue requests
    const getDeadLetterRequests = async (): Promise<QueuedRequest[]> => {
        if (!db) await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db!.transaction([DEAD_LETTER_STORE], 'readonly');
            const store = transaction.objectStore(DEAD_LETTER_STORE);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };
            request.onerror = () => reject(new Error(request.error?.message || 'Get dead letter requests failed'));
        });
    };

    // Retry a dead letter request - move back to pending queue
    const retryDeadLetterRequest = async (id: string): Promise<void> => {
        if (!db) await initDB();

        return new Promise((resolve, reject) => {
            const dlqTransaction = db!.transaction([DEAD_LETTER_STORE], 'readwrite');
            const dlqStore = dlqTransaction.objectStore(DEAD_LETTER_STORE);
            const getRequest = dlqStore.get(id);

            getRequest.onsuccess = () => {
                const deadLetterItem = getRequest.result;
                if (!deadLetterItem) {
                    reject(new Error('Dead letter request not found'));
                    return;
                }

                // Reset state to pending and clear dead letter metadata
                const retryItem: QueuedRequest = {
                    ...deadLetterItem,
                    state: 'pending',
                    retries: 0,
                    lastError: undefined,
                    movedToDeadLetterAt: undefined,
                    originalRetries: undefined,
                };

                // Write to the live queue first; only delete from DLQ once that commits.
                idbPut(QUEUE_STORE, retryItem)
                    .then(() => {
                        mirrorRetry(id);
                        const delTx = db!.transaction([DEAD_LETTER_STORE], 'readwrite');
                        const deleteRequest = delTx.objectStore(DEAD_LETTER_STORE).delete(id);
                        deleteRequest.onerror = () => reject(new Error(deleteRequest.error?.message || 'Delete dead letter request failed'));
                        delTx.oncomplete = () => {
                            notifyQueueUpdate();
                            resolve();
                        };
                    })
                    .catch(reject);
            };
            getRequest.onerror = () => reject(new Error(getRequest.error?.message || 'Get dead letter request failed'));
        });
    };

    // Delete a dead letter request permanently
    const deleteDeadLetterRequest = async (id: string): Promise<void> => {
        if (!db) await initDB();

        return new Promise((resolve, reject) => {
            const transaction = db!.transaction([DEAD_LETTER_STORE], 'readwrite');
            const store = transaction.objectStore(DEAD_LETTER_STORE);
            const request = store.delete(id);

            request.onsuccess = () => {
                notifyQueueUpdate();
                mirrorDelete(id);
                resolve();
            };
            request.onerror = () => reject(new Error(request.error?.message || 'Delete dead letter request failed'));
        });
    };

    // Process a single queued request
    const processSingleRequest = async (request: QueuedRequest): Promise<void> => {
        try {
            const headers = {
                ...request.headers,
                ...(await freshAuthHeader()),
                ...(request.idempotencyKey ? { 'Idempotency-Key': request.idempotencyKey } : {}),
            };
            let requestBody = request.body === undefined
                ? undefined
                : typeof request.body === 'string'
                    ? request.body
                    : JSON.stringify(request.body);
            const uploadedIds: string[] = [];
            for (const ref of request.attachmentRefs || []) {
                const attachment = await getOfflineAttachment(ref);
                if (!attachment) throw new Error(`Offline attachment ${ref} was evicted before sync`);
                uploadedIds.push(await uploadOfflineAttachment(attachment, headers));
            }
            if (uploadedIds.length > 0 && typeof requestBody === 'string') {
                const payload = JSON.parse(requestBody) as Record<string, unknown>;
                payload.attachmentIds = [...(Array.isArray(payload.attachmentIds) ? payload.attachmentIds : []), ...uploadedIds];
                delete payload.attachmentRefs;
                requestBody = JSON.stringify(payload);
            }
            const response = await fetch(request.url, {
                method: request.method,
                headers,
                body: requestBody
            });

            if (response.ok) {
                console.log('Queued request processed successfully:', request.id);
                for (const ref of request.attachmentRefs || []) await removeOfflineAttachment(ref);
                await removeQueuedRequest(request.id);
                mirrorDelete(request.id);
            } else if (response.status === 409) {
                request.state = 'conflict';
                request.lastError = (await response.text()).slice(0, 500);
                await idbPut(QUEUE_STORE, request);
                mirrorUpsert(request);
                notifyQueueUpdate();
            } else if (response.status === 401 || response.status === 403) {
                // Auth problem: retrying without a new login cannot succeed. Park it as
                // failed (not dead-letter) so a re-login + "Sync Now" recovers it.
                request.state = 'failed';
                request.lastError = `HTTP ${response.status} — re-login required`;
                request.nextAttemptAt = undefined;
                await idbPut(QUEUE_STORE, request);
                mirrorUpsert(request);
                notifyQueueUpdate();
            } else if (response.status >= 400 && response.status < 500) {
                // Deterministic client error: replaying the same body will fail the same way.
                request.state = 'dead_letter';
                request.movedToDeadLetterAt = Date.now();
                request.originalRetries = request.maxRetries;
                request.lastError = `HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`;
                await idbPut(DEAD_LETTER_STORE, request);
                await removeQueuedRequest(request.id);
                mirrorUpsert(request); // server mirror learns the dead_letter state
                notifyQueueUpdate();
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to process queued request:', request.id, error);
            request.retries++;
            request.lastError = error instanceof Error ? error.message : 'Sync failed';

            if (request.retries >= request.maxRetries) {
                // Exhausted: move to the dead-letter store. Write DLQ first, then remove from
                // the live queue, so a suspended worker can never lose the item.
                request.state = 'dead_letter';
                request.movedToDeadLetterAt = Date.now();
                request.originalRetries = request.maxRetries;
                await idbPut(DEAD_LETTER_STORE, request);
                await removeQueuedRequest(request.id);
                mirrorUpsert(request);
                notifyQueueUpdate();
            } else {
                // Keep it pending with a backoff so processQueue retries automatically.
                request.state = 'pending';
                request.nextAttemptAt = Date.now() + backoffMs(request.retries);
                await idbPut(QUEUE_STORE, request);
                mirrorUpsert(request);
                notifyQueueUpdate();
            }
        }
    };

    // Process queued requests
    const processQueue = async (): Promise<void> => {
        const requests = await getQueuedRequests();
        const now = Date.now();

        const due = requests
            .filter(item => item.state === 'pending' && (!item.nextAttemptAt || item.nextAttemptAt <= now))
            .sort((a, b) => a.timestamp - b.timestamp);
        for (const request of due) {
            await processSingleRequest(request);
        }
    };

    // Notify UI about queue updates
    const notifyQueueUpdate = () => {
        if (chromeAPI?.runtime?.sendMessage) {
            chromeAPI.runtime.sendMessage({ action: 'queue_updated' });
        }
    };

    // Handle online/offline events
    const handleOnlineStatusChange = async () => {
        const isOnline = await checkOnlineStatus();
        await updateOfflineStatus(isOnline);

        if (isOnline) {
            console.log('Connection restored, processing queue...');
            await processQueue();
            // Retry any mirror calls that failed while offline.
            await flushMirrorQueue();
        } else {
            console.log('Connection lost');
        }

        // Notify all tabs and sidepanel
        if (chromeAPI?.runtime?.sendMessage) {
            chromeAPI.runtime.sendMessage({ action: 'online_status_changed', isOnline });
        }
    };

    // Initialize
    const init = async () => {
        await initDB();

        // Register Context Menus
        chromeAPI.contextMenus.removeAll(() => {
            chromeAPI.contextMenus.create({
                id: 'alfa-root',
                title: 'ALFA Advisor',
                contexts: ['selection', 'page']
            });

            chromeAPI.contextMenus.create({
                id: 'alfa-analyze',
                parentId: 'alfa-root',
                title: 'Analyze Selection',
                contexts: ['selection']
            });

            chromeAPI.contextMenus.create({
                id: 'alfa-summarize',
                parentId: 'alfa-root',
                title: 'Summarize Page',
                contexts: ['page']
            });
        });

        // Initial status check
        await handleOnlineStatusChange();

        // MV3 service workers are terminated when idle; setInterval does not survive.
        // chrome.alarms wakes the worker on schedule instead.
        await chromeAPI.alarms.create('connectivity-check', { periodInMinutes: 1 });
        chromeAPI.alarms.onAlarm.addListener((alarm: { name: string }) => {
            if (alarm.name === 'connectivity-check') {
                void (async () => {
                    const currentStatus = await getOfflineStatus();
                    const isOnline = await checkOnlineStatus();

                    if (currentStatus.isOnline !== isOnline) {
                        await handleOnlineStatusChange();
                    }
                })();
            }
        });
    };

    // Context Menu Click Handler
    chromeAPI.contextMenus.onClicked.addListener((info: Browser.contextMenus.OnClickData, tab?: Browser.tabs.Tab) => {
        if (info.menuItemId === 'alfa-analyze' && info.selectionText && tab?.windowId) {
            chromeAPI.sidePanel.open({ windowId: tab.windowId }).then(() => {
                // Short delay to ensure sidepanel is ready
                setTimeout(() => {
                    chromeAPI.runtime.sendMessage({
                        action: 'analyze_selection',
                        text: info.selectionText
                    });
                }, 500);
            });
        } else if (info.menuItemId === 'alfa-summarize' && tab?.windowId) {
            chromeAPI.sidePanel.open({ windowId: tab.windowId }).then(() => {
                setTimeout(() => {
                    chromeAPI.runtime.sendMessage({
                        action: 'trigger_quick_action',
                        actionType: 'Summarize'
                    });
                }, 500);
            });
        }
    });

    // Commands Handler (Shortcuts)
    chromeAPI.commands.onCommand.addListener((command: string) => {
        chromeAPI.tabs.query({ active: true, currentWindow: true }, (tabs: Browser.tabs.Tab[]) => {
            const [tab] = tabs;
            if (!tab) return;

            if (command === 'open_sidepanel') {
                chromeAPI.sidePanel.open({ windowId: tab.windowId });
            } else if (command === 'capture_photo') {
                chromeAPI.sidePanel.open({ windowId: tab.windowId }).then(() => {
                    setTimeout(() => {
                        chromeAPI.runtime.sendMessage({ action: 'trigger_capture' });
                    }, 500);
                });
            }
        });
    });

    // Message handler for queuing requests
    const handleMessage = (message: unknown, sender: Browser.runtime.MessageSender, sendResponse: (response: unknown) => void) => {
        const run = async () => {
            try {
                if (!isBackgroundRequestMessage(message)) {
                    sendResponse({ success: false, error: 'Unknown message action' });
                    return;
                }

                switch (message.action) {
                    case 'queue_request':
                        await queueRequest(message.request);
                        sendResponse({ success: true });
                        break;
                    case 'store_offline_attachment':
                        {
                            const id = await storeOfflineAttachment(message.attachment);
                            sendResponse({ success: true, id });
                        }
                        break;
                    case 'get_queued_requests':
                        {
                            const requests = await getQueuedRequests();
                            sendResponse({ success: true, requests });
                        }
                        break;
                    case 'get_dead_letter_requests':
                        {
                            const requests = await getDeadLetterRequests();
                            sendResponse({ success: true, requests });
                        }
                        break;
                    case 'retry_dead_letter_request':
                        {
                            await retryDeadLetterRequest(message.id);
                            sendResponse({ success: true });
                        }
                        break;
                    case 'delete_dead_letter_request':
                        {
                            await deleteDeadLetterRequest(message.id);
                            sendResponse({ success: true });
                        }
                        break;
                    case 'retry_queued_request':
                        {
                            await retryQueuedRequest(message.id);
                            sendResponse({ success: true });
                        }
                        break;
                    case 'delete_queued_request':
                        {
                            await deleteQueuedRequest(message.id);
                            sendResponse({ success: true });
                        }
                        break;
                    case 'get_offline_status':
                        {
                            const status = await getOfflineStatus();
                            sendResponse({ success: true, status });
                        }
                        break;
                    case 'sync_now':
                        await processQueue();
                        sendResponse({ success: true });
                        break;
                    case 'open_sidepanel':
                        if (chromeAPI?.sidePanel) {
                            let windowId: number | undefined;
                            if (typeof sender.tab?.windowId === 'number') {
                                windowId = sender.tab.windowId;
                            } else {
                                // Fallback for popup and other contexts without sender.tab
                                try {
                                    const windows = await chromeAPI.windows.getAll({ populate: false, windowTypes: ['normal'] });
                                    const focused = windows.find(w => w.focused);
                                    windowId = focused?.id;
                                } catch {
                                    // Last resort: try to get last focused window
                                    try {
                                        const lastFocused = await chromeAPI.windows.getLastFocused();
                                        windowId = lastFocused?.id;
                                    } catch {
                                        windowId = undefined;
                                    }
                                }
                            }
                            if (typeof windowId === 'number') {
                                await chromeAPI.sidePanel.open({ windowId });
                                if (message.tab) {
                                    setTimeout(() => {
                                        chromeAPI.runtime.sendMessage({
                                            action: 'switch_sidepanel_tab',
                                            tab: message.tab,
                                        });
                                    }, 500);
                                }
                            } else {
                                console.warn('open_sidepanel: could not determine windowId');
                            }
                        }
                        break;
                }
            } catch (error) {
                const action = isBackgroundRequestMessage(message) ? message.action : 'unknown';
                console.error(`Error handling ${action}:`, error);
                sendResponse({ success: false, error: backgroundErrorMessage(error) });
            }
        };
        void run();
        return true;
    };

    if (chromeAPI?.runtime?.onMessage) {
        chromeAPI.runtime.onMessage.addListener(handleMessage);
    }

    init();
});