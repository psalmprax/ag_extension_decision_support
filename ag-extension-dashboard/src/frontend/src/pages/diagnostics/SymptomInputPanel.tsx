import { useLanguage } from '@/lib/LanguageContext';
import React from 'react';
import { Search, Loader2, X, Plus, Activity } from 'lucide-react';
import { isActionEnter } from '@/lib/keyboard';
import { DictationLabel } from '@/components/voice/DictationButton';
import { useDictationAppend } from '@/hooks/useDictationAppend';

const COMMON_SYMPTOM_PRESETS = [
  'Yellowing leaves',
  'Dark dead spots',
  'White powder on leaves',
  'Wilting',
  'Curled or crinkled leaves',
  'Sores on the stem',
  'Orange powdery bumps (rust)',
  'Mottled, patchy colour',
];

export const SymptomInputPanel: React.FC<{
  cropType: string;
  setCropType: (v: string) => void;
  currentSymptom: string;
  setCurrentSymptom: (v: string) => void;
  symptoms: string[];
  onAddSymptom: (s: string) => void;
  onRemoveSymptom: (s: string) => void;
  onDiagnose: () => void;
  isDiagnosing: boolean;
}> = ({
  cropType,
  setCropType,
  currentSymptom,
  setCurrentSymptom,
  symptoms,
  onAddSymptom,
  onRemoveSymptom,
  onDiagnose,
  isDiagnosing,
}) => {
  const { t } = useLanguage();
  const dictateSymptom = useDictationAppend(currentSymptom, setCurrentSymptom);
  return (
  <div className="p-5 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
        <Activity className="w-4 h-4 text-slate-400" aria-hidden="true" />
        {t('symptoms_title', { defaultValue: 'Describe what you see' })}
      </h3>
    </div>

    <div className="space-y-3">
      <div>
        <label htmlFor="symptom-crop" className="block text-sm text-slate-400 mb-1">
          {t('symptoms_crop', { defaultValue: 'Crop' })}
        </label>
        <input
          id="symptom-crop"
          type="text"
          value={cropType}
          onChange={e => setCropType(e.target.value)}
          placeholder={t('symptoms_crop_placeholder', { defaultValue: 'For example maize, tomato or coffee' })}
          className="w-full px-3 py-2 bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08] rounded-md text-xs text-slate-900 dark:text-white placeholder-slate-600 focus:border-emerald-500/60 transition-colors"
        />
      </div>

      <div>
        <DictationLabel htmlFor="symptom-text" className="block text-sm text-slate-600 dark:text-theme-text-secondary mb-1"
          draftKey="symptom-text" onTranscript={dictateSymptom}>
          {t('symptoms_what', { defaultValue: 'What do you see?' })}
        </DictationLabel>
        <div className="flex gap-2">
          <input
            id="symptom-text"
            type="text"
            value={currentSymptom}
            onChange={e => setCurrentSymptom(e.target.value)}
            onKeyDown={e => isActionEnter(e) && currentSymptom.trim() && onAddSymptom(currentSymptom.trim())}
            placeholder={t('symptoms_what_placeholder', { defaultValue: 'One sign at a time, then Add' })}
            className="flex-1 px-3 py-2 bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08] rounded-md text-xs text-slate-900 dark:text-white placeholder-slate-600 focus:border-emerald-500/60 transition-colors"
          />
          <button
            type="button"
            onClick={() => currentSymptom.trim() && onAddSymptom(currentSymptom.trim())}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5 inline me-1" aria-hidden="true" />
            {t('symptoms_add', { defaultValue: 'Add' })}
          </button>
        </div>
      </div>

      {/* Preset Symptom Chips */}
      <div>
        <p className="text-xs font-medium text-slate-400 mb-1.5">
          {t('symptoms_common', { defaultValue: 'Common signs' })}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_SYMPTOM_PRESETS.map(preset => {
            const isSelected = symptoms.includes(preset);
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={isSelected}
                onClick={() => (isSelected ? onRemoveSymptom(preset) : onAddSymptom(preset))}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  isSelected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-white dark:bg-theme-bg-primary text-slate-400 border-slate-900/[0.08] dark:border-white/[0.08] hover:border-slate-900/[0.08] dark:hover:border-white/[0.08] hover:text-slate-800 dark:hover:text-theme-text-primary'
                }`}
              >
                {preset}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Symptoms Tag Cloud */}
      {symptoms.length > 0 && (
        <div className="pt-2 border-t border-slate-900/[0.08] dark:border-white/[0.08]">
          <p className="text-xs font-medium text-slate-400 mb-1.5">
            {t('symptoms_added', { count: symptoms.length, defaultValue: 'Signs added ({count})' })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {symptoms.map(symptom => (
              <span
                key={symptom}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white dark:bg-theme-bg-primary border border-emerald-500/30 text-emerald-300 text-xs"
              >
                <span>{symptom}</span>
                <button
                  type="button"
                  onClick={() => onRemoveSymptom(symptom)}
                  aria-label={t('symptoms_remove', { symptom, defaultValue: 'Remove {symptom}' })}
                  className="text-slate-500 hover:text-rose-400"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>

    <button
      onClick={onDiagnose}
      disabled={symptoms.length === 0 || isDiagnosing}
      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
    >
      {isDiagnosing ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-slate-900 dark:text-white" />
          <span>{t('symptoms_checking', { defaultValue: 'Checking…' })}</span>
        </>
      ) : (
        <>
          <Search className="w-4 h-4" />
          <span>{t('symptoms_check', { count: symptoms.length, defaultValue: 'Check symptoms ({count})' })}</span>
        </>
      )}
    </button>
  </div>
  );
};
