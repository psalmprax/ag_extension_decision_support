import React from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { RankedBars, type RankedBarRow } from '@/components/charts/RankedBars';
import { formatNumber } from '@/components/charts/chartFormat';

interface YieldRecord {
  month?: string;
  crop?: string;
  yield?: number;
}

/** The farmer's recorded yields in the order they were recorded, in tonnes per hectare. */
export const FarmerYieldList: React.FC<{ records: unknown }> = ({ records }) => {
  const { t } = useLanguage();
  const rows: RankedBarRow[] = (Array.isArray(records) ? (records as YieldRecord[]) : []).flatMap((record, index) => {
    const value = Number(record?.yield);
    if (!Number.isFinite(value)) return [];
    const label = record.month || record.crop || t('farmer_yield_record', { defaultValue: 'Record {n}', n: index + 1 });
    return [{ label, value }];
  });

  return (
    <ChartFrame
      title={t('farmer_yields_title', { defaultValue: 'Recorded yields' })}
      description={t('farmer_yields_desc', { defaultValue: 'Tonnes per hectare, oldest first.' })}
      isEmpty={rows.length === 0}
      empty={{
        title: t('viz_yield_empty', { defaultValue: 'No harvests recorded yet' }),
        hint: t('farmer_yields_empty_hint', { defaultValue: 'Your officer records each harvest; it appears here.' }),
      }}
    >
      <RankedBars rows={rows} sort={false} label={t('farmer_yields_title', { defaultValue: 'Recorded yields' })} formatValue={value => `${formatNumber(value, 1)} t/ha`} />
    </ChartFrame>
  );
};
