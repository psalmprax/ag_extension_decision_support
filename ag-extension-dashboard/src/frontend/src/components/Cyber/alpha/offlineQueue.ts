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

/** Resend every queued offline query in order; stops at the first failure. */
export async function drainAlphaOfflineQueue(send: (query: string) => Promise<void>): Promise<void> {
  if (!navigator.onLine) return;
  const q = readOfflineQueue();
  if (q.length === 0) return;
  for (const queued of [...q]) {
    try {
      await send(queued);
      q.shift();
      writeOfflineQueue(q);
    } catch {
      return;
    }
  }
  if (q.length === 0) localStorage.removeItem(OFFLINE_QUEUE_KEY);
}
