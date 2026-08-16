import React, { useState } from 'react';
import { Search, Loader2, Leaf, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { diagnoseFromSymptoms, type DiseaseDiagnosis } from '../../api/diseaseService';

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
  radiusClass,
  btnClass,
  t,
  addNotification,
  onViewDiseaseInfo,
  getSeverityColor,
}: Props) {
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [currentSymptom, setCurrentSymptom] = useState('');
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiseaseDiagnosis[]>([]);

  const handleAddSymptom = () => {
    if (currentSymptom.trim() && !symptoms.includes(currentSymptom.trim())) {
      setSymptoms([...symptoms, currentSymptom.trim()]);
      setCurrentSymptom('');
    }
  };

  const handleRemoveSymptom = (symptom: string) => {
    setSymptoms(symptoms.filter(s => s !== symptom));
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
          message: t('disease_diagnosis_failed_load'),
        });
      }
    } catch (error) {
      console.error('Diagnosis error:', error);
      addNotification({
        type: 'error',
        message: t('disease_diagnosis_failed_diagnose'),
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Section */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('disease_diagnosis_symptom_diagnosis')}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Crop Type (Optional)
            </label>
            <input
              type="text"
              value={cropType}
              onChange={e => setCropType(e.target.value)}
              placeholder="e.g., maize, tomato, wheat"
              className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Add Symptoms
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={currentSymptom}
                onChange={e => setCurrentSymptom(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddSymptom()}
                placeholder={t('disease_diagnosis_enter_symptom')}
                className={`flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 ${radiusClass} bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
              />
              <button
                onClick={handleAddSymptom}
                className={`px-4 py-2 bg-primary-600 text-white ${btnClass} hover:bg-primary-700`}
              >
                Add
              </button>
            </div>
          </div>

          {/* Symptoms List */}
          <div className="space-y-2">
            {symptoms.map((symptom, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 ${radiusClass}`}
              >
                <span className="text-sm text-gray-900 dark:text-white">{symptom}</span>
                <button
                  onClick={() => handleRemoveSymptom(symptom)}
                  className="text-red-600 hover:text-red-700"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleDiagnose}
            disabled={symptoms.length === 0 || isDiagnosing}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white ${btnClass} hover:bg-primary-700 disabled:opacity-50`}
          >
            {isDiagnosing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Diagnosing...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Diagnose Disease
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results Section */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('disease_diagnosis_diagnosis_results')}
        </h3>

        {diagnosis.length > 0 ? (
          <div className="space-y-4">
            {diagnosis.map((result, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 border border-gray-200 dark:border-gray-700 ${radiusClass}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {result.reviewStatus === 'needs_expert_review' ? 'Possible match: ' : ''}
                    {result.disease}
                  </h4>
                  <div
                    className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(result.severity)}`}
                  >
                    {result.severity}
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {t('disease_diagnosis_confidence')}: {(result.confidence * 100).toFixed(1)}%
                </p>
                <div className="mb-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-3 text-xs">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-gray-600 dark:text-gray-300">
                    <span>{result.reviewStatus === 'needs_expert_review' ? 'Needs expert review' : 'Evidence-backed match'}</span>
                    <span>Source: {result.provenance.source}</span>
                  </div>
                  {result.provenance.sourceTimestamp && (
                    <div className="mt-1 text-gray-500 dark:text-gray-400">
                      Source date: {new Date(result.provenance.sourceTimestamp).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-900 dark:text-white mb-3">{result.description}</p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
                  {result.safetyNotice}
                </p>
                <button
                  onClick={() => onViewDiseaseInfo(result.disease)}
                  className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                >
                  View Details →
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Leaf className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No diagnosis results yet</p>
            <p className="text-sm">Add symptoms and click diagnose</p>
          </div>
        )}
      </div>
    </div>
  );
}
