import apiClient from './client';

interface SyncQueueItem {
    id: string;
    action: 'create' | 'update' | 'delete';
    entity: string;
    endpoint: string;
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: any;
    timestamp: number;
    retryCount: number;
}

const STORAGE_KEY = 'ag-sync-queue';
const MAX_RETRIES = 3;

class SyncQueueService {
    private queue: SyncQueueItem[] = [];
    private isProcessing = false;
    private listeners: Array<(count: number) => void> = [];

    constructor() {
        this.loadFromStorage();
    }

    private loadFromStorage(): void {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                this.queue = JSON.parse(stored);
            }
        } catch {
            this.queue = [];
        }
    }

    private saveToStorage(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
        } catch {
            /* storage full or unavailable */
        }
    }

    private notifyListeners(): void {
        this.listeners.forEach(cb => cb(this.queue.length));
    }

    getPendingCount(): number {
        return this.queue.length;
    }

    onCountChange(callback: (count: number) => void): () => void {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(cb => cb !== callback);
        };
    }

    enqueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount'>): string {
        const id = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const queueItem: SyncQueueItem = {
            ...item,
            id,
            timestamp: Date.now(),
            retryCount: 0,
        };
        this.queue.push(queueItem);
        this.saveToStorage();
        this.notifyListeners();
        return id;
    }

    remove(id: string): void {
        this.queue = this.queue.filter(item => item.id !== id);
        this.saveToStorage();
        this.notifyListeners();
    }

    clear(): void {
        this.queue = [];
        this.saveToStorage();
        this.notifyListeners();
    }

    async processQueue(): Promise<{ success: number; failed: number }> {
        if (this.isProcessing || this.queue.length === 0 || !navigator.onLine) {
            return { success: 0, failed: 0 };
        }

        this.isProcessing = true;
        let success = 0;
        let failed = 0;
        const toRemove: string[] = [];

        for (const item of [...this.queue]) {
            try {
                await apiClient.request({
                    url: item.endpoint,
                    method: item.method,
                    data: item.data,
                });
                toRemove.push(item.id);
                success++;
            } catch {
                item.retryCount++;
                if (item.retryCount >= MAX_RETRIES) {
                    toRemove.push(item.id);
                    failed++;
                }
            }
        }

        this.queue = this.queue.filter(item => !toRemove.includes(item.id));
        this.saveToStorage();
        this.notifyListeners();
        this.isProcessing = false;

        return { success, failed };
    }

    getQueue(): SyncQueueItem[] {
        return [...this.queue];
    }
}

export const syncQueue = new SyncQueueService();

if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        syncQueue.processQueue();
    });
}
