import React from 'react';
import { Languages } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import type { TranslatedTexts } from '@/hooks/useTranslatedTexts';

/**
 * Says that generated text was translated by machine, with a switch back to the original:
 * product names and doses must be checked against it. Shows nothing when nothing was translated.
 */
export const TranslationNotice: React.FC<{ translation: TranslatedTexts }> = ({ translation }) => {
  const { t } = useLanguage();
  if (translation.pending) {
    return <p className="text-xs text-slate-600 dark:text-theme-text-muted">{t('diag_translating', 'Translating…')}</p>;
  }
  if (translation.failed) {
    return (
      <p className="text-xs text-slate-600 dark:text-theme-text-muted">
        {t('diag_translation_failed', 'Could not translate this, so it is shown in English.')}
      </p>
    );
  }
  if (!translation.translated) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-theme-text-muted">
      <Languages className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>
        {translation.showOriginal
          ? t('diag_showing_original', 'Showing the original English.')
          : t('diag_machine_translated', 'Translated by machine. Check product names and doses against the original.')}
      </span>
      <button
        type="button"
        onClick={() => translation.setShowOriginal(!translation.showOriginal)}
        className="font-medium text-emerald-700 hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
      >
        {translation.showOriginal ? t('diag_show_translation', 'Show translation') : t('diag_show_original', 'Show original')}
      </button>
    </p>
  );
};
