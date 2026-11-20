import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/lib/LanguageContext';
import { listPendingGuides, reviewGuide, type PendingGuide } from './guidesApi';

/** Guides waiting for a manager or administrator. Approved guides start grounding answers. */
export function GuideReviewList({ refreshKey }: { refreshKey: number }) {
  const { t } = useLanguage();
  const [guides, setGuides] = useState<PendingGuide[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setGuides(await listPendingGuides());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const decide = async (id: string, verdict: 'approve' | 'reject') => {
    try {
      await reviewGuide(id, verdict);
      setGuides(current => (current ?? []).filter(guide => guide.id !== id));
      toast.success(verdict === 'approve'
        ? t('kb_guide_approved', { defaultValue: 'Guide approved. It is now used in answers.' })
        : t('kb_guide_rejected', { defaultValue: 'Guide removed.' }));
    } catch {
      toast.error(t('kb_guide_review_failed', { defaultValue: 'Could not save the decision. Try again.' }));
    }
  };

  if (failed) return <p className="text-sm text-red-700 dark:text-red-300">{t('kb_guide_list_failed', { defaultValue: 'Could not load guides waiting for review.' })}</p>;
  if (!guides) return <p className="text-sm text-slate-500 dark:text-white/60">{t('kb_guide_loading', { defaultValue: 'Loading guides waiting for review…' })}</p>;
  if (guides.length === 0) return <p className="text-sm text-slate-500 dark:text-white/60">{t('kb_guide_none_pending', { defaultValue: 'No guides are waiting for review.' })}</p>;

  return (
    <ul className="divide-y divide-slate-900/[0.08] dark:divide-white/[0.08]">
      {guides.map(guide => (
        <li key={guide.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{guide.title}</p>
            <p className="text-xs text-slate-500 dark:text-white/60">
              {guide.source ?? t('kb_guide_unknown_source', { defaultValue: 'Source not given' })}, {new Date(guide.updatedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="secondary" onClick={() => void decide(guide.id, 'approve')}>
              <Check className="w-4 h-4" aria-hidden="true" />
              {t('kb_guide_approve', { defaultValue: 'Approve' })}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void decide(guide.id, 'reject')}>
              <X className="w-4 h-4" aria-hidden="true" />
              {t('kb_guide_reject', { defaultValue: 'Remove' })}
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
