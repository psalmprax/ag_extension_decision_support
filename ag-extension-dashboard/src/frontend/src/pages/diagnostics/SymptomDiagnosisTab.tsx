import React, { useState } from 'react';
import { Search, Loader2, Leaf, X, Plus, ShieldAlert, Sparkles, Activity } from 'lucide-react';
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

const COMMON_SYMPTOM_PRESETS = [
  'Yellowing / Chlorosis',
  'Dark Necrotic Spots',
  'White Powdery Mold',
  'Wilting / Drooping',
  'Leaf Curling & Crinkling',
  'Stem Lesions & Cankers',
  'Orange Pustules (Rust)',
  'Mottled Mosaic Discoloration',
];

const SymptomInputPanel: React.FC<{
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
}) => (
  <div className="p-5 rounded-[4px] bg-slate-900/80 border border-slate-800 space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
        <Activity className="w-4 h-4 text-emerald-400" />
        Symptom Observation Panel
      </h3>
      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-[3px] border border-emerald-500/30">
        EXPERT INFERENCE
      </span>
    </div>

    <div className="space-y-3">
      <div>
        <label className="block text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
          Target Crop Type
        </label>
        <input
          type="text"
          value={cropType}
          onChange={e => setCropType(e.target.value)}
          placeholder="e.g. Maize, Tomato, Coffee, Cassava"
          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-[3px] text-xs text-white placeholder-slate-600 focus:border-emerald-500/60 font-mono transition-all"
        />
      </div>

      <div>
        <label className="block text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
          Add Observed Symptoms
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={currentSymptom}
            onChange={e => setCurrentSymptom(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && currentSymptom.trim()) {
                onAddSymptom(currentSymptom.trim());
              }
            }}
            placeholder="Type custom symptom and press Add or Enter..."
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-[3px] text-xs text-white placeholder-slate-600 focus:border-emerald-500/60 font-mono transition-all"
          />
          <button
            type="button"
            onClick={() => currentSymptom.trim() && onAddSymptom(currentSymptom.trim())}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[3px] text-xs font-bold uppercase transition-all shadow-md shadow-emerald-950/40"
          >
            <Plus className="w-3.5 h-3.5 inline mr-1" />
            Add
          </button>
        </div>
      </div>

      {/* Preset Symptom Chips */}
      <div>
        <p className="text-[10px] font-mono text-slate-500 uppercase mb-1.5">
          Quick Preset Selectors:
        </p>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_SYMPTOM_PRESETS.map(preset => {
            const isSelected = symptoms.includes(preset);
            return (
              <button
                key={preset}
                type="button"
                onClick={() => (isSelected ? onRemoveSymptom(preset) : onAddSymptom(preset))}
                className={`text-[10px] font-mono px-2 py-1 rounded-[3px] border transition-all ${
                  isSelected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {isSelected ? '✓ ' : '+ '}
                {preset}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Symptoms Tag Cloud */}
      {symptoms.length > 0 && (
        <div className="pt-2 border-t border-slate-800">
          <p className="text-[10px] font-mono text-slate-400 uppercase mb-1.5">
            Active Symptom Registry ({symptoms.length}):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {symptoms.map(symptom => (
              <span
                key={symptom}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[3px] bg-slate-950 border border-emerald-500/30 text-emerald-300 text-xs font-mono"
              >
                <span>{symptom}</span>
                <button
                  type="button"
                  onClick={() => onRemoveSymptom(symptom)}
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
      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-[4px] shadow-lg shadow-emerald-950/60 uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
    >
      {isDiagnosing ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-white" />
          <span>Inferring Pathological Matches...</span>
        </>
      ) : (
        <>
          <Search className="w-4 h-4" />
          <span>Execute Symptom Inference ({symptoms.length} Tags)</span>
        </>
      )}
    </button>
  </div>
);

const SymptomResultCard: React.FC<{
  result: DiseaseDiagnosis;
  onViewDiseaseInfo: (name: string) => void;
  getSeverityColor: (s: string) => string;
}> = ({ result, onViewDiseaseInfo, getSeverityColor }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="p-4 rounded-[4px] bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5"
  >
    <div className="flex items-center justify-between">
      <h4 className="text-xs font-black text-white uppercase tracking-wide">
        {result.reviewStatus === 'needs_expert_review' ? 'Probable: ' : ''}
        {result.disease}
      </h4>
      <span
        className={`px-2 py-0.5 rounded-[3px] text-[10px] font-mono font-bold uppercase ${getSeverityColor(
          result.severity
        )}`}
      >
        {result.severity}
      </span>
    </div>

    <div className="flex items-center justify-between text-xs font-mono">
      <span className="text-emerald-400 font-bold">
        Confidence: {(result.confidence * 100).toFixed(1)}%
      </span>
      <span className="text-slate-500 text-[10px]">
        {result.reviewStatus === 'needs_expert_review' ? 'Needs Review' : 'Verified Evidence'}
      </span>
    </div>

    <p className="text-xs text-slate-300 leading-relaxed">{result.description}</p>

    <div className="p-2 rounded-[3px] bg-slate-900/60 border border-white/5 text-[10px] font-mono text-amber-300 flex items-start gap-1.5">
      <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
      <span>{result.safetyNotice}</span>
    </div>

    <div className="pt-2 border-t border-slate-800 flex justify-end">
      <button
        onClick={() => onViewDiseaseInfo(result.disease)}
        className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider flex items-center gap-1"
      >
        <span>View Treatment Protocol</span>
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
          message: 'Failed to infer diseases from symptoms.',
        });
      }
    } catch (error) {
      console.error('Diagnosis error:', error);
      addNotification({
        type: 'error',
        message: 'Network error diagnosing symptoms',
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

      {/* Results Section */}
      <div className="p-5 rounded-[4px] bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-4">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Ranked Pathology Differentials
            </h3>
            <span className="text-[10px] font-mono text-slate-400">
              {diagnosis.length} Matches Found
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
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Awaiting Symptom Input
              </p>
              <p className="text-[11px] font-mono text-slate-500">
                Select preset chips or type custom symptoms on the left to run inference.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
