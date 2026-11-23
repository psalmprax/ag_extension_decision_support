import React from 'react';
import { MapPin, Sprout } from 'lucide-react';
import type { DashboardData } from '@/types/dashboard';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { RankedBars, type RankedBarRow } from '@/components/charts/RankedBars';
import { formatCount } from '@/components/charts/chartFormat';
import { formatLabel } from '@/lib/formatLabel';

type Translate = (key: string, fallback?: string) => string;

const PanelIcon: React.FC<{ icon: typeof Sprout }> = ({ icon: Icon }) => (
  <Icon className="h-[18px] w-[18px] text-slate-500 dark:text-theme-text-muted" strokeWidth={1.5} aria-hidden="true" />
);

/**
 * Crop and regional breakdowns of the account's own farmers, as counts of farmers. No sample
 * rows: an account without farmers gets an empty state (the demo session supplies its own
 * farmer-derived data).
 */
export const DistributionPanels: React.FC<{
  dashboardData?: DashboardData;
  t: Translate;
  cardClass: string;
}> = ({ dashboardData, t, cardClass }) => {
  const farmers = (value: number) => formatCount(value, t('unit_farmer', 'farmer'), t('unit_farmers', 'farmers'));
  const crops: RankedBarRow[] = (dashboardData?.crops ?? []).map(crop => ({
    label: formatLabel(crop.name),
    value: crop.count,
    detail: crop.percentage !== undefined ? `${crop.percentage}%` : undefined,
  }));
  const regions: RankedBarRow[] = (dashboardData?.geography ?? []).map(region => ({
    label: region.region,
    value: region.farmers,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <div className={cardClass}>
        <ChartFrame
          bare
          title={t('dash_crops_grown', 'Crops grown')}
          description={t('dash_crops_grown_desc', 'Farmers growing each crop. A farmer with two crops counts under both.')}
          icon={<PanelIcon icon={Sprout} />}
          isEmpty={crops.length === 0}
          empty={{ title: t('dash_crops_empty', 'No crops recorded yet. They appear here as farmers are registered with their crops.') }}
        >
          <RankedBars rows={crops} label={t('dash_crops_grown', 'Crops grown')} formatValue={farmers} />
        </ChartFrame>
      </div>
      <div className={cardClass}>
        <ChartFrame
          bare
          title={t('stat_regional_distribution', 'Farm locations')}
          description={t('dash_regions_desc', 'Farmers in each region.')}
          icon={<PanelIcon icon={MapPin} />}
          isEmpty={regions.length === 0}
          empty={{ title: t('dash_regions_empty', 'No farmers registered yet. Their regions appear here once they are added.') }}
        >
          <RankedBars rows={regions} label={t('stat_regional_distribution', 'Farm locations')} formatValue={farmers} />
        </ChartFrame>
      </div>
    </div>
  );
};
