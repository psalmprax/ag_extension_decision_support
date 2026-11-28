import React from 'react';
import { BarChart3 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLanguage } from '@/lib/LanguageContext';
import { MarketPriceTrendCard } from '@/components/MarketPriceTrendCard';
import type { PerformanceData } from '@/api/analyticsService';
import { KpiTiles } from './analytics/KpiTiles';
import { ActivityTimelineChart } from './analytics/ActivityTimelineChart';
import { PilotsSection } from '@/components/pilots/PilotsSection';

interface AnalyticsPageProps {
  performanceData: PerformanceData | undefined;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ performanceData }) => {
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      <PageHeader photo="aerialFarmland"
        title={t('ui_analytics_page_system_analytics')}
        description={t('ui_analytics_page_support_performance_commodity_prices')}
        meta={t('ui_analytics_page_last_30_days')}
      />

      {performanceData ? (
        <>
          <KpiTiles metrics={performanceData.metrics} t={t} />

          {/* ── Market Prices Full-Width Trend Card ── */}
          <MarketPriceTrendCard />

          <ActivityTimelineChart timeline={performanceData.timeline} />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center backdrop-blur-xl bg-white/80 dark:bg-theme-bg-secondary/40 border border-slate-200 dark:border-white/10 rounded-xl p-8 shadow-sm">
          <BarChart3 className="w-14 h-14 text-slate-300 dark:text-white/20 mb-4" />
          <h3 className="text-base font-medium text-slate-900 dark:text-white mb-2">
            {t('analytics_no_data') || 'No analytics data available'}
          </h3>
          <p className="text-xs text-slate-600 dark:text-white/50 max-w-sm leading-relaxed">
            {t('analytics_no_data_desc') ||
              'Analytics data will appear here once telemetry activity streams begin. Ensure background sync and advisory workers are running.'}
          </p>
        </div>
      )}

      <PilotsSection />
    </div>
  );
};

export default AnalyticsPage;
