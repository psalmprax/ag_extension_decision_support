import { useEffect, useState } from 'react';
import { syncQueue, queueStorageDurability, type StorageDurability } from '@/api/syncQueueService';

const FULL_THRESHOLD = 400;

/**
 * Offline queue banner — the UX contract for queue-full protection.
 * Shows pending mutation count whenever offline work exists, warns as the
 * queue approaches capacity, and blocks silently losing field data: at
 * capacity the service throws QueueFullError and this banner tells the
 * officer to reconnect and sync before recording more.
 */
export function OfflineQueueBanner(): JSX.Element | null {
  const [pending, setPending] = useState(() => syncQueue.getPendingCount());
  const [durability, setDurability] = useState<StorageDurability>(() => queueStorageDurability());

  useEffect(() => {
    const unsubscribe = syncQueue.onCountChange((count) => {
      setPending(count);
      setDurability(queueStorageDurability());
    });
    return unsubscribe;
  }, []);

  if (pending === 0) return null;

  const isFull = pending >= FULL_THRESHOLD;
  return (
    <div
      role={isFull ? 'alert' : 'status'}
      aria-live="polite"
      style={{
        padding: '8px 12px',
        background: isFull ? '#7f1d1d' : '#78350f',
        color: '#fff',
        fontSize: 13,
      }}
    >
      {isFull
        ? `Offline queue nearly full (${pending} pending). Reconnect and sync now — new entries will be refused at capacity to protect your data.`
        : `${pending} offline change${pending === 1 ? '' : 's'} waiting to sync.`}
      {durability === 'best-effort' && ' Storage is not persistent on this device — sync soon.'}
    </div>
  );
}
