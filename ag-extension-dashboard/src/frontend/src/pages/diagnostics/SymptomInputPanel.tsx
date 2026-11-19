import React from 'react';
import { Search, Loader2, X, Plus, Activity } from 'lucide-react';
import { isActionEnter } from '@/lib/keyboard';

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
}) => (
  <div className="p-5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-semibold text-white flex items-center gap-2">
        <Activity className="w-4 h-4 text-emerald-400" />
        Symptom Observation Panel
      </h3>
      <span className="text-xxs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
        Heuristic Match
      </span>
    </div>

    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">
          Target Crop Type
        </label>
        <input
          type="text"
          value={cropType}
          onChange={e => setCropType(e.target.value)}
          placeholder="e.g. Maize, Tomato, Coffee, Cassava"
          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-xs text-white placeholder-slate-600 focus:border-emerald-500/60 font-mono transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">
          Add Observed Symptoms
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={currentSymptom}
            onChange={e => setCurrentSymptom(e.target.value)}
            onKeyDown={e => isActionEnter(e) && currentSymptom.trim() && onAddSymptom(currentSymptom.trim())}
            placeholder="Type custom symptom and press Add or Enter..."
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-md text-xs text-white placeholder-slate-600 focus:border-emerald-500/60 font-mono transition-colors"
          />
          <button
            type="button"
            onClick={() => currentSymptom.trim() && onAddSymptom(currentSymptom.trim())}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5 inline mr-1" />
            Add
          </button>
        </div>
      </div>

      {/* Preset Symptom Chips */}
      <div>
        <p className="text-xs font-medium text-slate-400 mb-1.5">
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
                className={`text-xs font-mono px-2.5 py-1 rounded border transition-colors ${
                  isSelected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
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
          <p className="text-xs font-medium text-slate-400 mb-1.5">
            Active Symptom Registry ({symptoms.length}):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {symptoms.map(symptom => (
              <span
                key={symptom}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-950 border border-emerald-500/30 text-emerald-300 text-xs font-mono"
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
      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
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
