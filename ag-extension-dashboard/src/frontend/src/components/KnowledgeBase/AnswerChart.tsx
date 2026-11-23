import React from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { RankedBars } from '@/components/charts/RankedBars';
import {
  BAR_RADIUS,
  LINE_WIDTH,
  MAX_BAR_SIZE,
  Y_AXIS_WIDTH,
  barCursor,
  chartGrid,
  chartMargin,
  chartTick,
  lineCursor,
  seriesColor,
} from '@/components/charts/chartConfig';
import { formatCompact, formatNumber, formatPercent } from '@/components/charts/chartFormat';
import type { Chart } from './types';
import { cleanPoints, type Point } from './answerChartData';

const PLOT_HEIGHT = 240;

const Plot: React.FC<{ type: Chart['type']; points: Point[]; name: string }> = ({ type, points, name }) => {
  const value = (raw: number | string) => formatNumber(Number(raw));
  const axes = (
    <>
      <CartesianGrid {...chartGrid} />
      <XAxis dataKey="label" axisLine={false} tickLine={false} tick={chartTick} minTickGap={8} />
      <YAxis axisLine={false} tickLine={false} tick={chartTick} width={Y_AXIS_WIDTH} tickFormatter={formatCompact} />
    </>
  );
  return (
    <ResponsiveContainer width="100%" height="100%">
      {type === 'bar' ? (
        <BarChart data={points} margin={chartMargin}>
          {axes}
          <Tooltip cursor={barCursor} content={<ChartTooltip valueFormatter={value} />} />
          <Bar dataKey="value" name={name} fill={seriesColor(0)} radius={BAR_RADIUS} maxBarSize={MAX_BAR_SIZE} />
        </BarChart>
      ) : (
        <LineChart data={points} margin={chartMargin}>
          {axes}
          <Tooltip cursor={lineCursor} content={<ChartTooltip valueFormatter={value} />} />
          <Line type="linear" dataKey="value" name={name} stroke={seriesColor(0)} strokeWidth={LINE_WIDTH} dot={{ r: 3, strokeWidth: 0, fill: seriesColor(0) }} activeDot={{ r: 5 }} />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
};

/**
 * A chart from an AI answer. Bars and lines get labelled axes; a "pie" is shown as ranked bars
 * with each share printed, which compares parts more exactly than slices.
 */
export const AnswerChart: React.FC<{ chart: Chart }> = ({ chart }) => {
  const { t } = useLanguage();
  const points = cleanPoints(chart.data);
  const title = chart.title?.trim() || t('answer_chart_untitled', { defaultValue: 'Chart' });
  const valueLabel = t('answer_chart_value', { defaultValue: 'Value' });
  const total = points.reduce((sum, point) => sum + point.value, 0);
  const isShare = chart.type === 'pie';

  return (
    <ChartFrame
      title={title}
      isEmpty={points.length === 0}
      empty={{ title: t('answer_chart_empty', { defaultValue: 'This chart came without usable numbers' }) }}
      height={isShare ? undefined : PLOT_HEIGHT}
      table={{
        rows: points,
        columns: [
          { key: 'label', label: t('answer_chart_item', { defaultValue: 'Item' }) },
          { key: 'value', label: valueLabel, numeric: true },
          ...(isShare && total > 0 ? [{ key: 'share', label: t('answer_chart_share', { defaultValue: 'Share' }), numeric: true, format: (row: Point) => formatPercent((row.value / total) * 100) }] : []),
        ],
      }}
    >
      {isShare ? (
        <RankedBars
          rows={points.map(point => ({ ...point, detail: total > 0 ? formatPercent((point.value / total) * 100) : undefined }))}
          label={title}
        />
      ) : (
        <Plot type={chart.type} points={points} name={valueLabel} />
      )}
    </ChartFrame>
  );
};
