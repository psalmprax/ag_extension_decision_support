import type { LucideIcon } from 'lucide-react';
import { Activity, CheckCircle, Clock, XCircle } from 'lucide-react';
import type { QueueStatus } from '@/api/agentService';
import { passRateLabel } from '@/lib/rates';

interface QueueStatCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  caption: string;
  iconClass: string;
  valueClass: string;
}

function QueueStatCard({
  icon: Icon,
  label,
  value,
  caption,
  iconClass,
  valueClass,
}: QueueStatCardProps) {
  return (
    <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.08] shadow-sm space-y-1">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-medium">
        <Icon className={`w-3.5 h-3.5 ${iconClass}`} />
        <span>{label}</span>
      </div>
      <div
        className={`text-xl font-semibold font-mono tabular-nums flex items-baseline gap-2 ${valueClass}`}
      >
        {value}
        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{caption}</span>
      </div>
    </div>
  );
}

/** The four queue counters from the orchestrator. Every caption is derived from real counts. */
export function QueueStats({ status }: { status: QueueStatus }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <QueueStatCard
        icon={Clock}
        label="Queued tasks"
        value={status.queued}
        caption="Waiting"
        iconClass="text-amber-500 dark:text-amber-400"
        valueClass="text-amber-600 dark:text-amber-400"
      />
      <QueueStatCard
        icon={Activity}
        label="Active workers"
        value={status.active}
        caption="Running now"
        iconClass="text-sky-500 dark:text-sky-400"
        valueClass="text-sky-600 dark:text-sky-400"
      />
      <QueueStatCard
        icon={CheckCircle}
        label="Completed"
        value={status.completed}
        caption={passRateLabel(status.completed, status.failed)}
        iconClass="text-emerald-500 dark:text-emerald-400"
        valueClass="text-emerald-600 dark:text-emerald-400"
      />
      <QueueStatCard
        icon={XCircle}
        label="Failed"
        value={status.failed}
        caption="After all retries"
        iconClass="text-rose-500 dark:text-rose-400"
        valueClass="text-rose-600 dark:text-rose-400"
      />
    </div>
  );
}
