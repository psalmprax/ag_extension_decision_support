import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Check, ChevronUp, Loader2, RefreshCw, X } from 'lucide-react';
import {
  fetchRecommendationReviews,
  RecommendationReview,
  ReviewTrigger,
  updateRecommendationReview,
} from '@/api/recommendationReviewService';
import { useLanguage } from '@/lib/LanguageContext';
import { ReviewedAdviceForm } from '@/components/ReviewedAdviceForm';
import { DictationLabel } from '@/components/voice/DictationButton';
import { appendDictation } from '@/lib/dictationText';

interface RecommendationReviewQueueProps {
  addNotification: (notification: { type: 'info' | 'warning' | 'error' | 'success'; message: string }) => void;
}

type Decision = 'approved' | 'dismissed' | 'escalated';

const TRIGGER_LABEL: Record<ReviewTrigger, string> = {
  safety_boundary: 'Safety guard flagged this advice',
  invalid_references: 'Cited sources it was not given',
  no_sources: 'No supporting sources found',
  farmer_request: 'Farmer asked for a human check',
  officer_edit: 'Officer corrected an AI draft',
};

const DECISION_LABEL: Record<Decision, string> = { approved: 'approved', dismissed: 'dismissed', escalated: 'escalated' };

/** Minimum written reason, matching the API's validation. */
const MIN_REASON = 3;

function errorStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

function errorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { error?: string } } })?.response?.data?.error || fallback;
}

/**
 * AI recommendations awaiting a human check. Each decision needs a written
 * reason, which is stored with the review; the person who submitted an item
 * cannot decide it (the API enforces this and its message is shown). Approved
 * advice stays open so the reviewer can add it to the knowledge base.
 */
export function RecommendationReviewQueue({ addNotification }: RecommendationReviewQueueProps) {
  const { t } = useLanguage();
  const [reviews, setReviews] = useState<RecommendationReview[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'hidden' | 'error'>('loading');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [approvedIds, setApprovedIds] = useState<Set<string>>(() => new Set());

  const removeReview = (id: string) => {
    setReviews(current => current.filter(reviewItem => reviewItem.id !== id));
    setApprovedIds(current => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const loadReviews = useCallback(async () => {
    setState('loading');
    try {
      const response = await fetchRecommendationReviews('pending');
      setReviews(response.data || []);
      setState('ready');
    } catch (error) {
      // 401/403: this user does not review recommendations, so there is nothing to show.
      const status = errorStatus(error);
      setState(status === 401 || status === 403 ? 'hidden' : 'error');
    }
  }, []);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  const decide = async (item: RecommendationReview, decision: Decision) => {
    const reason = (reasons[item.id] || '').trim();
    if (reason.length < MIN_REASON) {
      addNotification({ type: 'warning', message: 'Write the reason for your decision first.' });
      return;
    }
    setActiveId(item.id);
    try {
      await updateRecommendationReview(item.id, decision, reason);
      if (decision === 'approved') setApprovedIds(current => new Set(current).add(item.id));
      else removeReview(item.id);
      addNotification({ type: 'success', message: `Recommendation ${DECISION_LABEL[decision]}.` });
    } catch (error) {
      addNotification({ type: 'error', message: errorMessage(error, 'Unable to update recommendation review.') });
    } finally {
      setActiveId(null);
    }
  };

  if (state === 'hidden' || state === 'loading' || (state === 'ready' && reviews.length === 0)) return null;

  if (state === 'error') {
    return (
      <section role="alert" className="mb-8 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-theme-bg-secondary dark:text-theme-text-primary">
        <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
        <span>{t('ui_recommendation_review_queue_could_not_load_recommendations_await')}</span>
        <button type="button" onClick={() => void loadReviews()} className="ms-auto inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium dark:border-white/[0.12]">
          <RefreshCw className="h-3 w-3" aria-hidden="true" /> {t('users_access_plans_retry')}
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="recommendation-review-heading" className="mb-8 rounded-xl border border-amber-200 bg-amber-50/70 p-5 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div className="mb-4 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div>
          <h2 id="recommendation-review-heading" className="font-medium text-amber-950 dark:text-amber-100">{t('ui_recommendation_review_queue_recommendations_needing_review')}</h2>
          <p className="text-xs text-amber-800/80 dark:text-amber-200/70">{t('ui_recommendation_review_queue_check_ai_guidance_before_it_is_treat')}</p>
        </div>
        <span className="ms-auto rounded-md bg-amber-200 px-2 py-1 font-mono text-xs font-medium text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">{reviews.length - approvedIds.size}</span>
      </div>
      <div className="space-y-3">
        {reviews.map(item => {
          const busy = activeId === item.id;
          const reasonId = `review-reason-${item.id}`;
          return (
            <article key={item.id} aria-label="Recommendation awaiting review" className="rounded-xl border border-amber-200/80 bg-white/80 p-4 dark:border-amber-800/60 dark:bg-theme-bg-secondary/60">
              <div className="flex items-start justify-between gap-3">
                <p className="whitespace-pre-line text-sm text-slate-800 dark:text-theme-text-primary">{item.recommendation}</p>
                <span className="shrink-0 text-xs font-medium text-amber-700 dark:text-amber-300">
                  {item.confidence === null ? 'Unverified' : `${item.confidence}% confidence`}
                </span>
              </div>
              {item.trigger && (
                <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">{t('ui_recommendation_review_queue_queued_because')} {TRIGGER_LABEL[item.trigger]}</p>
              )}
              {approvedIds.has(item.id) ? (
                <ReviewedAdviceForm item={item} addNotification={addNotification} onDone={() => removeReview(item.id)} />
              ) : (
                <>
                  <DictationLabel htmlFor={reasonId} className="block text-xs font-medium text-slate-700 dark:text-theme-text-secondary" rowClassName="mt-3"
                    draftKey={`review-reason:${item.id}`}
                    onTranscript={text => setReasons(current => ({ ...current, [item.id]: appendDictation(current[item.id] || '', text) }))}>
                    {t('ui_recommendation_review_queue_reason_for_your_decision')}
                  </DictationLabel>
                  <textarea
                    id={reasonId}
                    rows={2}
                    maxLength={5000}
                    value={reasons[item.id] || ''}
                    onChange={e => setReasons(current => ({ ...current, [item.id]: e.target.value }))}
                    placeholder="What you checked and what the farmer should be told"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800 dark:border-white/[0.12] dark:bg-theme-bg-primary dark:text-theme-text-primary"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => void decide(item, 'approved')} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Check className="h-3 w-3" aria-hidden="true" />} {t('ui_recommendation_review_queue_approve')}
                    </button>
                    <button type="button" disabled={busy} onClick={() => void decide(item, 'escalated')} className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-800 disabled:opacity-50 dark:border-amber-700 dark:text-amber-200">
                      <ChevronUp className="h-3 w-3" aria-hidden="true" /> {t('ui_recommendation_review_queue_escalate')}
                    </button>
                    <button type="button" disabled={busy} onClick={() => void decide(item, 'dismissed')} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50 dark:border-white/[0.12] dark:text-theme-text-primary">
                      <X className="h-3 w-3" aria-hidden="true" /> {t('ui_recommendation_review_queue_dismiss')}
                    </button>
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
