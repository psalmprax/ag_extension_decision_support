/**
 * Conflict-Free Replicated Data Type (CRDT) Sync Protocol — 100% Offline Multi-Master Sync.
 * Implements Last-Write-Wins Register (LWW-Register) and Vector Clocks for field records.
 */

export interface VectorClock {
  [nodeId: string]: number;
}

export interface CrdtFieldRecord<T = unknown> {
  entityId: string;
  entityType: 'farmer' | 'visit' | 'soil_test' | 'parcel_boundary';
  value: T;
  timestamp: number; // UTC ms
  nodeId: string; // Device ID of the officer
  isDeleted?: boolean;
}

export interface SyncPayload {
  nodeId: string;
  clock: VectorClock;
  deltas: CrdtFieldRecord[];
}

/**
 * Compares two vector clocks. Returns:
 *  1 if clockA is strictly ahead of clockB
 * -1 if clockA is strictly behind clockB
 *  0 if clocks are identical or concurrent
 */
export function compareVectorClocks(clockA: VectorClock, clockB: VectorClock): 1 | -1 | 0 {
  const allNodes = Array.from(new Set([...Object.keys(clockA), ...Object.keys(clockB)]));
  let greater = false;
  let lesser = false;

  for (const node of allNodes) {
    const a = clockA[node] || 0;
    const b = clockB[node] || 0;
    if (a > b) greater = true;
    if (a < b) lesser = true;
  }

  if (greater && !lesser) return 1;
  if (lesser && !greater) return -1;
  return 0;
}

/**
 * Merges an incoming CRDT record into local storage using Last-Write-Wins (LWW) tie-breaking
 */
export function resolveLwwConflict<T>(
  localRecord: CrdtFieldRecord<T> | undefined,
  remoteRecord: CrdtFieldRecord<T>
): { winner: CrdtFieldRecord<T>; updated: boolean } {
  if (!localRecord) {
    return { winner: remoteRecord, updated: true };
  }

  // 1. Primary ordering: Timestamp
  if (remoteRecord.timestamp > localRecord.timestamp) {
    return { winner: remoteRecord, updated: true };
  }
  if (remoteRecord.timestamp < localRecord.timestamp) {
    return { winner: localRecord, updated: false };
  }

  // 2. Tie-breaking deterministic ordering: Lexicographical node ID
  if (remoteRecord.nodeId > localRecord.nodeId) {
    return { winner: remoteRecord, updated: true };
  }

  return { winner: localRecord, updated: false };
}

export class CrdtSyncEngine {
  private nodeId: string;
  private clock: VectorClock = {};
  private storage: Map<string, CrdtFieldRecord> = new Map();
  private readonly persistKey: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.persistKey = `crdt:${nodeId}`;
    this.clock[nodeId] = 0;
    this.loadPersisted();
  }

  private loadPersisted(): void {
    try {
      const raw = localStorage.getItem(this.persistKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { clock?: VectorClock; records?: [string, CrdtFieldRecord][] };
      if (parsed.clock) this.clock = parsed.clock;
      if (parsed.records) this.storage = new Map(parsed.records);
    } catch { /* ignore */ }
    // Best-effort IndexedDB persistence for larger payloads
    try {
      const req = indexedDB.open('ag-crdt', 1);
      req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains('state')) db.createObjectStore('state'); };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('state', 'readonly');
        const get = tx.objectStore('state').get(this.persistKey);
        get.onsuccess = () => {
          const v = get.result as { clock?: VectorClock; records?: [string, CrdtFieldRecord][] } | undefined;
          if (v?.clock) this.clock = v.clock;
          if (v?.records) this.storage = new Map(v.records);
        };
      };
    } catch { /* ignore */ }
  }

  private persist(): void {
    try { localStorage.setItem(this.persistKey, JSON.stringify({ clock: this.clock, records: Array.from(this.storage.entries()) })); } catch { /* quota */ }
    try {
      const req = indexedDB.open('ag-crdt', 1);
      req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains('state')) db.createObjectStore('state'); };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('state', 'readwrite');
        tx.objectStore('state').put({ clock: this.clock, records: Array.from(this.storage.entries()) }, this.persistKey);
      };
    } catch { /* ignore */ }
  }

  public getNodeId(): string {
    return this.nodeId;
  }

  public getClock(): VectorClock {
    return { ...this.clock };
  }

  public setRecord<T>(entityId: string, entityType: CrdtFieldRecord['entityType'], value: T): CrdtFieldRecord<T> {
    this.clock[this.nodeId] = (this.clock[this.nodeId] || 0) + 1;

    const record: CrdtFieldRecord<T> = {
      entityId,
      entityType,
      value,
      timestamp: Date.now(),
      nodeId: this.nodeId,
      isDeleted: false,
    };

    this.storage.set(entityId, record as CrdtFieldRecord);
    this.persist();
    return record;
  }

  public deleteRecord(entityId: string, entityType: CrdtFieldRecord['entityType']): CrdtFieldRecord {
    this.clock[this.nodeId] = (this.clock[this.nodeId] || 0) + 1;

    const record: CrdtFieldRecord = {
      entityId,
      entityType,
      value: null,
      timestamp: Date.now(),
      nodeId: this.nodeId,
      isDeleted: true,
    };

    this.storage.set(entityId, record);
    this.persist();
    return record;
  }

  public getRecord<T>(entityId: string): CrdtFieldRecord<T> | undefined {
    const rec = this.storage.get(entityId);
    if (!rec || rec.isDeleted) return undefined;
    return rec as CrdtFieldRecord<T>;
  }

  public generateSyncDelta(sinceClock: VectorClock): SyncPayload {
    const deltas: CrdtFieldRecord[] = [];

    for (const record of this.storage.values()) {
      const remoteCounter = sinceClock[record.nodeId] || 0;
      // Include if record was created/modified after remote node's last observed clock
      if (record.timestamp > 0 && this.clock[record.nodeId] > remoteCounter) {
        deltas.push(record);
      }
    }

    return {
      nodeId: this.nodeId,
      clock: this.getClock(),
      deltas,
    };
  }

  public applyRemoteSyncPayload(payload: SyncPayload): { appliedCount: number } {
    let appliedCount = 0;

    for (const remoteRecord of payload.deltas) {
      const local = this.storage.get(remoteRecord.entityId);
      const { winner, updated } = resolveLwwConflict(local, remoteRecord);

      if (updated) {
        this.storage.set(remoteRecord.entityId, winner);
        appliedCount++;
      }
    }

    // Merge vector clocks (pointwise maximum)
    for (const [node, counter] of Object.entries(payload.clock)) {
      this.clock[node] = Math.max(this.clock[node] || 0, counter);
    }

    if (appliedCount > 0) this.persist();
    return { appliedCount };
  }
}
