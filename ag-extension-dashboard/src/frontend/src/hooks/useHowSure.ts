import { useLanguage } from '@/lib/LanguageContext';

/** How sure the check is, in words: a percentage alone reads like a lab result. */
export function certaintyKey(confidence: number): 'diag_sure_high' | 'diag_sure_medium' | 'diag_sure_low' {
  if (confidence >= 0.75) return 'diag_sure_high';
  if (confidence >= 0.5) return 'diag_sure_medium';
  return 'diag_sure_low';
}

const CERTAINTY_ENGLISH = { diag_sure_high: 'fairly sure', diag_sure_medium: 'not sure', diag_sure_low: 'unlikely' } as const;

/** "How sure: fairly sure (82%)", for any check's confidence. */
export function useHowSure(): (confidence: number) => string {
  const { t } = useLanguage();
  return confidence => {
    const key = certaintyKey(confidence);
    const level = t(key, CERTAINTY_ENGLISH[key]);
    return t('diag_how_sure', { defaultValue: 'How sure: {level} ({percent}%)', level, percent: Math.round(confidence * 100) });
  };
}
