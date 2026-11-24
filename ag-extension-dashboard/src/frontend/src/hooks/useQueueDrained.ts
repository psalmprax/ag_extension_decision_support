import { useEffect, useRef } from 'react';
import { syncQueue } from '@/api/syncQueueService';

/** Calls back whenever writes waiting on this device reach the server, so a screen can reload. */
export function useQueueDrained(onDrained: () => void): void {
  const callback = useRef(onDrained);
  callback.current = onDrained;
  useEffect(() => {
    let previous = syncQueue.getPendingCount();
    return syncQueue.onCountChange(count => {
      if (count < previous) callback.current();
      previous = count;
    });
  }, []);
}
