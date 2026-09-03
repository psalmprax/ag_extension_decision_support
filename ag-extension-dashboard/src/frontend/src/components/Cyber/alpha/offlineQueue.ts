// Offline queue moved verbatim from components/Cyber/AlphaAI.tsx (pure move).

export const OFFLINE_QUEUE_KEY = 'alphaAiOfflineQueue';

export const nowStamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function readOfflineQueue(): string[] {
  return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]') as string[];
}

export function writeOfflineQueue(queue: string[]): void {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export function enqueueOfflineQuery(query: string): void {
  writeOfflineQueue([...readOfflineQueue(), query]);
}

/**
 * Resend every queued offline query in order.
 *
 * `send` must resolve to `true` when the query was delivered and `false` when it
 * failed (the AlphaAI sender swallows errors into chat messages, so a thrown error
 * is not a reliable signal). A failed item stays at the head of the queue and the
 * drain stops; it will be retried on the next `online` event. The queue is always
 * re-read from storage before writing so a re-enqueue performed by `send` during a
 * failure is never overwritten by a stale local copy.
 */
export async function drainAlphaOfflineQueue(send: (query: string) => Promise<boolean>): Promise<void> {
  if (!navigator.onLine) return;
  const initial = readOfflineQueue();
  if (initial.length === 0) return;
  for (const queued of initial) {
    let ok = false;
    try {
      ok = await send(queued);
    } catch {
      ok = false;
    }
    if (!ok) return;
    // Remove exactly this item from the *current* stored queue.
    const current = readOfflineQueue();
    const idx = current.indexOf(queued);
    if (idx !== -1) current.splice(idx, 1);
    writeOfflineQueue(current);
    if (!navigator.onLine) return;
  }
  if (readOfflineQueue().length === 0) localStorage.removeItem(OFFLINE_QUEUE_KEY);
}
