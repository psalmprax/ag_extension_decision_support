import axios from 'axios';
import { syncQueue, type SyncQueueItem } from './syncQueueService';
import { randomId } from '@/lib/randomId';

export type QueuedWrite = Pick<SyncQueueItem, 'entity' | 'action' | 'method' | 'endpoint' | 'data' | 'label'>;

/** True when a request never reached the server: no connection, or it dropped on the way. */
export function isNetworkFailure(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response && error.code !== 'ERR_CANCELED';
}

export type WriteOutcome<T> = { queued: false; result: T } | { queued: true };

/**
 * Sends a write now, or keeps it on this device to send when the connection is back.
 *
 * Only a write that could not reach the server waits; a refusal from the server (a bad value,
 * no access) still throws, so the person can correct it while they are looking at it.
 */
export async function sendOrQueue<T>(
  write: QueuedWrite,
  send: (idempotencyKey: string) => Promise<T>
): Promise<WriteOutcome<T>> {
  const idempotencyKey = randomId('write_');
  const queue = (): WriteOutcome<T> => {
    syncQueue.enqueue({ ...write, idempotencyKey });
    return { queued: true };
  };
  if (!navigator.onLine) return queue();
  try {
    return { queued: false, result: await send(idempotencyKey) };
  } catch (error) {
    if (!isNetworkFailure(error)) throw error;
    return queue();
  }
}
