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
// Upper bound so an officer who stays offline for weeks gets a loud warning
// instead of silently outgrowing browser storage and losing mutations.
const MAX_QUEUE_ITEMS = 500;

export type StorageDurability = 'persistent' | 'best-effort' | 'unknown';
let durability: StorageDurability = 'unknown';

/**
 * Ask the browser to exempt the offline queue from automatic eviction.
 * Fire-and-forget safe: records the outcome for UI surfacing.
 */
export async function ensurePersistentQueueStorage(): Promise<StorageDurability> {
  try {
    const storage = navigator.storage;
    if (storage?.persist) {
      durability = (await storage.persist()) ? 'persistent' : 'best-effort';
    } else {
      durability = 'unknown';
    }
  } catch {
    durability = 'unknown';
  }
  return durability;
}

export function queueStorageDurability(): StorageDurability {
  return durability;
}

/** Typed failure when the offline queue is at capacity. Callers must surface
 * a reconnect-and-sync warning — never swallow this or drop the mutation. */
// fallow-ignore-next-line unused-export
export class QueueFullError extends Error {
  readonly pendingCount: number;
  readonly capacity: number;
  constructor(pendingCount: number, capacity: number = MAX_QUEUE_ITEMS) {
    super(
      `Offline queue at capacity (${pendingCount}/${capacity}). Reconnect and sync before recording more — new mutations are refused rather than risk eviction loss.`,
    );
    this.name = 'QueueFullError';
    this.pendingCount = pendingCount;
    this.capacity = capacity;
  }
}

// fallow-ignore-next-line unused-export
export function isQueueFullError(error: unknown): error is QueueFullError {
  return error instanceof QueueFullError;
}

/** True when the runtime exposes IndexedDB (absent in some test/SSR environments). */
function hasIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error('IndexedDB is unavailable in this environment'));
      return;
    }
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
/**
 * Write the queue to IndexedDB. Returns false instead of swallowing the failure so the
 * caller can report it: a queue that did not persist means an offline write is lost.
 */
async function idbPutAll(items: SyncQueueItem[]): Promise<boolean> {
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
    return true;
  } catch (error) {
    // Expected where IndexedDB is unavailable (the caller already persisted to
    // localStorage); only warn for a real write failure inside IndexedDB.
    if (hasIndexedDb()) console.warn('IndexedDB queue write failed:', error);
    return false;
  }
}

class SyncQueueService {
  private queue: SyncQueueItem[] = [];
  private isProcessing = false;
  private listeners: Array<(count: number) => void> = [];
  private persistenceErrorListeners: Array<(message: string) => void> = [];
  private lastPersistenceError: string | null = null;
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
    this.persistNow();
  }

  /**
   * Persist the queue, reporting any failure.
   *
   * The localStorage write stays synchronous because callers depend on the queue being
   * durable as soon as `enqueue` returns; IndexedDB is the preferred store and is
   * upgraded asynchronously. Quota errors used to be swallowed, so a queued offline
   * diagnosis (often a base64 image) could fail to save and vanish on reload silently.
   */
  private persistNow(): void {
    let failure: unknown = null;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      failure = error;
    }
    // Best-effort upgrade to IndexedDB (the fallback above already guarantees storage).
    void idbPutAll(this.queue);

    if (!failure) {
      this.lastPersistenceError = null;
      return;
    }

    const isQuota = failure instanceof Error
      && (failure.name === 'QuotaExceededError' || failure.name === 'NS_ERROR_DOM_QUOTA_REACHED');
    this.lastPersistenceError = isQuota
      ? 'Device storage is full — this queued item was NOT saved. Free up space, then retry.'
      : 'Could not persist the offline queue — this queued item may be lost on reload.';
    console.error('Failed to persist sync queue:', failure);
    this.persistenceErrorListeners.forEach(cb => cb(this.lastPersistenceError as string));
  }

  /** Last persistence failure, if any (null when the queue is durably stored). */
  getPersistenceError(): string | null {
    return this.lastPersistenceError;
  }

  /** Subscribe to persistence failures. Returns an unsubscribe function. */
  onPersistenceError(callback: (message: string) => void): () => void {
    this.persistenceErrorListeners.push(callback);
    return () => {
      this.persistenceErrorListeners = this.persistenceErrorListeners.filter(cb => cb !== callback);
    };
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
    if (this.queue.length >= MAX_QUEUE_ITEMS) {
      throw new QueueFullError(this.queue.length);
    }
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
