import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { useHowSure } from '@/hooks/useHowSure';
import { useTranslatedTexts } from '@/hooks/useTranslatedTexts';
import { TranslationNotice } from './TranslationNotice';

export interface PossibleCauseProps {
  disease: string;
  /** 0–1, as the check reported it. */
  confidence: number;
  /**
   * How serious the problem looks, where the check judged that (photo checks). Symptom
   * checks report how well the signs matched in this field, so they leave it out.
   */
  severity?: string;
  description: string;
  /** Signs of this disease the check reported, if any. */
  symptoms?: string[];
  safetyNotice: string;
  /** True only when a checked source backs this and no expert review is pending. */
  confirmedBySource: boolean;
  onMore?: () => void;
}

const SERIOUSNESS: Record<string, { key: string; english: string; tone: string }> = {
  mild: { key: 'diag_serious_mild', english: 'mild', tone: 'text-emerald-800 dark:text-emerald-300 bg-emerald-500/10' },
  moderate: { key: 'diag_serious_moderate', english: 'moderate', tone: 'text-amber-800 dark:text-amber-300 bg-amber-500/10' },
  severe: { key: 'diag_serious_severe', english: 'severe', tone: 'text-rose-800 dark:text-rose-300 bg-rose-500/10' },
};

/**
 * One thing a symptom or photo check thinks the problem could be, said the way an
 * officer would: "Might be late blight", how sure, how serious, what it is, and the
 * reminder to confirm before treating.
 */
export const PossibleCause: React.FC<PossibleCauseProps> = ({
  disease,
  confidence,
  severity,
  description,
  symptoms,
  safetyNotice,
  confirmedBySource,
  onMore,
}) => {
  const { t } = useLanguage();
  const howSure = useHowSure();
  const seriousness = severity ? SERIOUSNESS[severity.toLowerCase()] : undefined;
  // What the check wrote is in English; it is shown in the app language, with the original a tap away.
  const translation = useTranslatedTexts([disease, description, safetyNotice, ...(symptoms ?? [])]);
  const [shownDisease, shownDescription, shownNotice, ...shownSymptoms] = translation.texts;
  // The English name stays beside a translated one: it is the name in sources and on product labels.
  const diseaseName = shownDisease === disease ? disease : `${shownDisease} (${disease})`;
  const name = confirmedBySource
    ? t('diag_looks_like', { defaultValue: 'Looks like {disease}', disease: diseaseName })
    : t('diag_might_be', { defaultValue: 'Might be {disease}', disease: diseaseName });

  return (
    <div className="p-4 rounded-lg bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08] space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary">{name}</h4>
        {seriousness && (
          <span className={`px-2 py-0.5 rounded text-xs ${seriousness.tone}`}>
            {t('diag_how_serious', { defaultValue: 'How serious: {level}', level: t(seriousness.key, seriousness.english) })}
          </span>
        )}
      </div>
      <p className="flex flex-wrap justify-between gap-2 text-xs text-slate-700 dark:text-theme-text-secondary">
        <span>{howSure(confidence)}</span>
        <span className="text-slate-600 dark:text-theme-text-muted">
          {confirmedBySource
            ? t('diag_source_checked', 'From a checked source')
            : t('diag_source_unchecked', 'Not checked by an expert yet')}
        </span>
      </p>
      <p className="text-sm text-slate-800 dark:text-theme-text-secondary leading-relaxed">{shownDescription}</p>
      {shownSymptoms.length > 0 && (
        <p className="text-xs text-slate-700 dark:text-theme-text-secondary">
          {t('diag_signs', { defaultValue: 'Signs: {signs}', signs: shownSymptoms.join('; ') })}
        </p>
      )}
      <p className="flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
        <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
        {shownNotice}
      </p>
      <TranslationNotice translation={translation} />
      {onMore && (
        <div className="pt-2 border-t border-slate-900/[0.08] dark:border-white/[0.08] flex justify-end">
          <button
            type="button"
            onClick={onMore}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            {t('diag_more_about', { defaultValue: 'More about {disease}', disease })}
          </button>
        </div>
      )}
    </div>
  );
};
