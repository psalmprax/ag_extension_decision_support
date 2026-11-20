import React from 'react';
import { BarChart3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { PageHeader } from '@/components/ui/PageHeader';
import { useLanguage } from '@/lib/LanguageContext';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { chartTick } from '@/components/charts/chartConfig';
import { MarketPriceTrendCard } from '@/components/MarketPriceTrendCard';
import type { PerformanceData } from '@/api/analyticsService';
import { KpiTiles } from './analytics/KpiTiles';

interface AnalyticsPageProps {
  performanceData: PerformanceData | undefined;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ performanceData }) => {
  const { t } = useLanguage();

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <PageHeader
        title={t('ui_analytics_page_system_analytics')}
        description={t('ui_analytics_page_support_performance_commodity_prices')}
        meta={t('ui_analytics_page_last_30_days')}
      />

      {performanceData ? (
        <>
          <KpiTiles metrics={performanceData.metrics} t={t} />

          {/* ── Market Prices Full-Width Trend Card ── */}
          <MarketPriceTrendCard />

          {/* ── Activity Timeline Chart Card ── */}
          <div className="bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/5">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {t('analytics_activity_timeline') || 'Activity & Advisory Timeline'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-white/50">
                  {t('ui_analytics_page_completed_field_visits_and_new_farme')}
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                  <span className="text-slate-700 dark:text-white/70">{t('ui_analytics_page_field_visits')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 dark:bg-sky-400" />
                  <span className="text-slate-700 dark:text-white/70">{t('ui_analytics_page_conversations')}</span>
                </div>
              </div>
            </div>

            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData?.timeline || []}>
                  <defs>
                    <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartTick} />
                  <YAxis axisLine={false} tickLine={false} tick={chartTick} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="visits"
                    name="Field visits"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorVisits)"
                  />
                  <Area
                    type="monotone"
                    dataKey="queries"
                    name="Conversations"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorQueries)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center backdrop-blur-xl bg-white/80 dark:bg-slate-900/40 border border-slate-200 dark:border-white/10 rounded-xl p-8 shadow-sm">
          <BarChart3 className="w-14 h-14 text-slate-300 dark:text-white/20 mb-4" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
            {t('analytics_no_data') || 'No Analytics Data Available'}
          </h3>
          <p className="text-xs text-slate-600 dark:text-white/50 max-w-sm leading-relaxed">
            {t('analytics_no_data_desc') ||
              'Analytics data will appear here once telemetry activity streams begin. Ensure background sync and advisory workers are running.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
