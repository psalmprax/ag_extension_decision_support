import React, { useEffect, useState } from 'react';
import { RefreshCw, Trash2, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { syncQueue, type SyncQueueItem } from '@/api/syncQueueService';

/**
 * Operator view of the offline write queue. Surfaces items that exhausted
 * automatic retries or hit a server-side conflict so they can be retried or
 * discarded deliberately instead of sitting in IndexedDB forever.
 */
export const SyncQueuePanel: React.FC = () => {
  const [items, setItems] = useState<SyncQueueItem[]>(syncQueue.getQueue());
  const [nextRetryAt, setNextRetryAt] = useState<number | null>(syncQueue.getNextRetryAt());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsubscribe = syncQueue.onCountChange(() => {
      setItems(syncQueue.getQueue());
      setNextRetryAt(syncQueue.getNextRetryAt());
    });
    return unsubscribe;
  }, []);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5 flex items-center gap-3 text-sm text-white/60">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        Offline sync queue is empty.
      </div>
    );
  }

  const stuck = items.filter(i => i.state === 'failed' || i.state === 'conflict');
  const pending = items.filter(i => i.state === 'pending');

  const retryAll = async () => {
    setBusy(true);
    try {
      stuck.forEach(i => syncQueue.retry(i.id));
      const r = await syncQueue.processQueue();
      toast[r.failed || r.conflicts ? 'error' : 'success'](`${r.success} synced · ${r.failed} failed · ${r.conflicts} conflicts`);
    } finally {
      setBusy(false);
    }
  };

  const discard = (id: string) => {
    syncQueue.remove(id);
    toast('Queued change discarded');
  };

  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/60 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white">Offline Sync Queue</h3>
          <p className="text-xs text-white/50">
            {pending.length} pending{nextRetryAt ? ` · next automatic retry ${new Date(nextRetryAt).toLocaleTimeString()}` : ''} · {stuck.length} need attention
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void syncQueue.processQueue()}
            disabled={busy || !navigator.onLine}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-white/80 flex items-center gap-1.5 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Sync now
          </button>
          {stuck.length > 0 && (
            <button
              onClick={retryAll}
              disabled={busy || !navigator.onLine}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-xs text-amber-200 flex items-center gap-1.5 disabled:opacity-40"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Retry {stuck.length} stuck
            </button>
          )}
        </div>
      </div>

      <ul className="divide-y divide-white/5">
        {items.map(item => (
          <li key={item.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded font-mono uppercase text-[10px] ${
                  item.state === 'pending' ? 'bg-cyan-500/15 text-cyan-300' :
                  item.state === 'conflict' ? 'bg-amber-500/15 text-amber-300' :
                  'bg-rose-500/15 text-rose-300'
                }`}>{item.state}</span>
                <span className="text-white/80 font-semibold truncate">{item.method} {item.endpoint}</span>
              </div>
              <div className="text-white/40 mt-0.5 flex items-center gap-2">
                <Clock className="w-3 h-3" /> queued {new Date(item.timestamp).toLocaleString()} · attempts {item.retryCount}
                {item.lastError && <span className="text-rose-300/80 truncate">· {item.lastError}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {item.state !== 'pending' && (
                <button
                  onClick={() => { syncQueue.retry(item.id); void syncQueue.processQueue(); }}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
                  title="Retry"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => discard(item.id)}
                className="p-1.5 rounded-lg hover:bg-rose-500/20 text-white/60 hover:text-rose-300"
                title="Discard"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default SyncQueuePanel;
