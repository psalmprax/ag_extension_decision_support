import React, { useState } from 'react';
import { Leaf, ShieldAlert, FileCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { diagnoseFromSymptoms, type DiseaseDiagnosis } from '../../api/diseaseService';
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

const SymptomResultCard: React.FC<{
  result: DiseaseDiagnosis;
  onViewDiseaseInfo: (name: string) => void;
  getSeverityColor: (s: string) => string;
}> = ({ result, onViewDiseaseInfo, getSeverityColor }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="p-4 rounded-lg bg-white dark:bg-[#0d1a14] border border-slate-900/[0.08] dark:border-white/[0.08] hover:border-slate-900/[0.08] dark:hover:border-white/[0.08] transition-colors space-y-2.5"
  >
    <div className="flex items-center justify-between">
      <h4 className="text-xs font-medium text-slate-900 dark:text-white">
        {result.reviewStatus === 'needs_expert_review' || result.provenance.evidenceStatus !== 'verified_source' ? 'Possible: ' : ''}
        {result.disease}
      </h4>
      <span
        className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getSeverityColor(
          result.severity
        )}`}
      >
        Match strength: {result.severity}
      </span>
    </div>

    <div className="flex items-center justify-between text-xs">
      <span className="text-emerald-400 font-medium tabular-nums">
        Symptom match: {(result.confidence * 100).toFixed(1)}%
      </span>
      <span className="text-slate-500 text-xxs">
        {result.provenance.evidenceStatus === 'verified_source' ? 'Verified source' : 'Unverified; needs expert review'}
      </span>
    </div>

    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{result.description}</p>

    <div className="p-2 rounded bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08] text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
      <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
      <span>{result.safetyNotice}</span>
    </div>

    <div className="pt-2 border-t border-slate-900/[0.08] dark:border-white/[0.08] flex justify-end">
      <button
        onClick={() => onViewDiseaseInfo(result.disease)}
        className="text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
      >
        <span>View disease information</span>
        <span>&rarr;</span>
      </button>
    </div>
  </motion.div>
);

export function SymptomDiagnosisTab({
  cropType,
  setCropType,
  radiusClass: _radiusClass,
  btnClass: _btnClass,
  t: _t,
  addNotification,
  onViewDiseaseInfo,
  getSeverityColor,
}: Props) {
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
        addNotification({
          type: 'error',
          message: 'The symptom check is not available right now. Try again later.',
        });
      }
    } catch (error) {
      console.error('Diagnosis error:', error);
      addNotification({
        type: 'error',
        message: 'The symptom check is not available right now. Try again later.',
      });
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
            <h3 className="text-xs font-medium text-slate-900 dark:text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-slate-400" aria-hidden="true" />
              Possible causes, most likely first
            </h3>
            <span className="text-xs text-slate-400 tabular-nums">
              {diagnosis.length} {diagnosis.length === 1 ? 'match' : 'matches'}
            </span>
          </div>

          {diagnosis.length > 0 ? (
            <div className="space-y-3">
              {diagnosis.map(result => (
                <SymptomResultCard
                  key={result.disease}
                  result={result}
                  onViewDiseaseInfo={onViewDiseaseInfo}
                  getSeverityColor={getSeverityColor}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 space-y-2">
              <Leaf className="w-10 h-10 mx-auto opacity-30 text-emerald-400" />
              <p className="text-sm text-slate-400">
                Add the signs you see, then check them. A match is a starting point: your officer confirms it.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
