// Types for offline queue
interface QueuedRequest {
    id: string;
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: any;
    timestamp: number;
    retries: number;
    maxRetries: number;
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
    const chromeAPI = (globalThis as any).chrome;

    // Initialize IndexedDB
    const initDB = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
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
            await fetch('http://localhost:3001/api/health', {
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
            request.onerror = () => reject(request.error);
        });
    };

    // Queue a request
    const queueRequest = async (request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retries'>): Promise<void> => {
        if (!db) await initDB();

        const queuedRequest: QueuedRequest = {
            ...request,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            retries: 0,
            maxRetries: 3
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
            dbRequest.onerror = () => reject(dbRequest.error);
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
                    requests.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(requests);
                }
            };

            request.onerror = () => reject(request.error);
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
            request.onerror = () => reject(request.error);
        });
    };

    // Process queued requests
    const processQueue = async (): Promise<void> => {
        const requests = await getQueuedRequests();

        for (const request of requests) {
            try {
                const response = await fetch(request.url, {
                    method: request.method,
                    headers: request.headers,
                    body: request.body ? JSON.stringify(request.body) : undefined
                });

                if (response.ok) {
                    console.log('Queued request processed successfully:', request.id);
                    await removeQueuedRequest(request.id);
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                console.error('Failed to process queued request:', request.id, error);
                request.retries++;

                if (request.retries >= request.maxRetries) {
                    console.log('Max retries reached, removing request:', request.id);
                    await removeQueuedRequest(request.id);
                } else {
                    // Update retry count
                    if (db) {
                        const transaction = db.transaction([QUEUE_STORE], 'readwrite');
                        const store = transaction.objectStore(QUEUE_STORE);
                        store.put(request);
                    }
                }
            }
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

    // Message handler for queuing requests
    if (chromeAPI?.runtime?.onMessage) {
        chromeAPI.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
            if (message.action === 'queue_request') {
                queueRequest(message.request).then(() => {
                    sendResponse({ success: true });
                }).catch((error) => {
                    console.error('Failed to queue request:', error);
                    sendResponse({ success: false, error: error.message });
                });
                return true; // Keep channel open
            }

            if (message.action === 'get_queued_requests') {
                getQueuedRequests().then((requests) => {
                    sendResponse({ success: true, requests });
                }).catch((error) => {
                    sendResponse({ success: false, error: error.message });
                });
                return true;
            }

            if (message.action === 'get_offline_status') {
                getOfflineStatus().then((status) => {
                    sendResponse({ success: true, status });
                }).catch((error) => {
                    sendResponse({ success: false, error: error.message });
                });
                return true;
            }

            if (message.action === 'sync_now') {
                processQueue().then(() => {
                    sendResponse({ success: true });
                }).catch((error) => {
                    sendResponse({ success: false, error: error.message });
                });
                return true;
            }

            if (message.action === 'open_sidepanel') {
                if (chromeAPI?.sidePanel) {
                    chromeAPI.sidePanel.open({ windowId: sender.tab?.windowId });
                }
            }
        });
    }

    init();
});