import React, { useState } from 'react';
import { Leaf, FileCheck } from 'lucide-react';
import { diagnoseFromSymptoms, type DiseaseDiagnosis } from '../../api/diseaseService';
import { useLanguage } from '@/lib/LanguageContext';
import { PossibleCause } from '@/components/diagnosis/PossibleCause';
import { SymptomInputPanel } from './SymptomInputPanel';

interface Props {
  cropType: string;
  setCropType: (val: string) => void;
  radiusClass: string;
  btnClass: string;
  t: (key: string) => string;
  addNotification: (notification: { type: string; message: string }) => void;
  onViewDiseaseInfo: (disease: string) => void;
  getSeverityColor: (severity: string) => string;
}

export function SymptomDiagnosisTab({
  cropType,
  setCropType,
  radiusClass: _radiusClass,
  btnClass: _btnClass,
  t: _t,
  addNotification,
  onViewDiseaseInfo,
  getSeverityColor: _getSeverityColor,
}: Props) {
  const { t } = useLanguage();
  const unavailable = t('diag_symptom_unavailable', 'The symptom check is not available right now. Try again later.');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [currentSymptom, setCurrentSymptom] = useState('');
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiseaseDiagnosis[]>([]);

  const handleAddSymptom = (sym: string) => {
    if (sym && !symptoms.includes(sym)) {
      setSymptoms([...symptoms, sym]);
      setCurrentSymptom('');
    }
  };

  const handleRemoveSymptom = (sym: string) => {
    setSymptoms(symptoms.filter(s => s !== sym));
  };

  const handleDiagnose = async () => {
    if (symptoms.length === 0) return;

    setIsDiagnosing(true);
    setDiagnosis([]);
    try {
      const res = await diagnoseFromSymptoms(symptoms, cropType || undefined);
      if (res.success) {
        setDiagnosis(res.data);
      } else {
        addNotification({ type: 'error', message: unavailable });
      }
    } catch (error) {
      console.error('Diagnosis error:', error);
      addNotification({ type: 'error', message: unavailable });
    } finally {
      setIsDiagnosing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <SymptomInputPanel
        cropType={cropType}
        setCropType={setCropType}
        currentSymptom={currentSymptom}
        setCurrentSymptom={setCurrentSymptom}
        symptoms={symptoms}
        onAddSymptom={handleAddSymptom}
        onRemoveSymptom={handleRemoveSymptom}
        onDiagnose={handleDiagnose}
        isDiagnosing={isDiagnosing}
      />

      {/* Results */}
      <section aria-label="Result" className="p-5 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-900 dark:text-theme-text-primary flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-slate-500" aria-hidden="true" />
              {t('diag_possible_causes', 'What it could be, most likely first')}
            </h3>
          </div>

          {diagnosis.length > 0 ? (
            <div className="space-y-3">
              {diagnosis.map(result => (
                <PossibleCause
                  key={result.disease}
                  disease={result.disease}
                  confidence={result.confidence}
                  description={result.description}
                  safetyNotice={result.safetyNotice}
                  confirmedBySource={result.reviewStatus !== 'needs_expert_review' && result.provenance.evidenceStatus === 'verified_source'}
                  onMore={() => onViewDiseaseInfo(result.disease)}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center space-y-2">
              <Leaf className="w-10 h-10 mx-auto opacity-30 text-emerald-500" aria-hidden="true" />
              <p className="text-sm text-slate-600 dark:text-theme-text-secondary">
                {t('diag_symptom_empty', 'Add the signs you see, then check them. A match is a starting point: your officer confirms it.')}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
