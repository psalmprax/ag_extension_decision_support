import React from 'react';
import { formatDate } from '@/lib/appLocale';
import { motion } from 'framer-motion';
import { Clock, ChevronRight } from 'lucide-react';
import type { Visit, Farmer } from '@/types/dashboard';
import { visitTypeLabel } from '@/lib/visitType';
import { VisitReportSummary } from './VisitReportSummary';
import { useLanguage } from '@/lib/LanguageContext';
import { formatLabel } from '@/lib/formatLabel';

/** Status shown as a quiet tinted label; the word carries the meaning, not the colour alone. */
const STATUS_TONE: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/[0.12] dark:text-emerald-200',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-theme-text-secondary',
};
const PENDING_TONE = 'bg-amber-50 text-amber-800 dark:bg-amber-400/[0.12] dark:text-amber-200';

const formatWhen = (date: Date) => formatDate(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const ACTION_BUTTON = 'h-9 px-3 rounded-md text-sm transition-colors';

interface VisitCardProps {
  visit: Visit;
  idx: number;
  farmers: Farmer[];
  /** Opens the visit report for this visit. */
  onComplete: (visit: Visit, name: string) => void;
  onCancel: (id: string, name: string) => Promise<void>;
  onOpenDetail: (farmer: Farmer) => void;
}

export const VisitCard: React.FC<VisitCardProps> = ({
  visit,
  idx,
  farmers,
  onComplete,
  onCancel,
  onOpenDetail,
}) => {
  const { t } = useLanguage();
  const farmerId = visit.farmerId || visit.farmer_id;
  const farmerData = farmers.find(
    f => f.id === farmerId || `${f.firstName} ${f.lastName}` === (visit.farmerName || visit.farmer_name)
  );
  const farmerDisplayName =
    typeof visit.farmerName === 'string'
      ? visit.farmerName
      : typeof visit.farmer_name === 'string'
      ? visit.farmer_name
      : farmerData
      ? `${farmerData.firstName} ${farmerData.lastName}`
      : t('visits_unknown_farmer', { defaultValue: 'Farmer not on your list' });
  const visitTypeDisplay = visitTypeLabel(visit.visitType || visit.visit_type);
  const rawDate =
    visit.scheduledAt ||
    visit.scheduled_at ||
    visit.startedAt ||
    visit.started_at ||
    visit.completedAt ||
    visit.completed_at;
  const parsedDate = rawDate && !isNaN(new Date(rawDate).getTime()) ? new Date(rawDate) : null;
  const isOpen = visit.status !== 'completed' && visit.status !== 'cancelled';
  const isUrgent = isOpen && visitTypeDisplay.toLowerCase().includes('urgent');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.2) }}
      className={`bg-white dark:bg-white/[0.03] border rounded-lg p-4 flex flex-col gap-3 ${
        isUrgent ? 'border-amber-600/40' : 'border-slate-900/[0.08] dark:border-white/[0.08]'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-base font-medium text-slate-900 dark:text-white truncate">{farmerDisplayName}</h4>
          <p className="text-sm text-slate-500 dark:text-theme-text-muted">{visitTypeDisplay}</p>
        </div>
        <span
          role="status"
          aria-label={`Visit status: ${visit.status}`}
          className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_TONE[visit.status] ?? PENDING_TONE}`}
        >
          {formatLabel(visit.status)}
        </span>
      </div>

      <p className="flex items-center gap-2 text-sm text-slate-700 dark:text-theme-text-primary tabular-nums">
        <Clock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
        {parsedDate ? formatWhen(parsedDate) : <span className="text-slate-500 dark:text-theme-text-muted">{t('ui_visit_card_flexible_as_needed')}</span>}
      </p>

      {visit.notes && <p className="text-sm text-slate-600 dark:text-theme-text-secondary line-clamp-2">{visit.notes}</p>}

      <VisitReportSummary visit={visit} />

      <div className="mt-auto pt-3 border-t border-slate-900/[0.06] dark:border-white/[0.06] flex items-center gap-2">
        {isOpen && (
          <>
            <button
              aria-label={`Mark visit for ${farmerDisplayName} as completed`}
              onClick={e => {
                e.stopPropagation();
                onComplete(visit, farmerDisplayName);
              }}
              className={`${ACTION_BUTTON} bg-emerald-700 hover:bg-emerald-800 text-white font-medium`}
            >
              {t('ui_farmer_visit_timeline_complete')}
            </button>
            <button
              aria-label={`Cancel visit for ${farmerDisplayName}`}
              onClick={e => {
                e.stopPropagation();
                onCancel(visit.id, farmerDisplayName);
              }}
              className={`${ACTION_BUTTON} text-slate-600 dark:text-theme-text-secondary hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06]`}
            >
              {t('common_cancel')}
            </button>
          </>
        )}
        {farmerData && (
          <button
            aria-label={`View details for farmer ${farmerDisplayName}`}
            onClick={() => onOpenDetail(farmerData)}
            className={`${ACTION_BUTTON} ms-auto inline-flex items-center gap-1 text-slate-600 dark:text-theme-text-secondary hover:bg-slate-900/[0.05] dark:hover:bg-white/[0.06]`}
          >
            {t('visits_open_farmer', { defaultValue: 'Farmer' })}
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </motion.div>
  );
};
