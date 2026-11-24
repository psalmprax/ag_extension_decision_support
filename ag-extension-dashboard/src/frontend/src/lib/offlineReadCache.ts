import { safeStorage } from './safeStorage';

const PREFIX = 'ag-offline-read:';
let owner: string | null = null;

/**
 * The person signed in on this device. Copies kept for offline use and writes waiting to sync
 * belong to one person, so another account on the same phone never sees or sends them.
 */
export function setDeviceOwner(userId: string | null): void {
  owner = userId;
}

export function deviceOwner(): string | null {
  return owner;
}

interface KeptRead<T> {
  savedAt: number;
  value: T;
}

const storageKey = (key: string) => `${PREFIX}${owner}:${key}`;

/** Keeps the latest answer to a read so the screen still has it with no connection. */
export function rememberRead(key: string, value: unknown): void {
  if (!owner) return;
  safeStorage.set(storageKey(key), JSON.stringify({ savedAt: Date.now(), value }));
}

/** The answer kept by rememberRead for the person signed in, or null when there is none. */
export function recallRead<T>(key: string): KeptRead<T> | null {
  if (!owner) return null;
  return safeStorage.json<KeptRead<T> | null>(storageKey(key), null);
}

/** Removes every copy kept for offline use, for every person. Run when someone signs out. */
export function forgetOfflineReads(): void {
  safeStorage.keys(PREFIX).forEach(key => safeStorage.remove(key));
}
