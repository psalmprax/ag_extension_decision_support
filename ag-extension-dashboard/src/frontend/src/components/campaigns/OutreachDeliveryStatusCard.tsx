import React, { useState } from 'react';
import { appLocale } from '@/lib/appLocale';
import { Send, AlertTriangle, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import toast from 'react-hot-toast';
import { OutreachDeliveryStats, retryOutreachMessages } from '@/api/campaignService';
import { STATUS_COLOR } from '@/components/charts/chartConfig';
import { useLanguage } from '@/lib/LanguageContext';

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
  const { t } = useLanguage();

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const res = await retryOutreachMessages([id]);
      if (res.success && res.data.requeued > 0) {
        toast.success(t('outreach_requeued_success', { defaultValue: 'Message requeued for delivery' }));
      } else {
        toast.error(t('outreach_requeued_failed', { defaultValue: 'Could not requeue message — it may no longer be in a failed state' }));
      }
    } catch {
      toast.error(t('outreach_requeued_error', { defaultValue: 'Failed to requeue message' }));
    } finally {
      setRetryingId(null);
      onRefresh();
    }
  };

  return (
  <div className="p-4 rounded-lg bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] space-y-3">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Send className="w-4 h-4 text-slate-500 dark:text-theme-text-muted" strokeWidth={1.5} />
        <span className="font-medium text-xs text-slate-900 dark:text-white">
          {t('outreach_delivery_status', { defaultValue: 'Outreach delivery status' })}
        </span>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isLoading}
        className="p-1.5 rounded-md text-slate-600 dark:text-theme-text-secondary hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] border border-slate-900/[0.08] dark:border-white/[0.1] transition-colors"
        title={t('outreach_refresh_tooltip', { defaultValue: 'Refresh delivery status' })}
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
      </button>
    </div>

    {error ? (
      <div className="text-center py-4 text-slate-600 dark:text-theme-text-muted text-xs">
        {t('outreach_delivery_unavailable', { defaultValue: 'Outreach delivery status is currently unavailable. Refresh to retry.' })}
      </div>
    ) : isLoading || !stats ? (
      <div className="flex items-center justify-center py-6 gap-2 text-slate-600 dark:text-theme-text-muted text-xs">
        <Loader2 className="w-4 h-4 animate-spin text-emerald-700 dark:text-emerald-400" />
        <span>{t('outreach_loading_status', { defaultValue: 'Loading delivery status...' })}</span>
      </div>
    ) : stats.totals.total === 0 ? (
      <div className="text-center py-4 text-slate-600 dark:text-theme-text-muted text-xs">
        {t('outreach_no_deliveries', { defaultValue: 'No outreach deliveries recorded yet. Messages dispatched by Agent Zero or campaigns will appear here once processed.' })}
      </div>
    ) : (
      <>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.06] dark:border-white/[0.08]">
            <div className="text-emerald-700 dark:text-emerald-400 font-medium text-sm">{stats.totals.sent}</div>
            <div className="text-xxs text-slate-600 dark:text-theme-text-muted">{t('outreach_delivered', { defaultValue: 'Delivered' })}</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.06] dark:border-white/[0.08]">
            <div className="text-rose-700 dark:text-rose-400 font-medium text-sm">{stats.totals.failed}</div>
            <div className="text-xxs text-slate-600 dark:text-theme-text-muted">{t('outreach_failed', { defaultValue: 'Failed' })}</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.06] dark:border-white/[0.08]">
            <div className="text-amber-700 dark:text-amber-400 font-medium text-sm">{stats.totals.queued}</div>
            <div className="text-xxs text-slate-600 dark:text-theme-text-muted">{t('outreach_queued', { defaultValue: 'Queued' })}</div>
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.06] dark:border-white/[0.08]">
            <div className="text-slate-600 dark:text-theme-text-muted font-medium text-sm">{stats.totals.processing}</div>
            <div className="text-xxs text-slate-600 dark:text-theme-text-muted">{t('outreach_in_flight', { defaultValue: 'In flight' })}</div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xxs text-slate-600 dark:text-theme-text-muted">
            <span>{t('outreach_delivery_rate', { defaultValue: 'Delivery rate' })}</span>
            <span className="font-mono font-medium text-emerald-700 dark:text-emerald-400">{stats.totals.sentRate}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-900/[0.06] dark:bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, Math.max(0, stats.totals.sentRate))}%`, background: STATUS_COLOR.good }}
            />
          </div>
        </div>

        {stats.byChannel.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {stats.byChannel.map(ch => (
              <span
                key={ch.channel}
                className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.06] dark:border-white/[0.08] text-xxs font-mono text-slate-700 dark:text-theme-text-secondary"
              >
                {ch.channel}: <span className="text-emerald-700 dark:text-emerald-400">{ch.sent}</span>
                {ch.failed > 0 && <> / <span className="text-rose-700 dark:text-rose-400">{t('ui_outreach_delivery_status_card_failed', { failed: ch.failed })}</span></>}
              </span>
            ))}
          </div>
        )}

        {stats.recentFailures.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xxs font-medium text-rose-700 dark:text-rose-400  ">
              <AlertTriangle className="w-3 h-3" />
              {t('ui_outreach_delivery_status_card_recent_failures')}
            </div>
            {stats.recentFailures.slice(0, 5).map(f => (
              <div key={f.id} className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.06] dark:border-white/[0.08] text-xxs text-slate-700 dark:text-theme-text-secondary">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-rose-700 dark:text-rose-300">{f.channel} · {f.recipient || 'no recipient'}</span>
                  <span className="text-slate-500 dark:text-theme-text-muted">{new Date(f.updatedAt).toLocaleString(appLocale())}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span className="text-slate-600 dark:text-theme-text-muted">
                    {f.lastError || 'Unknown error'} <span className="text-slate-500 dark:text-theme-text-muted">{t('ui_outreach_delivery_status_card_attempt', { attempts: f.attempts })}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRetry(f.id)}
                    disabled={retryingId === f.id}
                    className="shrink-0 px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/20 font-medium flex items-center gap-1 transition-all disabled:opacity-50"
                    title="Requeue this message for delivery"
                  >
                    <RotateCcw className={`w-3 h-3 ${retryingId === f.id ? 'animate-spin' : ''}`} />
                    {t('users_access_plans_retry')}
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