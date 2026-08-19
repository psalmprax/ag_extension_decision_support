import React from 'react';
import { TrendingUp, Clock, Activity, AlertTriangle, MessageSquare, BarChart3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';
import { useThemeClasses } from '@/hooks/useThemeClasses';
import { CH_COLORS } from '@/lib/colors';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { chartTick } from '@/components/charts/chartConfig';

interface AnalyticsPageProps {
  performanceData:
    | {
        metrics?: {
          resolutionRate?: number;
          avgResponseTime?: string | number;
          satisfactionScore?: number;
          followUpRate?: number;
          firstContactResolution?: number;
        };
        timeline?: Array<Record<string, string | number>>;
      }
    | undefined;
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ performanceData }) => {
  const { t } = useLanguage();
  const { headingClass, radiusClass } = useThemeClasses();

  return (
    <div>
      <div className="mb-8">
        <h1 className={`text-3xl font-bold ${headingClass}`}>System Analytics</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 font-medium">
          Detailed breakdown of system throughput and regional activity
        </p>
      </div>

      {performanceData ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="card p-5 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/30 dark:to-primary-900/10 border-primary-200 dark:border-primary-800">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 bg-primary-500/10 ${radiusClass}`}>
                  <TrendingUp className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 uppercase tracking-wide">
                  {t('analytics_resolution_rate')}
                </p>
              </div>
              <p className="text-2xl font-bold text-primary-700 dark:text-primary-300">
                {performanceData?.metrics?.resolutionRate ?? '—'}%
              </p>
            </div>

            <div className="card p-5 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/10 border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 bg-secondary-500/10 ${radiusClass}`}>
                  <Clock className="w-4 h-4 text-secondary-600 dark:text-secondary-400" />
                </div>
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  {t('analytics_avg_response_time')}
                </p>
              </div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {performanceData?.metrics?.avgResponseTime ?? '—'}
              </p>
            </div>

            <div className="card p-5 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/10 border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 bg-primary-500/10 ${radiusClass}`}>
                  <Activity className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                </div>
                <p className="text-xs font-semibold text-green-700 dark:text-green-300 uppercase tracking-wide">
                  {t('analytics_satisfaction_score')}
                </p>
              </div>
              <p className="text-2xl font-bold text-green-700 dark:text-green-300">
                {performanceData?.metrics?.satisfactionScore ?? '—'}
              </p>
            </div>

            <div className="card p-5 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-900/10 border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 bg-orange-500/10 ${radiusClass}`}>
                  <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-300 uppercase tracking-wide">
                  {t('analytics_follow_up_rate')}
                </p>
              </div>
              <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                {performanceData?.metrics?.followUpRate ?? '—'}%
              </p>
            </div>

            <div className="card p-5 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-900/10 border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 bg-purple-500/10 ${radiusClass}`}>
                  <MessageSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <p className="text-xs font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wide">
                  {t('analytics_first_contact_res')}
                </p>
              </div>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                {performanceData?.metrics?.firstContactResolution ?? '—'}%
              </p>
            </div>
          </div>

          <div className="card p-8 mb-8 bg-theme-bg-card dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
              {t('analytics_activity_timeline')}
            </h3>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={performanceData?.timeline || []}>
                  <defs>
                    <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-green)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--color-chart-green)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorQueries" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-blue)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--color-chart-blue)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartTick} />
                  <YAxis axisLine={false} tickLine={false} tick={chartTick} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="visits"
                    stroke="var(--color-chart-green)"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorVisits)"
                  />
                  <Area
                    type="monotone"
                    dataKey="queries"
                    stroke={CH_COLORS.blue}
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorQueries)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BarChart3 className="w-16 h-16 text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300 mb-2">
            {t('analytics_no_data') || 'No Analytics Data Available'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            {t('analytics_no_data_desc') ||
              'Analytics data will appear here once there is sufficient activity. Check back later or ensure the analytics service is running.'}
          </p>
        </div>
      )}
    </div>
  );
};
