import CONFIG from '../../shared/config';
import type { OfflineAttachment, OfflineStatus, QueuedRequest } from '../../shared/offlineTypes';
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
    | { action: 'get_offline_status' }
    | { action: 'sync_now' }
    | { action: 'open_sidepanel'; tab?: string };

const BACKGROUND_ACTIONS: ReadonlySet<string> = new Set([
    'queue_request',
    'store_offline_attachment',
    'get_queued_requests',
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
    const DB_VERSION = 2;
    const QUEUE_STORE = 'queuedRequests';
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

        // Additional connectivity check to backend
        try {
            await fetch(`${CONFIG.API_BASE_URL}/health`, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-cache'
            });
            return true;
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
        const id = `attachment-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
        const response = await fetch(`${CONFIG.API_BASE_URL}/upload/upload`, { method: 'POST', headers: uploadHeaders, body: formData });
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

    // Queue a request
    const queueRequest = async (request: Omit<QueuedRequest, 'id' | 'idempotencyKey' | 'timestamp' | 'retries' | 'state'> & { idempotencyKey?: string }): Promise<void> => {
        if (!db) await initDB();

        const id = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
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

    // Process a single queued request
    const processSingleRequest = async (request: QueuedRequest): Promise<void> => {
        try {
            const headers = {
                ...request.headers,
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
            } else if (response.status === 409) {
                request.state = 'conflict';
                request.lastError = (await response.text()).slice(0, 500);
                if (db) {
                    const transaction = db.transaction([QUEUE_STORE], 'readwrite');
                    transaction.objectStore(QUEUE_STORE).put(request);
                }
                notifyQueueUpdate();
            } else {
                throw new Error(`HTTP ${response.status}`);
            }
        } catch (error) {
            console.error('Failed to process queued request:', request.id, error);
            request.retries++;
            request.lastError = error instanceof Error ? error.message : 'Sync failed';

            if (request.retries >= request.maxRetries) {
                request.state = 'failed';
            }
            if (db) {
                const transaction = db.transaction([QUEUE_STORE], 'readwrite');
                transaction.objectStore(QUEUE_STORE).put(request);
                notifyQueueUpdate();
            }
        }
    };

    // Process queued requests
    const processQueue = async (): Promise<void> => {
        const requests = await getQueuedRequests();

        for (const request of requests.filter(item => item.state === 'pending')) {
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
                        if (chromeAPI?.sidePanel && typeof sender.tab?.windowId === 'number') {
                            await chromeAPI.sidePanel.open({ windowId: sender.tab.windowId });
                            if (message.tab) {
                                setTimeout(() => {
                                    chromeAPI.runtime.sendMessage({
                                        action: 'switch_sidepanel_tab',
                                        tab: message.tab,
                                    });
                                }, 500);
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