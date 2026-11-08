import React from 'react';
import { X, Loader2, Leaf, ShieldAlert, ShieldCheck, CheckCircle2 } from 'lucide-react';
import type { DiseaseInfo } from '../../api/diseaseService';

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
  if (!selectedDisease) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-950/95 border border-white/10 rounded-[4px] max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-xl backdrop-blur-2xl text-slate-100">
        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[3px] bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Leaf className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-mono text-emerald-400 font-medium">
                  Pathology Protocol Dossier
                </span>
                <h3 className="text-sm font-semibold text-white">
                  {selectedDisease}
                </h3>
              </div>
            </div>
            <button
              onClick={() => setSelectedDisease(null)}
              className="p-1.5 rounded-[3px] bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {isLoadingInfo ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
          ) : diseaseInfo ? (
            <div className="space-y-3.5">
              {/* Description Pod */}
              <div className="p-3.5 rounded-[4px] bg-slate-900/80 border border-slate-800 space-y-1">
                <h4 className="text-xs font-mono font-medium text-slate-400">
                  Agronomic Pathology Summary
                </h4>
                <p className="text-xs text-slate-200 leading-relaxed">{diseaseInfo.description}</p>
              </div>

              {/* Symptoms Pod */}
              <div className="p-3.5 rounded-[4px] bg-slate-900/80 border border-slate-800 space-y-2">
                <h4 className="text-xs font-mono font-medium text-slate-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  Key Identifying Symptoms
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {diseaseInfo.symptoms.map((symptom, index) => (
                    <div
                      key={index}
                      className="p-2 rounded-[3px] bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-start gap-1.5"
                    >
                      <span className="text-emerald-400 font-bold">•</span>
                      <span>{symptom}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Treatment Pod */}
              <div className="p-3.5 rounded-[4px] bg-slate-900/80 border border-slate-800 space-y-2">
                <h4 className="text-xs font-mono font-medium text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Treatment guidance
                </h4>
                <div className="space-y-1.5">
                  {diseaseInfo.treatment.map((treatment, index) => (
                    <div
                      key={index}
                      className="p-2 rounded-[3px] bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-start gap-2"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{treatment}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Prevention Pod */}
              <div className="p-3.5 rounded-[4px] bg-slate-900/80 border border-slate-800 space-y-2">
                <h4 className="text-xs font-mono font-medium text-slate-400">
                  Prevention guidance
                </h4>
                <div className="space-y-1.5">
                  {diseaseInfo.prevention.map((prevent, index) => (
                    <div
                      key={index}
                      className="p-2 rounded-[3px] bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-start gap-2"
                    >
                      <span className="text-sky-400 font-mono">✓</span>
                      <span>{prevent}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs font-mono text-center text-rose-400 py-8">
              Failed to load pathology dossier information
            </p>
          )}

          {/* Footer */}
          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              onClick={() => setSelectedDisease(null)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-medium rounded-[3px] transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
