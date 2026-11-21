import { useLanguage } from '@/lib/LanguageContext';

export interface DiagnosisValidation {
  status: 'tested' | 'below_threshold' | 'not_tested';
  samples: number;
  accuracy: number | null;
}

/** How the diagnosis did on labelled photos of this crop and problem, in one plain line. */
export function DiagnosisValidationNote({ validation }: { validation?: DiagnosisValidation | null }) {
  const { t } = useLanguage();
  if (!validation) return null;
  const right = validation.accuracy === null ? 0 : Math.round(validation.accuracy * 100);
  const text = validation.status === 'tested'
    ? t('diag_note_tested', { samples: validation.samples, right, defaultValue: 'Tested on {samples} labelled photos of this crop and problem: right {right}% of the time.' })
    : validation.status === 'below_threshold'
      ? t('diag_note_below', { samples: validation.samples, right, defaultValue: 'On {samples} labelled photos of this crop and problem it was right only {right}% of the time. Ask your officer to confirm before you treat.' })
      : t('diag_note_untested', { defaultValue: 'Not yet tested on labelled photos of this crop and problem. Ask your officer to confirm before you treat.' });
  return (
    <p className={`text-sm ${validation.status === 'tested' ? 'text-slate-700 dark:text-white/80' : 'text-amber-800 dark:text-amber-300'}`} role="note">
      {text}
    </p>
  );
}
