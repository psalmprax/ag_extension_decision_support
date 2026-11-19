import React from 'react';
import { motion } from 'framer-motion';
import { Clock, ChevronRight, User } from 'lucide-react';
import type { Visit, Farmer } from '@/types/dashboard';
import { visitTypeLabel } from '@/lib/visitType';
import { VisitReportSummary } from './VisitReportSummary';

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300';
    case 'cancelled':
      return 'bg-rose-500/15 border-rose-500/30 text-rose-700 dark:text-rose-300';
    default:
      return 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300';
  }
};

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
      : 'Assigned Farmer';
  const visitTypeDisplay = visitTypeLabel(visit.visitType || visit.visit_type);
  const rawDate =
    visit.scheduledAt ||
    visit.scheduled_at ||
    visit.startedAt ||
    visit.started_at ||
    visit.completedAt ||
    visit.completed_at;
  const parsedDate = rawDate && !isNaN(new Date(rawDate).getTime()) ? new Date(rawDate) : null;
  const isUrgent =
    visit.status !== 'completed' &&
    visit.status !== 'cancelled' &&
    (visitTypeDisplay.toLowerCase().includes('urgent') ||
      visitTypeDisplay.toLowerCase().includes('ai'));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.3) }}
      className={`backdrop-blur-xl bg-white/95 dark:bg-slate-900/60 border rounded-xl p-5 flex flex-col justify-between hover:shadow-xl dark:hover:shadow-2xl transition-all relative group min-h-[220px] ${
        isUrgent
          ? 'border-amber-500/40 shadow-lg shadow-amber-950/20'
          : 'border-slate-200 dark:border-white/10 hover:border-emerald-500/30'
      }`}
    >
      <div className="space-y-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white text-base tracking-tight truncate max-w-[170px]">
                {farmerDisplayName}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {visitTypeDisplay}
              </p>
            </div>
          </div>

          <span
            role="status"
            aria-label={`Visit status: ${visit.status}`}
            className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusBadge(visit.status)}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
            {visit.status}
          </span>
        </div>

        {/* Scheduled Date & Time */}
        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5">
          <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          <p className="text-xs font-mono text-slate-700 dark:text-white/80">
            {parsedDate ? (
              <>
                {parsedDate.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}{' '}
                <span className="text-slate-400 dark:text-white/40">@</span>{' '}
                {parsedDate.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </>
            ) : (
              <span className="text-slate-400 dark:text-white/40">Flexible / As Needed</span>
            )}
          </p>
        </div>

        {/* Notes Snippet */}
        {visit.notes && (
          <p className="text-xs text-slate-600 dark:text-white/60 line-clamp-2 leading-relaxed italic">
            "{visit.notes}"
          </p>
        )}

        <VisitReportSummary visit={visit} />
      </div>

      {/* Card Bottom Actions */}
      <div className="mt-4 pt-3.5 border-t border-slate-200/80 dark:border-white/5 flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {visit.status !== 'completed' && visit.status !== 'cancelled' && (
            <>
              <button
                aria-label={`Mark visit for ${farmerDisplayName} as completed`}
                onClick={e => {
                  e.stopPropagation();
                  onComplete(visit, farmerDisplayName);
                }}
                className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-md text-xs font-medium transition-colors"
              >
                Complete
              </button>
              <button
                aria-label={`Cancel visit for ${farmerDisplayName}`}
                onClick={e => {
                  e.stopPropagation();
                  onCancel(visit.id, farmerDisplayName);
                }}
                className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-700 dark:text-rose-300 rounded-md text-xs font-medium transition-colors"
              >
                Cancel
              </button>
            </>
          )}
        </div>

        <button
          aria-label={`View details for farmer ${farmerDisplayName}`}
          onClick={() => {
            if (farmerData) onOpenDetail(farmerData);
          }}
          className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] border border-slate-200 dark:border-white/10 text-slate-600 hover:text-slate-900 dark:text-white/70 dark:hover:text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};
