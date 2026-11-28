import React from 'react';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { PageHeader } from '@/components/ui/PageHeader';

export function EmailWorkflowsHeader({
  subtitle,
  isRefreshing,
  onRefresh,
  btnClass,
}: {
  subtitle: string;
  isRefreshing: boolean;
  onRefresh: () => void;
  btnClass: string;
}) {
  const { t } = useLanguage();
  return (
    <PageHeader
      photo="farmerWithPhone"
      title={t('nav_email_workflows')}
      description={subtitle}
      actions={
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className={`flex items-center gap-2 px-4 py-2 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50`}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {t('ui_farmer_detail_panel_refresh')}
        </button>
      }
    />
  );
}
