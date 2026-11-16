import React from 'react';
import { BarChart3, Radio } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
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
      {/* ── Top Bento Banner: Analytics & Velocity Hub ── */}
      <div className="backdrop-blur-xl bg-white/95 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-xl p-6 shadow-sm dark:shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">System Analytics</h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  <Radio className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                  Last 30 days
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-white/60 mt-0.5">
                Support performance, commodity prices and daily activity for your farmers.
              </p>
            </div>
          </div>

        </div>
      </div>

      {performanceData ? (
        <>
          <KpiTiles metrics={performanceData.metrics} t={t} />

          {/* ── Market Prices Full-Width Trend Card ── */}
          <MarketPriceTrendCard />

          {/* ── Activity Timeline Chart Card ── */}
          <div className="backdrop-blur-xl bg-white/95 dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/5">
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {t('analytics_activity_timeline') || 'Activity & Advisory Timeline'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-white/50">
                  Completed field visits and new farmer conversations per day, all channels.
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                  <span className="text-slate-700 dark:text-white/70">Field visits</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500 dark:bg-sky-400" />
                  <span className="text-slate-700 dark:text-white/70">Conversations</span>
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
