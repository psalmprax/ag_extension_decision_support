import React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { BAR_RADIUS, MAX_BAR_SIZE, Y_AXIS_WIDTH, barCursor, chartGrid, chartMargin, chartTick, seriesColor } from '@/components/charts/chartConfig';
import { formatCompact } from '@/components/charts/chartFormat';
import { formatTrend, priceCurrency, type PriceChartRow } from './marketPriceModel';

/**
 * Producer price per crop, one colour for every bar: the bars compare prices, and the change
 * since the last reading is in the tooltip, the table and the cards below.
 */
export const PriceBarChart: React.FC<{ rows: PriceChartRow[]; sourceLabel: (source: string) => string }> = ({ rows, sourceLabel }) => {
  const { t } = useLanguage();
  const currency = priceCurrency(rows[0]?.formattedPrice);
  const priceLabel = t('market_price', { defaultValue: 'Price' });
  return (
    <ChartFrame
      bare
      title={t('market_price_by_crop', { defaultValue: 'Price by crop' })}
      description={
        currency
          ? t('market_price_by_crop_desc', { defaultValue: 'In {currency} per bag; the bag size is in each crop name.', currency })
          : t('market_price_by_crop_desc_plain', { defaultValue: 'Per bag; the bag size is in each crop name.' })
      }
      isEmpty={rows.length === 0}
      empty={{ title: t('ui_market_price_trend_card_no_price_data_yet') }}
      height={300}
      table={{
        rows,
        columns: [
          { key: 'crop', label: t('market_crop', { defaultValue: 'Crop' }) },
          { key: 'formattedPrice', label: priceLabel, numeric: true },
          { key: 'trendPct', label: t('market_change', { defaultValue: 'Change' }), numeric: true, format: row => formatTrend(row.trendPct) },
          { key: 'source', label: t('market_source', { defaultValue: 'Source' }), format: row => sourceLabel(row.source) },
        ],
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={chartMargin}>
          <CartesianGrid {...chartGrid} />
          <XAxis dataKey="crop" axisLine={false} tickLine={false} tick={chartTick} interval={0} />
          <YAxis axisLine={false} tickLine={false} tick={chartTick} width={Y_AXIS_WIDTH} domain={[0, 'auto']} tickFormatter={formatCompact} />
          <Tooltip
            cursor={barCursor}
            content={<ChartTooltip valueFormatter={(value, _name, row) => `${String(row?.formattedPrice ?? value)} (${formatTrend(Number(row?.trendPct ?? 0))})`} />}
          />
          <Bar dataKey="price" name={priceLabel} fill={seriesColor(0)} radius={BAR_RADIUS} maxBarSize={MAX_BAR_SIZE} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
};
