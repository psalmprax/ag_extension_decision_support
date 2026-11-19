import React from 'react';
import { CalendarClock, ClipboardCheck } from 'lucide-react';
import type { Visit } from '@/types/dashboard';
import { formatCalendarDate } from '@/lib/calendarDate';
import { useLanguage } from '@/lib/LanguageContext';

/** A completed visit's findings and follow-up, as the officer reported them. */
export const VisitReportSummary: React.FC<{ visit: Visit }> = ({ visit }) => {
  const { t } = useLanguage();
  const followUp = visit.followUpDate ?? visit.follow_up_date ?? null;
  const needsFollowUp = Boolean(visit.followUpRequired ?? visit.follow_up_required);
  if (!visit.outcomes && !(needsFollowUp && followUp)) return null;

  return (
    <div className="space-y-1.5 text-xs">
      {visit.outcomes && (
        <p className="flex items-start gap-1.5 text-slate-700 dark:text-white/75">
          <ClipboardCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span className="line-clamp-3">
            <span className="font-medium">{t('ui_visit_report_summary_findings')}</span> {visit.outcomes}
          </span>
        </p>
      )}
      {needsFollowUp && followUp && (
        <p className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
          <CalendarClock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{t('ui_visit_report_summary_follow_up_by')} {formatCalendarDate(followUp)}</span>
        </p>
      )}
    </div>
  );
};
