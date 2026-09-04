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
  /** Epoch ms before which an automatic retry must not run (exponential backoff). */
  nextAttemptAt?: number;
}

const STORAGE_KEY = 'ag-sync-queue';
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 30_000; // 30s, 1m, 2m, 4m, 8m
const IDB_NAME = 'ag-sync-queue-db';
const IDB_STORE = 'queue';

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function idbGetAll(): Promise<SyncQueueItem[]> {
  try {
    const db = await openIdb();
    return await new Promise((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).getAll();
      req.onsuccess = () => res((req.result as SyncQueueItem[]) || []);
      req.onerror = () => rej(req.error);
    });
  } catch { return []; }
}
async function idbPutAll(items: SyncQueueItem[]): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.clear();
      items.forEach(i => store.put(i));
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch { /* fallback to localStorage */ try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* ignore */ } }
}

class SyncQueueService {
  private queue: SyncQueueItem[] = [];
  private isProcessing = false;
  private listeners: Array<(count: number) => void> = [];
  private ready: Promise<void>;

  constructor() {
    this.ready = this.loadFromStorage();
  }

  private async loadFromStorage(): Promise<void> {
    // Prefer IndexedDB, fall back to localStorage migration
    try {
      const idbItems = await idbGetAll();
      if (idbItems.length > 0) {
        this.queue = idbItems.map(item => ({ ...item, idempotencyKey: item.idempotencyKey || item.id, state: item.state || 'pending', retryCount: item.retryCount || 0 }));
        return;
      }
    } catch { /* ignore */ }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Array<Partial<SyncQueueItem> & Pick<SyncQueueItem, 'id'>>;
        this.queue = parsed.map(item => ({ ...(item as SyncQueueItem), idempotencyKey: item.idempotencyKey || item.id, state: item.state || 'pending', retryCount: item.retryCount || 0 }));
        // Migrate to IDB
        void idbPutAll(this.queue);
      }
    } catch { this.queue = []; }
  }

  private saveToStorage(): void {
    void idbPutAll(this.queue);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue)); } catch { /* ignore */ }
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
        item.nextAttemptAt = undefined;
        return 'failed';
      }
      item.nextAttemptAt = Date.now() + BASE_BACKOFF_MS * 2 ** (item.retryCount - 1);
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

    const now = Date.now();
    const pendingItems = this.queue.filter(
      queueItem => queueItem.state === 'pending' && (!queueItem.nextAttemptAt || queueItem.nextAttemptAt <= now)
    );
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

  /** Items that need a human decision (exhausted retries or server-side conflict). */
  getStuckItems(): SyncQueueItem[] {
    return this.queue.filter(i => i.state === 'failed' || i.state === 'conflict');
  }

  /** Earliest scheduled automatic retry among pending items, if any. */
  getNextRetryAt(): number | null {
    const times = this.queue
      .filter(i => i.state === 'pending' && typeof i.nextAttemptAt === 'number')
      .map(i => i.nextAttemptAt as number);
    return times.length ? Math.min(...times) : null;
  }
}

export const syncQueue = new SyncQueueService();

if (typeof window !== 'undefined') {
  // Background scheduler: retries backed-off items while online so a single
  // transient failure never strands a write until the next connectivity flip.
  const tick = () => {
    if (navigator.onLine) void syncQueue.processQueue();
  };
  window.setInterval(tick, 20_000);
  // `online` is handled by useAppSync (which owns user feedback); avoid a second,
  // competing listener here that would race it for `isProcessing`.
}
