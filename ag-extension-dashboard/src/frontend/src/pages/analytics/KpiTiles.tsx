import type { LucideIcon } from 'lucide-react';
import { Activity, AlertTriangle, Clock, MessageSquare, TrendingUp } from 'lucide-react';
import type { PerformanceMetrics } from '@/api/analyticsService';

interface KpiTileProps {
  label: string;
  icon: LucideIcon;
  tone: string;
  /** Formatted figure, or null when nothing was measured. */
  value: string | null;
  definition: string;
  sample?: string;
}

function KpiTile({ label, icon: Icon, tone, value, definition, sample }: KpiTileProps) {
  return (
    <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <div className={`p-2 rounded-lg border ${tone}`}>
          <Icon className="w-4 h-4" aria-hidden="true" />
        </div>
      </div>
      <div>
        {value === null ? (
          <p className="text-sm font-medium text-slate-500 dark:text-white/50 py-1.5">No data yet</p>
        ) : (
          <p className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight font-mono tabular-nums">
            {value}
          </p>
        )}
        <p className="text-xxs text-slate-500 dark:text-white/40 mt-1">
          {value !== null && sample ? `${definition} · ${sample}` : definition}
        </p>
      </div>
    </div>
  );
}

const count = (n: number | undefined, noun: string) =>
  n === undefined ? undefined : `${n} ${noun}${n === 1 ? '' : 's'}`;
const shown = (v: number | null | undefined, format: (v: number) => string) =>
  v === null || v === undefined ? null : format(v);

/** The five support KPIs. A tile with nothing measured says so instead of showing 0. */
export function KpiTiles({
  metrics,
  t,
}: {
  metrics?: Partial<PerformanceMetrics>;
  t: (key: string, fallback?: string) => string;
}) {
  const samples = metrics?.samples;
  const tiles: KpiTileProps[] = [
    {
      label: t('analytics_resolution_rate', 'Resolution rate'),
      icon: TrendingUp,
      tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      value: shown(metrics?.resolutionRate, v => `${v}%`),
      definition: 'Conversations marked resolved',
      sample: count(samples?.conversations, 'conversation'),
    },
    {
      label: t('analytics_avg_response_time', 'Avg. response time'),
      icon: Clock,
      tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
      value: shown(metrics?.avgResponseTime, v => `${v} min`),
      definition: 'Time to the first reply',
      sample: count(samples?.replied, 'conversation'),
    },
    {
      label: t('analytics_satisfaction_score', 'Satisfaction score'),
      icon: Activity,
      tone: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
      value: shown(metrics?.satisfactionScore, v => `${v} / 5`),
      definition: 'Farmer rating, 1–5',
      sample: count(samples?.ratings, 'rating'),
    },
    {
      label: t('analytics_follow_up_rate', 'Follow-up rate'),
      icon: AlertTriangle,
      tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      value: shown(metrics?.followUpRate, v => `${v}%`),
      definition: 'Completed visits needing a follow-up',
      sample: count(samples?.completedVisits, 'visit'),
    },
    {
      label: t('analytics_first_contact_res', 'First contact resolution'),
      icon: MessageSquare,
      tone: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
      value: shown(metrics?.firstContactResolution, v => `${v}%`),
      definition: "Resolved after the farmer's first message",
      sample: count(samples?.conversations, 'conversation'),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {tiles.map(tile => (
        <KpiTile key={tile.label} {...tile} />
      ))}
    </div>
  );
}
