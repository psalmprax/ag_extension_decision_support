import React from 'react';
import { ArrowRight, Cpu, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import type { QueueStatus } from '@/api/agentService';
import { ChartFrame, CHART_CARD } from '@/components/charts/ChartFrame';
import { RankedBars, type RankedBarRow } from '@/components/charts/RankedBars';
import { STATUS_COLOR } from '@/components/charts/chartConfig';
import { formatNumber } from '@/components/charts/chartFormat';

export interface Handoff {
  from: string;
  to: string;
  taskId: string;
  reason: string;
  timestamp: string;
}

const iconClass = 'h-4 w-4 text-slate-500 dark:text-theme-text-muted';

/** Tasks by state, in the order a task moves through them. Colour marks only success and failure. */
const QueuePanel: React.FC<{ status: QueueStatus | null }> = ({ status }) => {
  const { t } = useLanguage();
  const rows: RankedBarRow[] = status
    ? [
        { label: t('agents_queue_queued', { defaultValue: 'Queued' }), value: status.queued, color: STATUS_COLOR.neutral },
        { label: t('agents_queue_active', { defaultValue: 'Running' }), value: status.active, color: STATUS_COLOR.neutral },
        { label: t('agents_queue_completed', { defaultValue: 'Completed' }), value: status.completed, color: STATUS_COLOR.good },
        { label: t('agents_queue_failed', { defaultValue: 'Failed' }), value: status.failed, color: STATUS_COLOR.bad },
      ]
    : [];
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  return (
    <ChartFrame
      title={t('ui_agents_queue_status_telemetry', { defaultValue: 'Task queue' })}
      icon={<Cpu className={iconClass} strokeWidth={1.5} aria-hidden="true" />}
      aside={
        <span className="text-xs tabular-nums text-slate-600 dark:text-theme-text-muted">
          {t('agents_queue_total', { defaultValue: '{count} tasks', count: formatNumber(total, 0) })}
        </span>
      }
      isEmpty={total === 0}
      empty={{
        title: t('agents_queue_empty', { defaultValue: 'No tasks yet' }),
        hint: t('agents_queue_empty_hint', { defaultValue: 'Tasks appear here once an assistant is given work.' }),
      }}
    >
      <RankedBars rows={rows} sort={false} label={t('ui_agents_queue_status_telemetry', { defaultValue: 'Task queue' })} formatValue={value => formatNumber(value, 0)} />
    </ChartFrame>
  );
};

/** Recent handoffs between assistants, newest first, with how many are listed. */
const HandoffPanel: React.FC<{ handoffs: Handoff[] }> = ({ handoffs }) => {
  const { t } = useLanguage();
  return (
    <section className={`${CHART_CARD} flex flex-col gap-4`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-base font-medium text-slate-900 dark:text-white">
          <ShieldCheck className={iconClass} strokeWidth={1.5} aria-hidden="true" />
          {t('ui_agents_autonomous_handoff_stream', { defaultValue: 'Handoffs between assistants' })}
        </h3>
        <span className="text-xs tabular-nums text-slate-600 dark:text-theme-text-muted">
          {t('agents_handoff_count', { defaultValue: '{count} handoffs', count: formatNumber(handoffs.length, 0) })}
        </span>
      </div>
      {handoffs.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-600 dark:text-theme-text-muted">
          {t('agents_handoff_empty', { defaultValue: 'No handoffs yet.' })}
        </p>
      ) : (
        <ul className="max-h-60 space-y-2 overflow-y-auto pe-1 text-xs">
          {handoffs.map((handoff, index) => (
            <li
              key={`${handoff.taskId}-${index}`}
              className="flex items-center justify-between gap-3 rounded-md border border-slate-900/[0.06] dark:border-white/[0.06] bg-slate-50 dark:bg-theme-bg-primary/60 p-3"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 truncate font-medium text-slate-800 dark:text-theme-text-primary">
                  {handoff.from}
                  <ArrowRight className="h-3 w-3 shrink-0 text-slate-400 dark:text-theme-text-muted" aria-hidden="true" />
                  {handoff.to}
                </div>
                <div className="truncate text-slate-600 dark:text-theme-text-muted">
                  {t('ui_agents_task', { taskId: handoff.taskId, reason: handoff.reason })}
                </div>
              </div>
              <time dateTime={handoff.timestamp} className="shrink-0 tabular-nums text-slate-500 dark:text-theme-text-muted">
                {new Date(handoff.timestamp).toLocaleTimeString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/** The task queue and the handoff log, side by side. */
export const AgentActivityPanels: React.FC<{ queueStatus: QueueStatus | null; handoffs: Handoff[] }> = ({ queueStatus, handoffs }) => (
  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
    <QueuePanel status={queueStatus} />
    <HandoffPanel handoffs={handoffs} />
  </div>
);
