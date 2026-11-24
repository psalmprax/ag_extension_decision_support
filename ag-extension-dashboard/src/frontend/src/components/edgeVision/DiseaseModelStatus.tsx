import { useEffect, useState } from 'react';
import { FIELD_EVALUATION_FLOOR, rejectedCandidate, type ModelCandidate } from '@/services/edgeModelManifest';
import { useLanguage } from '@/lib/LanguageContext';

const percent = (share: number) => Math.round(share * 100);

/**
 * The disease-model cell of the on-device result: the model that ran, or why none did. When the
 * latest trained model failed field testing, it says so with its score and the score needed.
 */
export function DiseaseModelStatus({ model, confidence }: { model: string | null; confidence: number }) {
  const { t } = useLanguage();
  const [candidate, setCandidate] = useState<ModelCandidate | null>(null);

  useEffect(() => {
    if (model) return undefined;
    let live = true;
    void rejectedCandidate().then(found => { if (live) setCandidate(found); });
    return () => { live = false; };
  }, [model]);

  if (model) {
    return <><strong>{model}</strong> ({percent(confidence)}%)</>;
  }
  const evaluation = candidate?.fieldEvaluation;
  return (
    <>
      <strong>{t('edge_model_none', { defaultValue: 'None installed' })}</strong>
      <span className="block mt-0.5 font-sans text-slate-400">
        {evaluation
          ? t('edge_model_failed_gate', {
            defaultValue: 'The latest trained model was not installed: it had the right disease in its top three for {top3}% of {images} field photos, and {floor}% is needed.',
            top3: percent(evaluation.top3Accuracy), images: evaluation.images, floor: percent(FIELD_EVALUATION_FLOOR.top3Accuracy),
          })
          : t('edge_model_none_passed', { defaultValue: 'No trained model has passed field testing yet.' })}
      </span>
    </>
  );
}
