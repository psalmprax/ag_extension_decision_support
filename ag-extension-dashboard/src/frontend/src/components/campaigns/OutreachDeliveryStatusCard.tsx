import React, { useState } from 'react';
import { Send, AlertTriangle, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { OutreachDeliveryStats, retryOutreachMessages } from '@/api/campaignService';

interface OutreachDeliveryStatusCardProps {
  stats: OutreachDeliveryStats | null;
  isLoading: boolean;
  onRefresh: () => void;
  error?: boolean;
}

export const OutreachDeliveryStatusCard: React.FC<OutreachDeliveryStatusCardProps> = ({
  stats,
  isLoading,
  onRefresh,
  error = false,
}) => {
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await retryOutreachMessages([id]);
      if (res.success && res.data.requeued > 0) {
        toast.success('Message requeued for delivery');
      } else {
        toast.error('Could not requeue message — it may no longer be in a failed state');
      }
    } catch {
      toast.error('Failed to requeue message');
    } finally {
      setRetryingId(null);
      onRefresh();
    }
  };

  return (
  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Send className="w-4 h-4 text-emerald-400" />
        <span className="font-bold text-xs text-white">Outreach Delivery Status</span>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isLoading}
        className="p-1.5 rounded-lg bg-white/[0.04] text-white/60 hover:text-white hover:bg-white/[0.08] border border-white/10 transition-all"
        title="Refresh delivery status"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
      </button>
    </div>

    {error ? (
      <div className="text-center py-4 text-slate-400 text-xs">
        Outreach delivery status is currently unavailable. Refresh to retry.
      </div>
    ) : isLoading || !stats ? (
      <div className="flex items-center justify-center py-6 gap-2 text-slate-400 text-xs">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
        <span>Loading delivery status...</span>
      </div>
    ) : stats.totals.total === 0 ? (
      <div className="text-center py-4 text-slate-400 text-xs">
        No outreach deliveries recorded yet. Messages dispatched by Agent Zero or campaigns will appear here once processed.
      </div>
    ) : (
      <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-emerald-400 font-bold text-sm">{stats.totals.sent}</div>
            <div className="text-xxs text-slate-400">Delivered</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-rose-400 font-bold text-sm">{stats.totals.failed}</div>
            <div className="text-xxs text-slate-400">Failed</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-amber-400 font-bold text-sm">{stats.totals.queued}</div>
            <div className="text-xxs text-slate-400">Queued</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
            <div className="text-sky-400 font-bold text-sm">{stats.totals.processing}</div>
            <div className="text-xxs text-slate-400">In Flight</div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xxs text-slate-400">
            <span>Delivery Rate</span>
            <span className="font-mono font-bold text-emerald-400">{stats.totals.sentRate}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${stats.totals.sentRate}%` }}
            />
          </div>
        </div>

        {stats.byChannel.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {stats.byChannel.map(ch => (
              <span
                key={ch.channel}
                className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xxs font-mono text-slate-300"
              >
                {ch.channel}: <span className="text-emerald-400">{ch.sent}</span>
                {ch.failed > 0 && <> / <span className="text-rose-400">{ch.failed} failed</span></>}
              </span>
            ))}
          </div>
        )}

        {stats.recentFailures.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xxs font-bold text-rose-400 uppercase tracking-wider">
              <AlertTriangle className="w-3 h-3" />
              Recent Failures
            </div>
            {stats.recentFailures.slice(0, 5).map(f => (
              <div key={f.id} className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xxs text-slate-300">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-rose-300">{f.channel} · {f.recipient || 'no recipient'}</span>
                  <span className="text-slate-500">{new Date(f.updatedAt).toLocaleString()}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-slate-400">
                    {f.lastError || 'Unknown error'} <span className="text-slate-500">(attempt {f.attempts})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRetry(f.id)}
                    disabled={retryingId === f.id}
                    className="shrink-0 px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                    title="Requeue this message for delivery"
                  >
                    <RotateCcw className={`w-3 h-3 ${retryingId === f.id ? 'animate-spin' : ''}`} />
                    Retry
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </>
    )}
  </div>
  );
};