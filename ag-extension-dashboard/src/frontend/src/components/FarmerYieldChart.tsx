import React from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Farmer } from '@/types/dashboard';
import { Badge } from './ui/Badge';
import { useLanguage } from '@/lib/LanguageContext';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { LINE_WIDTH, Y_AXIS_WIDTH, chartGrid, chartMargin, chartTick, lineCursor, seriesColor } from '@/components/charts/chartConfig';
import { formatNumber, formatPercent, percentChange } from '@/components/charts/chartFormat';

interface FarmerYieldChartProps {
  farmer: Farmer;
  radiusClass: string;
}

const YIELD_UNIT = 't/ha';
const formatYield = (value: number | string) => `${formatNumber(Number(value), 1)} ${YIELD_UNIT}`;

/** Change from the first to the last recorded harvest, as a badge; nothing when it cannot be worked out. */
const YieldChangeBadge: React.FC<{ history: Array<{ month: string; yield: number }> }> = ({ history }) => {
  const { t } = useLanguage();
  if (history.length < 2) return null;
  const change = percentChange(history[0].yield, history[history.length - 1].yield);
  if (change === null) return null;
  const rounded = Math.round(change * 10) / 10;
  const Icon = rounded < 0 ? TrendingDown : TrendingUp;
  return (
    <Badge variant={rounded > 0 ? 'success' : rounded < 0 ? 'warning' : 'default'} size="sm" className="inline-flex items-center gap-1">
      <Icon className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
      {`${rounded > 0 ? '+' : ''}${formatPercent(rounded)} ${t('viz_yield_since', { defaultValue: 'since {month}', month: history[0].month })}`}
    </Badge>
  );
};

/** A farmer's recorded harvests over time, in tonnes per hectare. */
export const FarmerYieldChart: React.FC<FarmerYieldChartProps> = ({ farmer }) => {
  const { t } = useLanguage();
  const history = (farmer.yieldHistory ?? []).filter(point => Number.isFinite(point.yield));
  const name = t('viz_yield', { defaultValue: 'Yield' });

  return (
    <ChartFrame
      title={t('viz_yield_trends', { defaultValue: 'Yield trends' })}
      description={t('viz_yield_trends_desc', { defaultValue: 'Recorded harvests, in tonnes per hectare.' })}
      aside={<YieldChangeBadge history={history} />}
      isEmpty={history.length === 0}
      empty={{
        title: t('viz_yield_empty', { defaultValue: 'No harvests recorded yet' }),
        hint: t('viz_yield_empty_hint', { defaultValue: 'Yields appear here once a harvest is recorded for this farmer.' }),
      }}
      height={200}
      table={{
        rows: history,
        columns: [
          { key: 'month', label: t('viz_month', { defaultValue: 'Month' }) },
          { key: 'yield', label: `${name} (${YIELD_UNIT})`, numeric: true, format: row => formatNumber(row.yield, 1) },
        ],
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history} margin={chartMargin}>
          <CartesianGrid {...chartGrid} />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={chartTick} />
          <YAxis axisLine={false} tickLine={false} tick={chartTick} width={Y_AXIS_WIDTH} tickFormatter={(value: number) => formatNumber(value, 1)} />
          <Tooltip cursor={lineCursor} content={<ChartTooltip valueFormatter={formatYield} />} />
          <Line type="linear" dataKey="yield" name={name} stroke={seriesColor(0)} strokeWidth={LINE_WIDTH} dot={{ r: 3, strokeWidth: 0, fill: seriesColor(0) }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
};
