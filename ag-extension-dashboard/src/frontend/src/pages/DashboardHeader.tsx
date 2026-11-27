import React, { useEffect } from 'react';
import toast from 'react-hot-toast';
import { RefreshCw } from 'lucide-react';
import { syncQueue } from '@/api/syncQueueService';
import { dashboardGreeting } from './dashboardGreeting';
import { PAGE_DESCRIPTION, PAGE_TITLE } from '@/components/ui/typography';

/** Dashboard title, greeting, and browser connectivity / queued-sync status. */
export const DashboardHeader: React.FC<{
  userName?: string;
  t: (key: string, options?: { defaultValue?: string } & Record<string, unknown>) => string;
}> = ({ userName, t }) => {
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(
    () => typeof navigator === 'undefined' || navigator.onLine
  );
  const [pendingCount, setPendingCount] = React.useState(() => syncQueue.getPendingCount());

  useEffect(() => {
    const updatePending = (count: number) => setPendingCount(count);
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);
    const unsubscribe = syncQueue.onCountChange(updatePending);
    setPendingCount(syncQueue.getPendingCount());
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);
    return () => {
      unsubscribe();
      window.removeEventListener('online', setOnline);
      window.removeEventListener('offline', setOffline);
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline) {
      toast.error('Sync requires an internet connection.');
      return;
    }
    setIsSyncing(true);
    try {
      const result = await syncQueue.processQueue();
      const remaining = syncQueue.getQueue().length;
      const stuck = syncQueue.getStuckItems().length;
      const retrying = remaining - stuck;
      if (stuck) {
        toast.error(
          `${result.success} synced · ${stuck} need attention${retrying ? ` · ${retrying} remain queued` : ''}.`
        );
      } else if (remaining) {
        toast(
          `${result.success ? `${result.success} synced · ` : ''}${remaining} change(s) remain queued for retry.`
        );
      } else if (result.success) {
        toast.success(`${result.success} queued change(s) synced.`);
      } else {
        toast('No pending changes to sync.');
      }
    } catch {
      toast.error('Sync could not be completed. Check your connection and retry.');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className={`mb-2 ${PAGE_TITLE}`}>
          {t('dashboard_operations_title', { defaultValue: 'Overview' })}
        </h1>
        <p className={PAGE_DESCRIPTION}>
          {dashboardGreeting(t, userName)}
        </p>
      </div>

      {/* Browser connectivity and queued-sync status (not database activity). */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] text-sm">
          <span
            className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}
            aria-hidden="true"
          />
          <span className="text-slate-700 dark:text-theme-text-primary">
            {isOnline
              ? t('dashboard_online', { defaultValue: 'Online' })
              : t('dashboard_offline', { defaultValue: 'Offline' })}
            {' · '}
            {pendingCount === 0
              ? t('dashboard_nothing_to_sync', { defaultValue: 'all changes saved' })
              : t('dashboard_waiting_to_sync', {
                  count: pendingCount,
                  defaultValue: '{count} changes waiting to sync',
                })}
          </span>
          {pendingCount > 0 && (
            <button
              onClick={handleManualSync}
              disabled={isSyncing || !isOnline}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-xs font-medium transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>
                {isSyncing
                  ? t('dashboard_syncing', { defaultValue: 'Syncing' })
                  : t('dashboard_sync_now', { defaultValue: 'Sync now' })}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
