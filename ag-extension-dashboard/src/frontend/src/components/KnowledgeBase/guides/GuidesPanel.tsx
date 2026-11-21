import { useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { useAppStore } from '@/store/useAppStore';
import { GuideUploadForm } from './GuideUploadForm';
import { GuideReviewList } from './GuideReviewList';
import { ContentGapsList } from './ContentGapsList';

const CARD = 'bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-5 space-y-4';

/** Local guides: officers add them, managers and administrators approve them. */
export function GuidesPanel() {
  const { t } = useLanguage();
  const role = useAppStore(state => state.user?.role);
  const [refreshKey, setRefreshKey] = useState(0);
  const canAdd = role === 'admin' || role === 'regional_manager' || role === 'extension_officer';
  const canReview = role === 'admin' || role === 'regional_manager';
  if (!canAdd) return null;

  return (
    <section className={CARD} aria-labelledby="local-guides-heading">
      <div>
        <h2 id="local-guides-heading" className="text-base font-medium text-slate-900 dark:text-white">
          {t('kb_guides_heading', { defaultValue: 'Local guides' })}
        </h2>
        <p className="text-sm text-slate-600 dark:text-white/70">
          {canReview
            ? t('kb_guides_intro_reviewer', { defaultValue: 'Guides added by officers and pages collected from the web are used in answers only after you approve them.' })
            : t('kb_guides_intro_officer', { defaultValue: 'Add guides written for your area. A manager reviews each one before it is used in answers.' })}
        </p>
      </div>
      <GuideUploadForm onUploaded={() => setRefreshKey(key => key + 1)} />
      {canReview && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-slate-900 dark:text-white">{t('kb_guides_waiting', { defaultValue: 'Waiting for review' })}</h3>
          <GuideReviewList refreshKey={refreshKey} />
          <h3 className="text-sm font-medium text-slate-900 dark:text-white pt-2">{t('kb_gaps_heading', { defaultValue: 'Questions no guide answered (last 90 days)' })}</h3>
          <ContentGapsList />
        </div>
      )}
    </section>
  );
}
