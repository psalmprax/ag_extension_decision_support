import React from 'react';
import type { DiseaseDiagnosis } from '@/api/diseaseService';
import { useLanguage } from '@/lib/LanguageContext';
import { useTranslatedTexts } from '@/hooks/useTranslatedTexts';
import { TranslationNotice } from './TranslationNotice';

/** The leaf scanner's cloud result in short: the likeliest cause and its guidance, in the app language. */
export const CloudCropSummary: React.FC<{ overallHealth: string; diseases: DiseaseDiagnosis[] }> = ({ overallHealth, diseases }) => {
  const { t } = useLanguage();
  const top = diseases[0];
  const treatment = top?.treatment ?? [];
  const translation = useTranslatedTexts([top?.disease ?? overallHealth, ...treatment]);
  const [shownName, ...shownTreatment] = translation.texts;

  return (
    <div className="space-y-1.5 text-xs text-slate-300">
      <div className="flex justify-between items-center">
        <span className="font-medium text-white">
          {top ? (shownName === top.disease ? top.disease : `${shownName} (${top.disease})`) : t('diag_plant_health', { defaultValue: 'Plant health: {health}', health: shownName })}
        </span>
        {top && (
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
            {Math.round(top.confidence * 100)}{t('ui_edge_vision_scanner_modal_model_confidence')}
          </span>
        )}
      </div>
      {shownTreatment.length > 0 && (
        <p className="text-slate-300 text-[11px]">
          <strong className="text-emerald-400">{t('ui_edge_vision_scanner_modal_guidance')}</strong>{' '}
          {shownTreatment.join('; ')}
        </p>
      )}
      <TranslationNotice translation={translation} />
    </div>
  );
};
