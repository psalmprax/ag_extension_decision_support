import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronUp, Loader2, X } from 'lucide-react';
import {
  fetchRecommendationReviews,
  RecommendationReview,
  updateRecommendationReview,
} from '@/api/recommendationReviewService';

interface RecommendationReviewQueueProps {
  addNotification: (notification: { type: 'info' | 'warning' | 'error' | 'success'; message: string }) => void;
}

export function RecommendationReviewQueue({ addNotification }: RecommendationReviewQueueProps) {
  const [reviews, setReviews] = useState<RecommendationReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const loadReviews = useCallback(async () => {
    try {
      const response = await fetchRecommendationReviews('pending');
      setReviews(response.data || []);
    } catch {
      setReviews([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const review = async (item: RecommendationReview, status: 'approved' | 'dismissed' | 'escalated') => {
    setActiveId(item.id);
    try {
      await updateRecommendationReview(item.id, status, `Officer disposition: ${status}`);
      setReviews(current => current.filter(reviewItem => reviewItem.id !== item.id));
      addNotification({ type: 'success', message: `Recommendation ${status}.` });
    } catch {
      addNotification({ type: 'error', message: 'Unable to update recommendation review.' });
    } finally {
      setActiveId(null);
    }
  };

  if (isLoading || reviews.length === 0) return null;

  return (
    <section aria-labelledby="recommendation-review-heading" className="mb-8 rounded-2xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div className="mb-4 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div>
          <h2 id="recommendation-review-heading" className="font-bold text-amber-950 dark:text-amber-100">Recommendations needing review</h2>
          <p className="text-xs text-amber-800/80 dark:text-amber-200/70">Verify AI guidance before it is treated as an operational recommendation.</p>
        </div>
        <span className="ml-auto rounded-full bg-amber-200 px-2 py-1 text-xs font-bold text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">{reviews.length}</span>
      </div>
      <div className="space-y-3">
        {reviews.map(item => (
          <article key={item.id} className="rounded-xl border border-amber-200/80 bg-white/80 p-4 dark:border-amber-800/60 dark:bg-slate-900/60">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.recommendation}</p>
              <span className="shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-300">
                {item.confidence === null ? 'Unverified' : `${item.confidence}% confidence`}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={activeId === item.id} onClick={() => void review(item, 'approved')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                {activeId === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Approve
              </button>
              <button type="button" disabled={activeId === item.id} onClick={() => void review(item, 'escalated')} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-50 dark:border-amber-700 dark:text-amber-200">
                <ChevronUp className="h-3 w-3" /> Escalate
              </button>
              <button type="button" disabled={activeId === item.id} onClick={() => void review(item, 'dismissed')} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200">
                <X className="h-3 w-3" /> Dismiss
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
