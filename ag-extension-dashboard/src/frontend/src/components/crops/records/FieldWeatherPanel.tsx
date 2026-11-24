import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CloudRain, Loader2, Sun } from 'lucide-react';
import { fieldRecordsService, type FieldWeather } from '@/api/fieldRecordsService';
import { useLanguage } from '@/lib/LanguageContext';
import { getApiErrorMessage } from '@/lib/apiError';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { ChartTooltip } from '@/components/charts/ChartTooltip';
import { BAR_RADIUS, LINE_WIDTH, MAX_BAR_SIZE, Y_AXIS_WIDTH, barCursor, chartGrid, chartMargin, chartTick, lineCursor, seriesColor } from '@/components/charts/chartConfig';
import { formatDay, formatNumber } from '@/components/charts/chartFormat';

type Day = FieldWeather['days'][number];

function totals(weather: FieldWeather) {
  const rainDays = weather.days.filter(day => day.rainMm !== null);
  const solarDays = weather.days.filter(day => day.solarMjM2 !== null);
  return {
    rainMm: rainDays.reduce((sum, day) => sum + (day.rainMm as number), 0),
    rainDays: rainDays.length,
    solarAvg: solarDays.length ? solarDays.reduce((sum, day) => sum + (day.solarMjM2 as number), 0) / solarDays.length : null,
    solarDays: solarDays.length,
  };
}

/**
 * The last 30 days of rainfall and solar radiation at a field, from NASA POWER: one chart per
 * measure (they have different units), with the totals and the last day published.
 */
export const FieldWeatherPanel: React.FC<{ fieldId: string; hasLocation: boolean }> = ({ fieldId, hasLocation }) => {
  const { t } = useLanguage();
  const { data, isLoading, error } = useQuery({
    queryKey: ['field-weather', fieldId],
    queryFn: () => fieldRecordsService.weather(fieldId),
    enabled: hasLocation,
    staleTime: 60 * 60 * 1000,
    retry: false,
  });

  if (!hasLocation) {
    return <p className="py-6 text-sm text-slate-600 dark:text-theme-text-secondary">{t('weather_needs_location', { defaultValue: 'Add the field’s location, or map its boundary, to see the weather there.' })}</p>;
  }
  if (isLoading) {
    return (
      <div className="flex justify-center py-10" role="status">
        <Loader2 className="w-5 h-5 animate-spin text-slate-500" aria-label={t('loading', { defaultValue: 'Loading' })} />
      </div>
    );
  }
  if (error || !data) {
    return <p className="py-6 text-sm text-slate-600 dark:text-theme-text-secondary">{getApiErrorMessage(error, t('weather_unavailable', { defaultValue: 'NASA POWER could not be reached. Try again later.' }))}</p>;
  }

  const sum = totals(data);
  const rainLabel = t('weather_rain', { defaultValue: 'Rainfall' });
  const solarLabel = t('weather_solar', { defaultValue: 'Solar radiation' });
  const mm = (value: number | string) => `${formatNumber(Number(value), 1)} mm`;
  const mj = (value: number | string) => `${formatNumber(Number(value), 1)} MJ/m²`;
  const dayColumn = { key: 'date', label: t('chart_col_day', { defaultValue: 'Day' }), format: (row: Day) => formatDay(row.date) };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-700 dark:text-theme-text-secondary">
        {!data.latestDate
          ? t('weather_none_yet', { defaultValue: 'NASA POWER has no values for these days yet.' })
          : data.latestDate < data.to
            ? t('weather_latest', { defaultValue: 'Values up to {date}. NASA POWER publishes each day a few days after it ends, so the last days are still empty.', date: formatDay(data.latestDate) })
            : t('weather_latest_today', { defaultValue: 'Values up to {date}.', date: formatDay(data.latestDate) })}
      </p>

      <ChartFrame
        title={t('weather_rain_title', { defaultValue: 'Daily rainfall' })}
        description={t('weather_rain_total', { defaultValue: '{total} over {days} days with values', total: mm(sum.rainMm), days: sum.rainDays })}
        icon={<CloudRain className="w-4 h-4 text-slate-500" aria-hidden="true" />}
        isEmpty={sum.rainDays === 0}
        empty={{ title: t('weather_no_rain_values', { defaultValue: 'No rainfall values for this period yet' }) }}
        height={180}
        table={{ rows: data.days, columns: [dayColumn, { key: 'rainMm', label: `${rainLabel} (mm)`, numeric: true, format: row => (row.rainMm === null ? '' : mm(row.rainMm)) }] }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.days} margin={chartMargin}>
            <CartesianGrid {...chartGrid} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartTick} minTickGap={24} tickFormatter={formatDay} />
            <YAxis axisLine={false} tickLine={false} tick={chartTick} width={Y_AXIS_WIDTH} tickFormatter={value => formatNumber(Number(value), 0)} />
            <Tooltip cursor={barCursor} content={<ChartTooltip labelFormatter={formatDay} valueFormatter={mm} />} />
            <Bar dataKey="rainMm" name={rainLabel} fill={seriesColor(0)} radius={BAR_RADIUS} maxBarSize={MAX_BAR_SIZE} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      <ChartFrame
        title={t('weather_solar_title', { defaultValue: 'Daily solar radiation' })}
        description={sum.solarAvg === null ? undefined : t('weather_solar_avg', { defaultValue: 'Average {value} a day', value: mj(sum.solarAvg) })}
        icon={<Sun className="w-4 h-4 text-slate-500" aria-hidden="true" />}
        isEmpty={sum.solarDays === 0}
        empty={{ title: t('weather_no_solar_values', { defaultValue: 'No solar radiation values for this period yet' }) }}
        height={180}
        table={{ rows: data.days, columns: [dayColumn, { key: 'solarMjM2', label: `${solarLabel} (MJ/m²/day)`, numeric: true, format: row => (row.solarMjM2 === null ? '' : mj(row.solarMjM2)) }] }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.days} margin={chartMargin}>
            <CartesianGrid {...chartGrid} />
            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartTick} minTickGap={24} tickFormatter={formatDay} />
            <YAxis axisLine={false} tickLine={false} tick={chartTick} width={Y_AXIS_WIDTH} tickFormatter={value => formatNumber(Number(value), 0)} />
            <Tooltip cursor={lineCursor} content={<ChartTooltip labelFormatter={formatDay} valueFormatter={mj} />} />
            <Line type="linear" dataKey="solarMjM2" name={solarLabel} stroke={seriesColor(1)} strokeWidth={LINE_WIDTH} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      <p className="text-xs text-slate-500 dark:text-theme-text-muted">
        {t('weather_source_note', {
          defaultValue: 'Source: NASA POWER, agroclimatology data for {lat}, {lng}. These are estimates for a grid cell tens of kilometres wide around the field, not a weather station on the farm.',
          lat: data.location.latitude.toFixed(4),
          lng: data.location.longitude.toFixed(4),
        })}
      </p>
    </div>
  );
};
