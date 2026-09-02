import React, { useState, useRef } from 'react';
import { BaseModal } from './BaseModal';
import {
  diagnosePlantOffline,
  type OfflineDiagnosisResult,
} from '../services/edgePlantVisionClassifier';

interface EdgeVisionScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCrop?: string;
}

export const EdgeVisionScannerModal: React.FC<EdgeVisionScannerModalProps> = ({
  isOpen,
  onClose,
  defaultCrop = 'Maize',
}) => {
  const [crop, setCrop] = useState(defaultCrop);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [result, setResult] = useState<OfflineDiagnosisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setImageSrc(src);
      runOfflineDiagnosis(src);
    };
    reader.readAsDataURL(file);
  };

  const runOfflineDiagnosis = (src: string) => {
    setAnalyzing(true);
    setResult(null);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        const diag = await diagnosePlantOffline(img, crop);
        setResult(diag);
      } catch (err) {
        console.error('Offline edge diagnosis failed:', err);
      } finally {
        setAnalyzing(false);
      }
    };
    img.src = src;
  };

  const handleReset = () => {
    setImageSrc(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <BaseModal isOpen={isOpen} onClose={onClose} title="Offline Edge Vision Plant Diagnosis">
      <div className="space-y-6">
        <div className="flex justify-between items-center bg-amber-50 dark:bg-amber-950/20 p-3 rounded-xl border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
              {result?.origin === 'onnx' ? 'On-Device ONNX Model' : 'Heuristic Triage (HSV/LAB + Texture) — Confirm if <0.8'}
            </span>
          </div>
          <span className="text-[11px] text-gray-500 font-mono">{result?.origin === 'onnx' ? 'ONNX Runtime Web' : 'Heuristic v2'}</span>
        </div>
        {result?.heuristicDisclaimer && (
          <p className="text-[10px] leading-relaxed bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5 text-amber-800 dark:text-amber-200">
            ⚠️ {result.heuristicDisclaimer} {navigator.onLine ? 'Tap “Verify with AI” to send to cloud diagnosis.' : 'Offline: save and verify when back online.'}
          </p>
        )}

        {/* Crop Selector */}
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Crop Type
          </label>
          <select
            value={crop}
            onChange={e => setCrop(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-600"
          >
            <option value="Maize">Maize (Corn)</option>
            <option value="Cassava">Cassava</option>
            <option value="Tomato">Tomato</option>
            <option value="Coffee">Coffee</option>
            <option value="Banana">Banana</option>
          </select>
        </div>

        {/* Upload / Capture Box */}
        {!imageSrc && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-2xl p-8 text-center cursor-pointer hover:border-emerald-500 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 mx-auto mb-3 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center font-bold text-xl">
              📷
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Take Leaf Photo or Upload Image
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Works completely offline without cellular network or server connectivity.
            </p>
          </div>
        )}

        {/* Image Preview & Analysis */}
        {imageSrc && (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 max-h-56 bg-black/5 flex items-center justify-center">
              <img src={imageSrc} alt="Leaf Diagnostic Target" className="object-contain max-h-56 w-full" />
              {analyzing && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                  <div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin mb-2" />
                  <span className="text-xs font-semibold tracking-wide">Analyzing Chromaticity...</span>
                </div>
              )}
            </div>

            {/* Diagnostic Results */}
            {result && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold tracking-wider text-emerald-600 uppercase">
                        Primary Diagnosis
                      </span>
                      <h4 className="text-base font-bold text-gray-900 dark:text-white">
                        {result.primaryDiagnosis.condition}
                      </h4>
                      <p className="text-xs text-gray-500 italic">
                        {result.primaryDiagnosis.scientificName}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-xs font-bold rounded-full">
                      {Math.round(result.primaryDiagnosis.confidence * 100)}% Match
                    </span>
                  </div>

                  {/* Visual Metrics */}
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-center">
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                      <span className="text-[10px] text-gray-500">Canopy Vigor</span>
                      <p className="text-xs font-bold text-emerald-600 mt-0.5">
                        {Math.round(result.metrics.greenCanopyIndex * 100)}%
                      </p>
                    </div>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                      <span className="text-[10px] text-gray-500">Chlorosis</span>
                      <p className="text-xs font-bold text-amber-600 mt-0.5">
                        {Math.round(result.metrics.chlorosisRatio * 100)}%
                      </p>
                    </div>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                      <span className="text-[10px] text-gray-500">Necrosis</span>
                      <p className="text-xs font-bold text-red-600 mt-0.5">
                        {Math.round(result.metrics.necrosisRatio * 100)}%
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                      <span className="text-[10px] text-gray-500">Brown Spot</span>
                      <p className="text-xs font-bold text-orange-600 mt-0.5">{Math.round((result.metrics.brownSpotRatio ?? 0) * 100)}%</p>
                    </div>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                      <span className="text-[10px] text-gray-500">Texture Var</span>
                      <p className="text-xs font-bold text-purple-600 mt-0.5">{(result.metrics.textureVariance ?? 0).toFixed(2)}</p>
                    </div>
                    <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                      <span className="text-[10px] text-gray-500">NGRDI</span>
                      <p className="text-xs font-bold text-sky-600 mt-0.5">{(result.metrics.ngrdi ?? 0).toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Immediate Action Drawer */}
                  <div className="space-y-2 pt-2 text-xs">
                    <div>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        Cultural Management:
                      </span>
                      <ul className="list-disc pl-4 text-gray-600 dark:text-gray-300 space-y-0.5 mt-0.5">
                        {result.primaryDiagnosis.culturalControl.map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <span className="font-bold text-indigo-700 dark:text-indigo-400">
                        Chemical Threshold:
                      </span>
                      <p className="text-gray-600 dark:text-gray-300 mt-0.5">
                        {result.primaryDiagnosis.chemicalIntervention}
                      </p>
                    </div>
                  </div>
                </div>
                {imageSrc && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (!navigator.onLine) { alert('Offline: will verify when back online. Save this image via Visit Logger.'); return; }
                      try {
                        const form = new FormData();
                        const blob = await (await fetch(imageSrc)).blob();
                        form.append('file', blob, 'leaf-verify.jpg');
                        form.append('crop', crop);
                        const res = await fetch('/api/ai/diseases/analyze', { method: 'POST', body: form, headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
                        const j = await res.json().catch(()=>null) as unknown as { data?: { condition?: string; confidence?: number } } | null;
                        alert(j?.data?.condition ? `Cloud verification: ${j.data.condition} (${Math.round((j.data.confidence||0)*100)}%)` : 'Verification request sent — check Reports.');
                      } catch { alert('Verification failed — try again when online.'); }
                    }}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl transition disabled:opacity-50"
                  >
                    Verify with AI (Cloud)
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full py-2.5 border border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 text-sm font-medium rounded-xl transition"
                >
                  Scan Another Leaf
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </BaseModal>
  );
};
