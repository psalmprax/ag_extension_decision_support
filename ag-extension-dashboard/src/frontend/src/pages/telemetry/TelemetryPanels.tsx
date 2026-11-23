import React from 'react';
import { Activity, AlertTriangle, Clock, DollarSign } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import type { TelemetryEvent, TelemetrySummary } from '@/api/telemetryService';
import { MetricCard } from '@/components/MetricCard';
import { ChartFrame } from '@/components/charts/ChartFrame';
import { RankedBars, type RankedBarRow } from '@/components/charts/RankedBars';
import { Sparkline } from '@/components/charts/Sparkline';
import { STATUS_COLOR } from '@/components/charts/chartConfig';
import { formatNumber } from '@/components/charts/chartFormat';
import { eventTrends } from './eventTrends';

interface TileProps {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  trend: number[];
  caption: string;
}

const StatTile: React.FC<TileProps> = ({ title, value, icon, trend, caption }) => (
  <div className="card relative flex flex-col justify-between overflow-hidden p-5">
    <MetricCard title={title} value={value} icon={icon} />
    <div className="mt-3 border-t border-slate-900/[0.06] pt-2 dark:border-white/[0.08]">
      {trend.length >= 2 ? <Sparkline values={trend} /> : <div className="h-[28px]" />}
      <p className="mt-1 text-xs text-slate-600 dark:text-theme-text-muted">{caption}</p>
    </div>
  </div>
);

/** The four headline numbers, each with its trend across the loaded events. */
export const TelemetryStatTiles: React.FC<{ summary: TelemetrySummary; events: TelemetryEvent[] }> = ({ summary, events }) => {
  const { t } = useLanguage();
  const trends = eventTrends(events);
  const caption =
    trends.requests.length >= 2
      ? t('telemetry_trend_caption', { defaultValue: 'Trend across the last {count} events', count: formatNumber(events.length, 0) })
      : t('telemetry_trend_none', { defaultValue: 'Not enough events for a trend yet' });
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
      <StatTile title={t('telemetry_total_requests')} value={formatNumber(summary.totalRequests, 0)} icon={Activity} trend={trends.requests} caption={caption} />
      <StatTile title={t('telemetry_avg_response_time')} value={`${formatNumber(summary.avgResponseTimeMs, 0)} ms`} icon={Clock} trend={trends.responseMs} caption={caption} />
      <StatTile title={t('telemetry_error_rate')} value={`${formatNumber(summary.errorRate * 100, 1)}%`} icon={AlertTriangle} trend={trends.errorPercent} caption={caption} />
      <StatTile title={t('telemetry_total_cost')} value={`$${summary.totalCostUsd.toFixed(2)}`} icon={DollarSign} trend={trends.costUsd} caption={caption} />
    </div>
  );
};

/** Requests by outcome and by assistant, as labelled bars with every count shown. */
export const TelemetryBreakdowns: React.FC<{ summary: TelemetrySummary | null; events: TelemetryEvent[] }> = ({ summary, events }) => {
  const { t } = useLanguage();
  const countOf = (status: string) => events.filter(event => event.status === status).length;
  const statusRows: RankedBarRow[] = [
    { label: t('telemetry_success'), value: countOf('success'), color: STATUS_COLOR.good },
    { label: t('telemetry_error'), value: countOf('error'), color: STATUS_COLOR.bad },
    { label: t('telemetry_pending'), value: countOf('pending'), color: STATUS_COLOR.neutral },
  ];
  const agentRows: RankedBarRow[] = Object.entries(summary?.agentUsage ?? {}).map(([agent, count]) => ({ label: agent, value: count }));
  const whole = (value: number) => formatNumber(value, 0);
  const sample = t('telemetry_sample', { defaultValue: 'The last {count} requests loaded on this page.', count: whole(events.length) });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ChartFrame
        title={t('telemetry_request_distribution')}
        description={sample}
        isEmpty={events.length === 0}
        empty={{ title: t('telemetry_requests_empty', { defaultValue: 'No requests recorded yet' }) }}
      >
        <RankedBars rows={statusRows} sort={false} label={t('telemetry_request_distribution')} formatValue={whole} />
      </ChartFrame>
      <ChartFrame
        title={t('telemetry_agent_usage')}
        description={t('telemetry_agent_usage_desc', { defaultValue: 'Requests each assistant has handled.' })}
        isEmpty={agentRows.length === 0}
        empty={{ title: t('telemetry_agents_empty', { defaultValue: 'No assistant has handled a request yet' }) }}
      >
        <RankedBars rows={agentRows} label={t('telemetry_agent_usage')} formatValue={whole} />
      </ChartFrame>
    </div>
  );
};
