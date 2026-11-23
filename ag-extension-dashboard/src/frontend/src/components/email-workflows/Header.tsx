import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

export function EmailWorkflowsHeader({
  headingClass,
  subtitle,
  isRefreshing,
  onRefresh,
  btnClass,
}: {
  headingClass: string;
  subtitle: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  btnClass: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className={`text-2xl ${headingClass}`}>{t('ui_header_email_workflows')}</h1>
        <p className="text-gray-600 dark:text-theme-text-muted mt-1">{subtitle}</p>
      </div>
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className={`flex items-center gap-2 px-4 py-2 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50`}
      >
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        {t('ui_farmer_detail_panel_refresh')}
      </button>
    </div>
  );
}
