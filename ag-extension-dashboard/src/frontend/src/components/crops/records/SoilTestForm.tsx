import React, { useState } from 'react';
import { soilTestInputSchema } from '@ag-extension/shared/api';
import type { SoilTestInput } from '@/api/fieldRecordsService';
import { useLanguage } from '@/lib/LanguageContext';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/ui/controlStyles';

const INPUT =
  'w-full h-10 px-3 rounded-md border border-slate-900/[0.12] dark:border-white/[0.12] bg-white dark:bg-white/[0.03] text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-600';

const NUMBER_FIELDS = [
  { key: 'ph', labelKey: 'soil_ph', label: 'pH' },
  { key: 'organicCarbonPct', labelKey: 'soil_organic_carbon_pct', label: 'Organic carbon (%)' },
  { key: 'organicMatterPct', labelKey: 'soil_organic_matter_pct', label: 'Organic matter (%)' },
  { key: 'nitrogenPpm', labelKey: 'soil_nitrogen_ppm', label: 'Nitrogen (ppm)' },
  { key: 'phosphorusPpm', labelKey: 'soil_phosphorus_ppm', label: 'Phosphorus (ppm)' },
  { key: 'potassiumPpm', labelKey: 'soil_potassium_ppm', label: 'Potassium (ppm)' },
] as const;

type Draft = Record<'testedAt' | 'labName' | 'sampleRef' | (typeof NUMBER_FIELDS)[number]['key'], string>;
const EMPTY: Draft = { testedAt: '', labName: '', sampleRef: '', ph: '', organicCarbonPct: '', organicMatterPct: '', nitrogenPpm: '', phosphorusPpm: '', potassiumPpm: '' };

function toInput(draft: Draft): SoilTestInput {
  const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value.replace(',', '.')));
  return {
    testedAt: draft.testedAt,
    labName: draft.labName.trim() || null,
    sampleRef: draft.sampleRef.trim() || null,
    ...Object.fromEntries(NUMBER_FIELDS.map(field => [field.key, numberOrNull(draft[field.key])])),
  } as SoilTestInput;
}

/** One lab result, entered as the lab reported it. Checked with the same rules the server uses. */
export const SoilTestForm: React.FC<{ saving: boolean; onSave: (input: SoilTestInput) => void; onCancel: () => void }> = ({ saving, onSave, onCancel }) => {
  const { t } = useLanguage();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement>) => setDraft(prev => ({ ...prev, [key]: event.target.value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = soilTestInputSchema.safeParse(toInput(draft));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const key = issue?.path[0];
      const numberField = NUMBER_FIELDS.find(f => f.key === key);
      setError(
        key === 'testedAt'
          ? t('soil_test_error_date', { defaultValue: 'Enter the day of the test; it cannot be in the future.' })
          : issue?.code === 'custom'
            ? t('soil_test_error_none', { defaultValue: 'Enter at least one value from the lab report.' })
            : numberField
              ? t('soil_test_error_range', { defaultValue: 'Check {name}: the value is outside what a lab reports.', name: t(numberField.labelKey, { defaultValue: numberField.label }) })
              : t('soil_test_invalid', { defaultValue: 'Check the values and try again.' })
      );
      return;
    }
    setError(null);
    onSave(parsed.data);
  };

  const field = (key: keyof Draft, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`soil-${key}`} className="block text-sm text-slate-600 dark:text-theme-text-secondary mb-1">{label}</label>
      <input id={`soil-${key}`} value={draft[key]} onChange={set(key)} className={INPUT} {...props} />
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4 rounded-md border border-slate-900/[0.08] dark:border-white/[0.08] p-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {field('testedAt', t('soil_test_date', { defaultValue: 'Tested' }), { type: 'date', required: true, max: new Date().toISOString().slice(0, 10) })}
        {field('labName', t('soil_test_lab', { defaultValue: 'Lab' }), { placeholder: t('soil_test_lab_placeholder', { defaultValue: 'Lab name' }) })}
        {field('sampleRef', t('soil_test_sample', { defaultValue: 'Sample reference' }))}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {NUMBER_FIELDS.map(({ key, labelKey, label }) => field(key, t(labelKey, { defaultValue: label }), { inputMode: 'decimal', className: `${INPUT} tabular-nums` }))}
      </div>
      <p className="text-xs text-slate-500 dark:text-theme-text-muted">
        {t('soil_test_form_hint', { defaultValue: 'Enter the values from the lab report; leave out what it did not measure. Organic carbon and organic matter are kept as reported, not converted.' })}
      </p>
      {error && <p className="text-sm text-red-700 dark:text-red-300" role="alert">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>{t('soil_test_save', { defaultValue: 'Save result' })}</button>
        <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>{t('common_cancel', { defaultValue: 'Cancel' })}</button>
      </div>
    </form>
  );
};
