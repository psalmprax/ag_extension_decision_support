import React from 'react';
import { Loader2 } from 'lucide-react';
import type { PerformanceData } from '@/api/analyticsService';
import { useAppStore } from '@/store/useAppStore';
import { lacksPaidAccess } from '@/lib/planAccess';
import { ScoreMeter } from '@/components/charts/ScoreMeter';
import { CardHeading } from '@/components/ui/CardHeading';

export const SupportEfficiencyCard: React.FC<{
  performanceData?: PerformanceData;
  t: (key: string, fallback?: string) => string;
  cardClass: string;
}> = ({ performanceData, t, cardClass }) => {
  // These figures come from Pro analytics, which the server refuses the free plan
  // (unless analytics was granted): without this the card would wait for data that never arrives.
  const freePlan = useAppStore(state => lacksPaidAccess(state.user, 'analytics'));
  const metrics = performanceData?.metrics;
  // null/undefined means nothing was measured yet: say so rather than drawing 0%.
  const rows = [
    {
      name: t('analytics_resolution_rate'),
      value: metrics?.resolutionRate ?? null,
      max: 100,
      label: (v: number) => `${v}%`,
    },
    {
      name: t('analytics_satisfaction_score'),
      value: metrics?.satisfactionScore ?? null,
      max: 5,
      label: (v: number) => `${v} / 5`,
    },
  ];

  return (
    <div className={`${cardClass} p-4 sm:p-6 lg:p-8`}>
      <CardHeading title={t('analytics_support_efficiency')} subtitle={t('dash_support_subtitle')} className="mb-4 sm:mb-6" />
      {freePlan ? (
        <p className="text-sm text-slate-600 dark:text-white/60">{t('dash_support_efficiency_pro_only')}</p>
      ) : performanceData ? (
        <div className="space-y-4 sm:space-y-6">
          {rows.map(item => (
            <div key={item.name} className="space-y-1.5 sm:space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-theme-text-secondary">{item.name}</span>
                <span className={`text-xs tabular-nums ${item.value === null ? 'text-slate-600 dark:text-theme-text-muted' : 'font-medium text-slate-900 dark:text-theme-text-primary'}`}>
                  {item.value === null ? t('chart_no_data_yet', 'No data yet') : item.label(item.value)}
                </span>
              </div>
              <ScoreMeter value={item.value} max={item.max} heightClass="h-2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
        </div>
      )}
    </div>
  );
};
