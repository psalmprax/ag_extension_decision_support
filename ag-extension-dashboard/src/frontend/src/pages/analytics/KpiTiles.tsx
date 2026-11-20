import type { LucideIcon } from 'lucide-react';
import { Activity, AlertTriangle, Clock, MessageSquare, TrendingUp } from 'lucide-react';
import type { PerformanceMetrics } from '@/api/analyticsService';
import { useLanguage } from '@/lib/LanguageContext';
import { StatTile } from '@/components/ui/StatTile';

interface KpiTileProps {
  label: string;
  icon: LucideIcon;
  /** Formatted figure, or null when nothing was measured. */
  value: string | null;
  definition: string;
  sample?: string;
}

function KpiTile({ label, icon, value, definition, sample }: KpiTileProps) {
  const { t } = useLanguage();
  return (
    <StatTile
      label={label}
      icon={icon}
      value={value}
      emptyText={t('ui_kpi_tiles_no_data_yet')}
      note={value !== null && sample ? `${definition} · ${sample}` : definition}
    />
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
      value: shown(metrics?.resolutionRate, v => `${v}%`),
      definition: 'Conversations marked resolved',
      sample: count(samples?.conversations, 'conversation'),
    },
    {
      label: t('analytics_avg_response_time', 'Avg. response time'),
      icon: Clock,
      value: shown(metrics?.avgResponseTime, v => `${v} min`),
      definition: 'Time to the first reply',
      sample: count(samples?.replied, 'conversation'),
    },
    {
      label: t('analytics_satisfaction_score', 'Satisfaction score'),
      icon: Activity,
      value: shown(metrics?.satisfactionScore, v => `${v} / 5`),
      definition: 'Farmer rating, 1–5',
      sample: count(samples?.ratings, 'rating'),
    },
    {
      label: t('analytics_follow_up_rate', 'Follow-up rate'),
      icon: AlertTriangle,
      value: shown(metrics?.followUpRate, v => `${v}%`),
      definition: 'Completed visits needing a follow-up',
      sample: count(samples?.completedVisits, 'visit'),
    },
    {
      label: t('analytics_first_contact_res', 'First contact resolution'),
      icon: MessageSquare,
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
