import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import type { PerformanceData } from '@/api/analyticsService';
import { useAppStore } from '@/store/useAppStore';
import { lacksPaidAccess } from '@/lib/planAccess';

export const SupportEfficiencyCard: React.FC<{
  performanceData?: PerformanceData;
  t: (key: string) => string;
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
      progress: metrics?.resolutionRate ?? 0,
      label: (v: number) => `${v}%`,
      color: 'bg-primary-500',
    },
    {
      name: t('analytics_satisfaction_score'),
      value: metrics?.satisfactionScore ?? null,
      progress: (metrics?.satisfactionScore ?? 0) * 20,
      label: (v: number) => `${v} / 5`,
      color: 'bg-slate-500',
    },
  ];

  return (
    <div className={`${cardClass} p-4 sm:p-6 lg:p-8`}>
      <h3 className="text-base sm:text-lg font-headline font-medium text-gray-900 dark:text-white mb-4 sm:mb-6">
        {t('analytics_support_efficiency')}
      </h3>
      {freePlan ? (
        <p className="text-sm text-slate-600 dark:text-white/60">{t('dash_support_efficiency_pro_only')}</p>
      ) : performanceData ? (
        <div className="space-y-4 sm:space-y-6">
          {rows.map((item, i) => (
            <div key={item.name} className="space-y-1.5 sm:space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                <span className="text-xs font-medium tabular-nums text-primary-700 dark:text-primary-400">
                  {item.value === null ? 'No data yet' : item.label(item.value)}
                </span>
              </div>
              <div className="w-full h-1.5 sm:h-1 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.progress}%` }}
                  transition={{ duration: 1, delay: i * 0.1 }}
                  className={`h-full ${item.color} rounded-full`}
                />
              </div>
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
