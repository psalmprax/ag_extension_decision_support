import { randomId } from '@/lib/randomId';
import { deviceOwner } from '@/lib/offlineReadCache';

/**
 * Voice recordings made with no signal, kept on the phone until they can be turned
 * into text. Each belongs to one field (its draft key, such as the findings box of a
 * visit report for one farmer), so the text lands in that field the next time it is
 * open with a connection, even if the form was closed in between.
 */
export interface PendingRecording {
  id: string;
  draftKey: string;
  language: string;
  audio: Blob;
  /** When it was recorded, so "come back in two weeks" counts from the visit, not from when it was sent. */
  savedAt: number;
  /** Who recorded it: a shared phone never puts one officer's words in another's form. */
  ownerId: string | null;
}

export interface PendingRecordingStore {
  /** Resolves once the recording is stored for good. `recordedAt` defaults to now. */
  save(draftKey: string, language: string, audio: Blob, recordedAt?: number): Promise<void>;
  /** The signed-in person's recordings for one field, oldest first. */
  list(draftKey: string): Promise<PendingRecording[]>;
  remove(id: string): Promise<void>;
}

const DB_NAME = 'ag-pending-recordings';
const STORE = 'recordings';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('This browser cannot keep recordings offline'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'id' });
      store.createIndex('draftKey', 'draftKey');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open offline recordings'));
  });
}

/**
 * Runs one request and resolves with its result once its transaction has completed, so
 * a save is reported only when the recording is really stored (a request can succeed
 * and its transaction still be aborted, for example when the phone runs out of space).
 */
async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = work(transaction.objectStore(STORE));
      const failed = () => reject(request.error ?? transaction.error ?? new Error('Offline recordings could not be read or saved'));
      let result: T;
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = failed;
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = failed;
      transaction.onerror = failed;
    });
  } finally {
    db.close();
  }
}

export const pendingRecordings: PendingRecordingStore = {
  async save(draftKey, language, audio, recordedAt = Date.now()) {
    const item: PendingRecording = { id: randomId(), draftKey, language, audio, savedAt: recordedAt, ownerId: deviceOwner() };
    await run('readwrite', store => store.put(item));
  },
  async list(draftKey) {
    // Nothing can have been kept where there is no storage to keep it in.
    if (typeof indexedDB === 'undefined') return [];
    const items = await run<PendingRecording[]>('readonly', store => store.index('draftKey').getAll(draftKey));
    const owner = deviceOwner();
    return items.filter(item => item.ownerId === owner).sort((a, b) => a.savedAt - b.savedAt);
  },
  async remove(id) {
    await run('readwrite', store => store.delete(id));
  },
};
