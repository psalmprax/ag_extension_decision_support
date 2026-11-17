import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Users } from 'lucide-react';
import type { DashboardData } from '@/types/dashboard';

interface DistributionRow {
  label: string;
  value: number;
}

const DistributionCard: React.FC<{
  title: string;
  icon: React.ReactNode;
  rows: DistributionRow[];
  emptyText: string;
  barClass: string;
  valueClass: string;
  cardClass: string;
}> = ({ title, icon, rows, emptyText, barClass, valueClass, cardClass }) => {
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div className={cardClass}>
      <div className="flex items-center gap-2 mb-6">
        {icon}
        <h3 className="text-lg font-headline font-semibold text-gray-900 dark:text-white">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">{emptyText}</p>
      ) : (
        <div className="space-y-4">
          {rows.map(row => (
            <div key={row.label}>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{row.label}</span>
                <span className={`text-xs font-semibold tabular-nums ${valueClass}`}>{row.value}</span>
              </div>
              <div className="w-full h-2 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(row.value / max) * 100}%` }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className={`h-full rounded-full ${barClass}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Crop and regional breakdowns of the account's own farmers. No sample rows: an account
 * without farmers gets an empty state (the demo session supplies its own farmer-derived data).
 */
export const DistributionPanels: React.FC<{
  dashboardData?: DashboardData;
  t: (key: string, fallback?: string) => string;
  cardClass: string;
}> = ({ dashboardData, t, cardClass }) => {
  const crops = (dashboardData?.crops ?? []).map(c => ({ label: c.name, value: c.count }));
  const regions = (dashboardData?.geography ?? []).map(r => ({ label: r.region, value: r.farmers }));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <DistributionCard
        title={t('viz_crop_planning', 'Crop Planning')}
        icon={<BarChart3 className="w-5 h-5 text-emerald-500" />}
        rows={crops}
        emptyText={t('dash_crops_empty', 'No crops recorded yet. They appear here as farmers are registered with their crops.')}
        barClass="bg-emerald-500"
        valueClass="text-emerald-700 dark:text-emerald-400"
        cardClass={cardClass}
      />
      <DistributionCard
        title={t('stat_regional_distribution', 'Regional Distribution')}
        icon={<Users className="w-5 h-5 text-primary-500" />}
        rows={regions}
        emptyText={t('dash_regions_empty', 'No farmers registered yet. Their regions appear here once they are added.')}
        barClass="bg-primary-500"
        valueClass="text-primary-700 dark:text-primary-400"
        cardClass={cardClass}
      />
    </div>
  );
};
