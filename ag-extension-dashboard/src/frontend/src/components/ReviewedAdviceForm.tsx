import React, { useState } from 'react';
import { BookPlus, Loader2 } from 'lucide-react';
import { addReviewedAdviceToKnowledge, RecommendationReview } from '@/api/recommendationReviewService';
import { useLanguage } from '@/lib/LanguageContext';

interface ReviewedAdviceFormProps {
  item: RecommendationReview;
  addNotification: (notification: { type: 'info' | 'warning' | 'error' | 'success'; message: string }) => void;
  /** Called when the advice was added, or the reviewer chose not to add it. */
  onDone: () => void;
}

/** Matching the API's limits. */
const MIN_TITLE = 5;
const MIN_ADVICE = 80;

const FIELD_CLASS = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800 dark:border-white/[0.12] dark:bg-theme-bg-primary dark:text-theme-text-primary';
const LABEL_CLASS = 'mt-3 block text-xs font-medium text-slate-700 dark:text-theme-text-secondary';

function apiError(error: unknown): string | undefined {
  return (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
}

/**
 * Shown after advice is approved: the reviewer can correct it and add it to the knowledge
 * base, where it waits for a manager or administrator before it answers anyone's question.
 */
export function ReviewedAdviceForm({ item, addNotification, onDone }: ReviewedAdviceFormProps) {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [crops, setCrops] = useState('');
  const [advice, setAdvice] = useState(item.recommendation);
  const [sources, setSources] = useState('');
  const [saving, setSaving] = useState(false);
  const id = (field: string) => `reviewed-advice-${field}-${item.id}`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (title.trim().length < MIN_TITLE || advice.trim().length < MIN_ADVICE) {
      addNotification({ type: 'warning', message: t('ui_reviewed_advice_too_short') });
      return;
    }
    setSaving(true);
    try {
      await addReviewedAdviceToKnowledge(item.id, {
        title: title.trim(),
        content: advice.trim(),
        crops: crops.split(',').map(crop => crop.trim()).filter(Boolean),
        ...(sources.trim() ? { sources: sources.trim() } : {}),
      });
      addNotification({ type: 'success', message: t('ui_reviewed_advice_added') });
      onDone();
    } catch (error) {
      addNotification({ type: 'error', message: apiError(error) || t('ui_reviewed_advice_failed') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={event => void submit(event)} aria-labelledby={id('heading')} className="mt-3 border-t border-amber-200/80 pt-3 dark:border-amber-800/60">
      <h3 id={id('heading')} className="text-sm font-medium text-slate-900 dark:text-theme-text-primary">{t('ui_reviewed_advice_heading')}</h3>
      <p className="mt-1 text-xs text-slate-600 dark:text-theme-text-secondary">{t('ui_reviewed_advice_explainer')}</p>

      <label htmlFor={id('title')} className={LABEL_CLASS}>{t('ui_reviewed_advice_title')}</label>
      <input id={id('title')} value={title} maxLength={200} onChange={e => setTitle(e.target.value)} placeholder={t('ui_reviewed_advice_title_placeholder')} className={FIELD_CLASS} />

      <label htmlFor={id('crops')} className={LABEL_CLASS}>{t('ui_reviewed_advice_crops')}</label>
      <input id={id('crops')} value={crops} maxLength={300} onChange={e => setCrops(e.target.value)} placeholder={t('ui_reviewed_advice_crops_placeholder')} className={FIELD_CLASS} />

      <label htmlFor={id('text')} className={LABEL_CLASS}>{t('ui_reviewed_advice_text')}</label>
      <textarea id={id('text')} rows={5} maxLength={20000} value={advice} onChange={e => setAdvice(e.target.value)} className={FIELD_CLASS} />

      <label htmlFor={id('sources')} className={LABEL_CLASS}>{t('ui_reviewed_advice_sources')}</label>
      <input id={id('sources')} value={sources} maxLength={2000} onChange={e => setSources(e.target.value)} placeholder={t('ui_reviewed_advice_sources_placeholder')} className={FIELD_CLASS} />

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" disabled={saving} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
          {saving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <BookPlus className="h-3 w-3" aria-hidden="true" />} {t('ui_reviewed_advice_add')}
        </button>
        <button type="button" disabled={saving} onClick={onDone} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50 dark:border-white/[0.12] dark:text-theme-text-primary">
          {t('ui_reviewed_advice_not_now')}
        </button>
      </div>
    </form>
  );
}
