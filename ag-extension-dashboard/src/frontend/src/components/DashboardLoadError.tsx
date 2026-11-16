import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

/**
 * Shown on the dashboard when its summary data fails to load. It stays inside
 * the dashboard page: the sidebar and every other page keep working, and the
 * officer can retry.
 */
export function DashboardLoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useLanguage();
  return (
    <div
      role="alert"
      className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        {t('dashboard_summary_unavailable', {
          defaultValue: 'Dashboard figures could not be loaded. Other pages still work.',
        })}
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="ml-auto inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium dark:border-amber-800"
      >
        <RefreshCw className="h-3 w-3" aria-hidden="true" />
        {t('action_try_again', { defaultValue: 'Try again' })}
      </button>
    </div>
  );
}
