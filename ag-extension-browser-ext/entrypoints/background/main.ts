import CONFIG from '../../shared/config';

// Types for offline queue
type QueueState = 'pending' | 'failed' | 'conflict';

interface QueuedRequest {
    id: string;
    idempotencyKey: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
    timestamp: number;
    retries: number;
    maxRetries: number;
    state: QueueState;
    lastError?: string;
}

interface OfflineStatus {
    isOnline: boolean;
    lastChecked: number;
}

export default defineBackground(() => {
    console.log('Ag-Extension Background Script Active');

    // IndexedDB setup for offline queue
    const DB_NAME = 'AgExtensionOffline';
    const DB_VERSION = 1;
    const QUEUE_STORE = 'queuedRequests';
    const STATUS_STORE = 'offlineStatus';

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
            const response = await fetch(request.url, {
                method: request.method,
                headers: {
                    ...request.headers,
                    ...(request.idempotencyKey ? { 'Idempotency-Key': request.idempotencyKey } : {}),
                },
                body: request.body === undefined
                    ? undefined
                    : typeof request.body === 'string'
                        ? request.body
                        : JSON.stringify(request.body)
            });

            if (response.ok) {
                console.log('Queued request processed successfully:', request.id);
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

        // Periodic connectivity check
        setInterval(async () => {
            const currentStatus = await getOfflineStatus();
            const isOnline = await checkOnlineStatus();

            if (currentStatus.isOnline !== isOnline) {
                await handleOnlineStatusChange();
            }
        }, 30000); // Check every 30 seconds
    };

    // Context Menu Click Handler
    chromeAPI.contextMenus.onClicked.addListener((info: any, tab: any) => {
        if (info.menuItemId === 'alfa-analyze' && info.selectionText) {
            chromeAPI.sidePanel.open({ windowId: tab.windowId }).then(() => {
                // Short delay to ensure sidepanel is ready
                setTimeout(() => {
                    chromeAPI.runtime.sendMessage({
                        action: 'analyze_selection',
                        text: info.selectionText
                    });
                }, 500);
            });
        } else if (info.menuItemId === 'alfa-summarize') {
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
        chromeAPI.tabs.query({ active: true, currentWindow: true }, ([tab]: any) => {
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
    const handleMessage = (message: any, sender: any, sendResponse: any) => {
        const run = async () => {
            try {
                if (message.action === 'queue_request') {
                    await queueRequest(message.request);
                    sendResponse({ success: true });
                } else if (message.action === 'get_queued_requests') {
                    const requests = await getQueuedRequests();
                    sendResponse({ success: true, requests });
                } else if (message.action === 'get_offline_status') {
                    const status = await getOfflineStatus();
                    sendResponse({ success: true, status });
                } else if (message.action === 'sync_now') {
                    await processQueue();
                    sendResponse({ success: true });
                } else if (message.action === 'open_sidepanel') {
                    if (chromeAPI?.sidePanel) {
                        await chromeAPI.sidePanel.open({ windowId: sender.tab?.windowId });
                        if (message.tab) {
                            setTimeout(() => {
                                chromeAPI.runtime.sendMessage({ 
                                    action: 'switch_sidepanel_tab', 
                                    tab: message.tab 
                                });
                            }, 500);
                        }
                    }
                }
            } catch (error: any) {
                console.error(`Error handling ${message.action}:`, error);
                sendResponse({ success: false, error: error?.message || String(error) });
            }
        };
        run();
        return true;
    };

    if (chromeAPI?.runtime?.onMessage) {
        chromeAPI.runtime.onMessage.addListener(handleMessage);
    }

    init();
});