import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Loader2 } from 'lucide-react';
import { hasAuthSession } from '@/hooks/useAppAuth';
import { fetchPriceHistory, type PriceHistorySeries } from '@/api/priceService';
import { useLanguage } from '@/lib/LanguageContext';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { LINE_WIDTH, SERIES_COUNT, Y_AXIS_WIDTH, chartGrid, chartMargin, chartTick, lineCursor, seriesColor } from '@/components/charts/chartConfig';
import { formatCompact, formatDay, formatMoney } from '@/components/charts/chartFormat';
import { mergeHistorySeries } from './marketPriceModel';

/** Legend text: the crop, and the period its figures describe when that is known. */
function seriesLabel(series: PriceHistorySeries, observed: string): string {
  return series.observedPeriod ? `${series.crop} (${observed} ${series.observedPeriod})` : series.crop;
}

/**
 * Daily snapshots of the published price per crop over 30 days. Each crop keeps its colour
 * (crops are in alphabetical order); past six crops, the table lists the rest.
 */
export const PriceHistoryChart: React.FC = () => {
  const { t } = useLanguage();
  const { data, isLoading } = useQuery<PriceHistorySeries[]>({
    queryKey: ['analytics-price-history'],
    queryFn: () => fetchPriceHistory(30),
    enabled: hasAuthSession(),
    staleTime: 5 * 60 * 1000,
  });
  const history = useMemo(() => mergeHistorySeries(data), [data]);
  const drawn = history.series.slice(0, SERIES_COUNT);
  const currency = history.series[0]?.currency;
  const money = (value: number | string) => (currency ? formatMoney(Number(value), currency) : formatCompact(Number(value)));
  const observed = t('market_observed', { defaultValue: 'observed' });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" role="status">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500 dark:text-theme-text-muted" aria-label={t('loading', { defaultValue: 'Loading' })} />
      </div>
    );
  }

  return (
    <ChartFrame
      bare
      title={t('ui_market_price_trend_card_30_day_price_history')}
      description={t('ui_market_price_trend_card_local_currency_snapshots_of_publishe')}
      legend={drawn.map((series, index) => ({ label: seriesLabel(series, observed), color: seriesColor(index) }))}
      isEmpty={history.merged.length < 2}
      empty={{
        title: t('ui_market_price_trend_card_history_building'),
        hint: t('ui_market_price_trend_card_snapshots_appear_after_the_first_few'),
      }}
      height={260}
      table={{
        rows: history.merged,
        columns: [
          { key: 'date', label: t('chart_col_day', { defaultValue: 'Day' }), format: row => formatDay(String(row.date)) },
          ...history.series.map(series => ({
            key: series.crop,
            label: series.crop,
            numeric: true,
            format: (row: Record<string, string | number>) => (row[series.crop] === undefined ? '' : money(row[series.crop])),
          })),
        ],
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history.merged} margin={chartMargin}>
          <CartesianGrid {...chartGrid} />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartTick} minTickGap={24} tickFormatter={formatDay} />
          <YAxis axisLine={false} tickLine={false} tick={chartTick} width={Y_AXIS_WIDTH} tickFormatter={formatCompact} />
          <Tooltip cursor={lineCursor} content={<ChartTooltip labelFormatter={formatDay} valueFormatter={money} />} />
          {drawn.map((series, index) => (
            <Line key={series.crop} type="linear" dataKey={series.crop} stroke={seriesColor(index)} strokeWidth={LINE_WIDTH} dot={false} activeDot={{ r: 4 }} connectNulls />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
};
