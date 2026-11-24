import React from 'react';
import { appLocale } from '@/lib/appLocale';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SoilTest } from '@/api/fieldRecordsService';
import { useLanguage } from '@/lib/LanguageContext';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { LINE_WIDTH, Y_AXIS_WIDTH, chartGrid, chartMargin, chartTick, lineCursor, seriesColor } from '@/components/charts/chartConfig';
import { formatNumber } from '@/components/charts/chartFormat';
import { ORGANIC_SERIES, organicChange, organicRows, recordedSeries } from './soilTestModel';

const formatDate = (value: string | number) => new Date(`${value}T00:00:00`).toLocaleDateString(appLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
const percent = (value: number | string) => `${formatNumber(Number(value), 2)}%`;

/**
 * Topsoil organic carbon and organic matter across a field's lab tests, oldest first, with the
 * change from the first test to the latest. Each series keeps its slot colour even when the
 * other is missing.
 */
export const SoilCarbonChart: React.FC<{ tests: SoilTest[] }> = ({ tests }) => {
  const { t } = useLanguage();
  const rows = organicRows(tests);
  const series = recordedSeries(rows);
  const label = (key: (typeof ORGANIC_SERIES)[number]) => t(key.labelKey, { defaultValue: key.label });
  const changes = series.map(s => organicChange(rows, s.key)).filter(change => change !== null);

  return (
    <ChartFrame
      title={t('soil_organic_trend_title', { defaultValue: 'Organic carbon and matter over the years' })}
      description={t('soil_organic_trend_desc', { defaultValue: 'From the lab results recorded for this field, in percent of soil weight.' })}
      legend={series.map(s => ({ label: label(s), color: seriesColor(ORGANIC_SERIES.indexOf(s)) }))}
      isEmpty={rows.length === 0}
      empty={{
        title: t('soil_organic_trend_empty', { defaultValue: 'No organic carbon or matter results yet' }),
        hint: t('soil_organic_trend_empty_hint', { defaultValue: 'Add lab results that report them; two tests a year or more apart show the change.' }),
      }}
      height={220}
      table={{
        rows,
        columns: [
          { key: 'testedAt', label: t('soil_test_date', { defaultValue: 'Tested' }), format: row => formatDate(row.testedAt as string) },
          ...series.map(s => ({ key: s.key, label: label(s), numeric: true, format: (row: SoilTest) => (row[s.key] === null ? '' : percent(row[s.key] as number)) })),
        ],
      }}
      footer={
        changes.length > 0 && (
          <ul className="space-y-1 text-sm text-slate-700 dark:text-theme-text-secondary">
            {changes.map(change => (
              <li key={change.key} className="tabular-nums">
                {t('soil_organic_change', {
                  defaultValue: '{name}: {from} on {fromDate} to {to} on {toDate} ({change} percentage points)',
                  name: label(ORGANIC_SERIES.find(s => s.key === change.key)!),
                  from: percent(change.first.value),
                  fromDate: formatDate(change.first.date),
                  to: percent(change.last.value),
                  toDate: formatDate(change.last.date),
                  change: `${change.change > 0 ? '+' : ''}${formatNumber(change.change, 2)}`,
                })}
              </li>
            ))}
          </ul>
        )
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={chartMargin}>
          <CartesianGrid {...chartGrid} />
          <XAxis dataKey="testedAt" axisLine={false} tickLine={false} tick={chartTick} minTickGap={24} tickFormatter={formatDate} />
          <YAxis axisLine={false} tickLine={false} tick={chartTick} width={Y_AXIS_WIDTH} tickFormatter={value => `${formatNumber(Number(value), 1)}%`} />
          <Tooltip cursor={lineCursor} content={<ChartTooltip labelFormatter={formatDate} valueFormatter={percent} />} />
          {series.map(s => (
            <Line key={s.key} type="linear" dataKey={s.key} name={label(s)} stroke={seriesColor(ORGANIC_SERIES.indexOf(s))} strokeWidth={LINE_WIDTH} dot={{ r: 4 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
};
