import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, BarChart3, Info } from 'lucide-react';
import { fetchChurnAnalytics, ChurnAnalytics } from '@/api/billingService';

const REASON_LABELS: Record<string, string> = {
  too_expensive: 'Too expensive',
  not_using_enough: 'Not using it enough',
  missing_features: 'Missing features',
  switching_service: 'Switching to another service',
  poor_support: 'Poor support',
  seasonal_pause: 'Seasonal pause',
  other: 'Other',
};

const formatReason = (reason: string) =>
  REASON_LABELS[reason] ?? reason.replace(/_/g, ' ');

export const ChurnReasons: React.FC = () => {
  const [data, setData] = useState<ChurnAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchChurnAnalytics()
      .then(response => {
        if (!active) return;
        if (response.success && response.data) {
          setData(response.data);
        } else {
          setError(response.error || 'Churn analytics could not be loaded');
        }
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Churn analytics could not be loaded');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const reasons = data?.churnReasons ?? [];
  const coverage = data?.churnReasonCoverage;
  const hasReasons = reasons.length > 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby="churn-reasons-title"
      className="backdrop-blur-xl bg-slate-900/60 border border-white/10 rounded-xl p-6 shadow-xl"
    >
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
          <BarChart3 className="w-6 h-6 text-rose-300" />
        </div>
        <div>
          <h3 id="churn-reasons-title" className="text-xl font-bold tracking-tight text-white">
            Cancellation reasons
          </h3>
          <p className="text-xs text-white/60 mt-0.5">
            Self-reported by subscribers at cancellation, last 30 days
          </p>
        </div>
      </div>

      {loading && (
        <div role="status" className="flex items-center gap-3 text-xs text-white/60">
          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
          <span>Loading churn reasons...</span>
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30">
          <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />
          <p className="text-xs text-rose-200">{error}</p>
        </div>
      )}

      {!loading && !error && !hasReasons && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/10">
          <Info className="w-5 h-5 text-white/50 shrink-0" />
          <p className="text-xs text-white/60 leading-relaxed">
            No cancellation reasons have been recorded in this period. Reasons are only collected when a
            subscriber selects one while cancelling, so this list stays empty until then.
          </p>
        </div>
      )}

      {!loading && !error && hasReasons && (
        <ul className="space-y-4">
          {reasons.map(reason => (
            <li key={reason.reason}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-white">{formatReason(reason.reason)}</span>
                <span className="text-xxs font-mono text-white/60">
                  {reason.count} · {reason.percentage.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-400"
                  style={{ width: `${Math.min(100, Math.max(0, reason.percentage))}%` }}
                  role="img"
                  aria-label={`${formatReason(reason.reason)}: ${reason.percentage.toFixed(1)} percent of recorded reasons`}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && coverage && (
        <p className="mt-5 pt-4 border-t border-white/10 text-xxs text-white/50 leading-relaxed">
          Based on {coverage.recorded} recorded {coverage.recorded === 1 ? 'reason' : 'reasons'} out of{' '}
          {coverage.cancellationsLast30Days} cancellations in the last 30 days. Shares describe the
          feedback received, not all churn.
        </p>
      )}
    </motion.section>
  );
};
