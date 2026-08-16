import apiClient from './client';

export type SyncState = 'pending' | 'failed' | 'conflict';

export interface SyncQueueItem {
  id: string;
  idempotencyKey: string;
  action: 'create' | 'update' | 'delete';
  entity: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
  state: SyncState;
  lastError?: string;
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
        const parsed = JSON.parse(stored) as Array<Partial<SyncQueueItem> & Pick<SyncQueueItem, 'id'>>;
        this.queue = parsed.map(item => ({
          ...(item as SyncQueueItem),
          idempotencyKey: item.idempotencyKey || item.id,
          state: item.state || 'pending',
          retryCount: item.retryCount || 0,
        }));
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

  enqueue(item: Omit<SyncQueueItem, 'id' | 'idempotencyKey' | 'timestamp' | 'retryCount' | 'state'> & { idempotencyKey?: string }): string {
    const id =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? `sync_${crypto.randomUUID()}`
        : `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const queueItem: SyncQueueItem = {
      ...item,
      id,
      idempotencyKey: item.idempotencyKey || id,
      timestamp: Date.now(),
      retryCount: 0,
      state: 'pending',
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

  retry(id: string): void {
    const item = this.queue.find(queueItem => queueItem.id === id);
    if (!item) return;
    item.state = 'pending';
    item.retryCount = 0;
    item.lastError = undefined;
    this.saveToStorage();
    this.notifyListeners();
  }

  private async executeSyncItem(item: SyncQueueItem): Promise<'success' | 'conflict' | 'failed' | 'retry'> {
    try {
      await apiClient.request({
        url: item.endpoint,
        method: item.method,
        data: item.data,
        headers: { 'Idempotency-Key': item.idempotencyKey },
      });
      return 'success';
    } catch (error: unknown) {
      const response = (error as { response?: { status?: number; data?: { error?: string } } }).response;
      item.lastError = response?.data?.error || (error instanceof Error ? error.message : 'Sync failed');
      if (response?.status === 409) {
        item.state = 'conflict';
        return 'conflict';
      }
      item.retryCount++;
      if (item.retryCount >= MAX_RETRIES) {
        item.state = 'failed';
        return 'failed';
      }
      return 'retry';
    }
  }

  async processQueue(): Promise<{ success: number; failed: number; conflicts: number }> {
    if (this.isProcessing || this.queue.length === 0 || !navigator.onLine) {
      return { success: 0, failed: 0, conflicts: 0 };
    }

    this.isProcessing = true;
    let success = 0;
    let failed = 0;
    let conflicts = 0;
    const toRemove: string[] = [];

    const pendingItems = this.queue.filter(queueItem => queueItem.state === 'pending');
    for (const item of pendingItems) {
      const result = await this.executeSyncItem(item);
      if (result === 'success') {
        toRemove.push(item.id);
        success++;
      } else if (result === 'conflict') {
        conflicts++;
      } else if (result === 'failed') {
        failed++;
      }
    }

    this.queue = this.queue.filter(item => !toRemove.includes(item.id));
    this.saveToStorage();
    this.notifyListeners();
    this.isProcessing = false;

    return { success, failed, conflicts };
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
