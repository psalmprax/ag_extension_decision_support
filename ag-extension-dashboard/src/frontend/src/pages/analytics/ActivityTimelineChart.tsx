import React from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useLanguage } from '@/lib/LanguageContext';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { LINE_WIDTH, Y_AXIS_WIDTH, chartGrid, chartMargin, chartTick, lineCursor, seriesColor } from '@/components/charts/chartConfig';
import { formatDay, formatNumber } from '@/components/charts/chartFormat';
import { fillActivityDays } from './activityDays';

/** Completed field visits and new farmer conversations per day, over the last 30 days. */
export const ActivityTimelineChart: React.FC<{ timeline: Array<Record<string, string | number>> | undefined }> = ({ timeline }) => {
  const { t } = useLanguage();
  const days = fillActivityDays(timeline ?? [], 30);
  const visits = t('ui_analytics_page_field_visits', { defaultValue: 'Field visits' });
  const conversations = t('ui_analytics_page_conversations', { defaultValue: 'Conversations' });
  const isEmpty = days.every(day => day.visits === 0 && day.queries === 0);
  const whole = (value: number | string) => formatNumber(Number(value), 0);

  return (
    <ChartFrame
      title={t('analytics_activity_timeline', { defaultValue: 'Activity timeline' })}
      description={t('ui_analytics_page_completed_field_visits_and_new_farme')}
      legend={[
        { label: visits, color: seriesColor(0) },
        { label: conversations, color: seriesColor(1) },
      ]}
      isEmpty={isEmpty}
      empty={{
        title: t('analytics_activity_empty', { defaultValue: 'No visits or conversations in the last 30 days' }),
        hint: t('analytics_activity_empty_hint', { defaultValue: 'Completed visits and new farmer conversations are counted here each day.' }),
      }}
      height={320}
      table={{
        rows: days,
        columns: [
          { key: 'date', label: t('chart_col_day', { defaultValue: 'Day' }), format: row => formatDay(row.date) },
          { key: 'visits', label: visits, numeric: true },
          { key: 'queries', label: conversations, numeric: true },
        ],
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={days} margin={chartMargin}>
          <CartesianGrid {...chartGrid} />
          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartTick} tickFormatter={formatDay} minTickGap={24} />
          <YAxis axisLine={false} tickLine={false} tick={chartTick} width={Y_AXIS_WIDTH} allowDecimals={false} tickFormatter={whole} />
          <Tooltip cursor={lineCursor} content={<ChartTooltip labelFormatter={formatDay} valueFormatter={whole} />} />
          <Line type="linear" dataKey="visits" name={visits} stroke={seriesColor(0)} strokeWidth={LINE_WIDTH} dot={false} activeDot={{ r: 4 }} />
          <Line type="linear" dataKey="queries" name={conversations} stroke={seriesColor(1)} strokeWidth={LINE_WIDTH} dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
};
