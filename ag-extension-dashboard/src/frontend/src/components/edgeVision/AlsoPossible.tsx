import type { OfflineDiagnosisResult } from '@/services/edgePlantVisionClassifier';
import { useLanguage } from '@/lib/LanguageContext';

/** The disease model's other likely answers, beside its top one. */
export function AlsoPossible({ result }: { result: OfflineDiagnosisResult }) {
  const { t } = useLanguage();
  if (result.origin !== 'onnx' || result.alternatives.length === 0) return null;
  const list = result.alternatives.map(a => `${a.condition} (${Math.round(a.confidence * 100)}%)`).join(', ');
  return <p className="text-xs text-slate-400 mt-1">{t('on_device_also_possible_list', { defaultValue: 'Also possible: {list}', list })}</p>;
}
