import React from 'react';
import { X, Loader2, Leaf, ShieldAlert, ShieldCheck, CheckCircle2, Check } from 'lucide-react';
import type { DiseaseInfo } from '../../api/diseaseService';
import { useLanguage } from '@/lib/LanguageContext';
import { useTranslatedTexts } from '@/hooks/useTranslatedTexts';
import { TranslationNotice } from '@/components/diagnosis/TranslationNotice';

interface Props {
  selectedDisease: string | null;
  setSelectedDisease: (disease: string | null) => void;
  isLoadingInfo: boolean;
  diseaseInfo: DiseaseInfo | null;
  radiusClass: string;
}

export function DiseaseInfoModal({
  selectedDisease,
  setSelectedDisease,
  isLoadingInfo,
  diseaseInfo,
  radiusClass: _radiusClass,
}: Props) {
  const { t } = useLanguage();
  // The disease details are in English; they are shown in the app language, with the original a tap away.
  const info = diseaseInfo ?? { description: '', symptoms: [], treatment: [], prevention: [] };
  const translation = useTranslatedTexts(diseaseInfo ? [info.description, ...info.symptoms, ...info.treatment, ...info.prevention] : []);
  const [shownDescription, ...lists] = translation.texts;
  const shownSymptoms = lists.slice(0, info.symptoms.length);
  const shownTreatment = lists.slice(info.symptoms.length, info.symptoms.length + info.treatment.length);
  const shownPrevention = lists.slice(info.symptoms.length + info.treatment.length);
  if (!selectedDisease) return null;

  return (
    <div className="fixed inset-0 bg-white dark:bg-theme-bg-primary backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08] rounded-[4px] max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-xl backdrop-blur-2xl text-slate-900 dark:text-theme-text-primary">
        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-900/[0.08] dark:border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[3px] bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                <Leaf className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-medium">
                  {t('ui_disease_info_modal_pathology_protocol_dossier')}
                </span>
                <h3 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary">
                  {selectedDisease}
                </h3>
              </div>
            </div>
            <button
              onClick={() => setSelectedDisease(null)}
              className="p-1.5 rounded-[3px] bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] text-slate-600 dark:text-theme-text-muted hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isLoadingInfo ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-700 dark:text-emerald-400" />
            </div>
          ) : diseaseInfo ? (
            <div className="space-y-3.5">
              <TranslationNotice translation={translation} />
              {/* Description Pod */}
              <div className="p-3.5 rounded-[4px] bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] space-y-1">
                <h4 className="text-xs font-mono font-medium text-slate-600 dark:text-theme-text-muted">
                  {t('ui_disease_info_modal_agronomic_pathology_summary')}
                </h4>
                <p className="text-xs text-slate-700 dark:text-theme-text-secondary leading-relaxed">{shownDescription}</p>
              </div>

              {/* Symptoms Pod */}
              <div className="p-3.5 rounded-[4px] bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] space-y-2">
                <h4 className="text-xs font-mono font-medium text-slate-600 dark:text-theme-text-muted flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-800 dark:text-amber-300" />
                  {t('ui_disease_info_modal_key_identifying_symptoms')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {shownSymptoms.map((symptom, index) => (
                    <div
                      key={index}
                      className="p-2 rounded-[3px] bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08] text-xs text-slate-700 dark:text-theme-text-secondary flex items-start gap-1.5"
                    >
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium">•</span>
                      <span>{symptom}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Treatment Pod */}
              <div className="p-3.5 rounded-[4px] bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] space-y-2">
                <h4 className="text-xs font-mono font-medium text-slate-600 dark:text-theme-text-muted flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  {t('ui_disease_info_modal_treatment_guidance')}
                </h4>
                <div className="space-y-1.5">
                  {shownTreatment.map((treatment, index) => (
                    <div
                      key={index}
                      className="p-2 rounded-[3px] bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08] text-xs text-slate-700 dark:text-theme-text-secondary flex items-start gap-2"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{treatment}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prevention Pod */}
              <div className="p-3.5 rounded-[4px] bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08] space-y-2">
                <h4 className="text-xs font-mono font-medium text-slate-600 dark:text-theme-text-muted">
                  {t('ui_disease_info_modal_prevention_guidance')}
                </h4>
                <div className="space-y-1.5">
                  {shownPrevention.map((prevent, index) => (
                    <div
                      key={index}
                      className="p-2 rounded-[3px] bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08] text-xs text-slate-700 dark:text-theme-text-secondary flex items-start gap-2"
                    >
                      <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-600 dark:text-theme-text-muted" aria-hidden="true" />
                      <span>{prevent}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs font-mono text-center text-rose-700 dark:text-rose-400 py-8">
              {t('ui_disease_info_modal_failed_to_load_pathology_dossier_inf')}
            </p>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-slate-900/[0.08] dark:border-white/[0.08] flex justify-end">
            <button
              onClick={() => setSelectedDisease(null)}
              className="px-4 py-2 bg-slate-50 dark:bg-theme-bg-secondary hover:bg-slate-100 dark:hover:bg-white/[0.06] border border-slate-900/[0.08] dark:border-white/[0.08] text-slate-700 dark:text-theme-text-secondary text-xs font-medium rounded-[3px] transition-colors"
            >
              {t('ui_recommendation_review_queue_dismiss')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
