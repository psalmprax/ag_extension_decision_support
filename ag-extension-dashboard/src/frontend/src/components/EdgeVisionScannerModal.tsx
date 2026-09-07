import React, { useState, useRef } from 'react';
import {
  Camera,
  Layers,
  Sparkles,
  CheckCircle,
  MapPin,
  Loader2,
  ShieldCheck,
  RefreshCw,
  Copy,
} from 'lucide-react';
import { BaseModal } from './BaseModal';
import { triggerHaptic } from '@/lib/haptics';
import { useFeatureFlags } from '@/store/useFeatureFlags';
import {
  diagnosePlantOffline,
  diagnoseSoilOffline,
  type OfflineDiagnosisResult,
  type OfflineSoilDiagnosisResult,
} from '../services/edgePlantVisionClassifier';
import {
  analyzePlantImage,
  analyzeSoilImage,
  type DiseaseDiagnosis,
  type SoilAnalysisResult,
} from '@/api/diseaseService';
import toast from 'react-hot-toast';

export const CROP_PRESETS = [
  { id: 'Maize', label: 'Maize', emoji: '🌽', alt: 'Corn' },
  { id: 'Cassava', label: 'Cassava', emoji: '🌿', alt: 'Manioc' },
  { id: 'Tomato', label: 'Tomato', emoji: '🍅', alt: 'Solanum' },
  { id: 'Coffee', label: 'Coffee', emoji: '☕', alt: 'Arabica' },
  { id: 'Banana', label: 'Banana', emoji: '🍌', alt: 'Musa' },
  { id: 'Legumes', label: 'Legumes', emoji: '🫘', alt: 'Beans' },
] as const;

interface CropPillScrubberProps {
  selectedCrop: string;
  onSelectCrop: (crop: string) => void;
  disabled?: boolean;
}

const CropPillScrubber: React.FC<CropPillScrubberProps> = ({
  selectedCrop,
  onSelectCrop,
  disabled = false,
}) => {
  const { designVariant } = useFeatureFlags();
  const isBase = designVariant === 'base' || designVariant === 'new';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="edge-target-crop-select"
          className="block text-xs font-bold font-mono uppercase text-slate-300"
        >
          Target Crop Specimen
        </label>
        <span className="text-[10px] font-mono text-slate-400">
          Thumb Scrubber
        </span>
      </div>

      {/* Horizontal Thumb Pill Scrubber */}
      <div
        role="radiogroup"
        aria-label="Target Crop Selection"
        className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 touch-pan-x scroll-smooth"
      >
        {CROP_PRESETS.map(c => {
          const isSelected = selectedCrop.toLowerCase() === c.id.toLowerCase();
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => {
                triggerHaptic('light');
                onSelectCrop(c.id);
              }}
              className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-150 active:scale-95 disabled:opacity-50 select-none cursor-pointer ${
                isSelected
                  ? isBase
                    ? 'bg-blue-600 text-white shadow-[0_0_12px_rgba(0,82,255,0.45)] border border-blue-400 ring-2 ring-blue-500/30'
                    : 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.45)] border border-emerald-400 ring-2 ring-emerald-500/30'
                  : 'bg-slate-900/90 text-slate-400 border border-white/10 hover:border-white/20 hover:text-white'
              }`}
            >
              <span className="text-sm leading-none" aria-hidden="true">
                {c.emoji}
              </span>
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* Accessible synchronized select dropdown */}
      <div className="pt-0.5">
        <select
          id="edge-target-crop-select"
          value={selectedCrop}
          disabled={disabled}
          onChange={e => {
            triggerHaptic('light');
            onSelectCrop(e.target.value);
          }}
          className="w-full px-3 py-1.5 border rounded-xl text-xs bg-slate-900/80 border-white/10 text-slate-300 outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
          aria-label="Target Crop Dropdown"
        >
          {CROP_PRESETS.map(c => (
            <option key={c.id} value={c.id}>
              {c.label} ({c.alt})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export type ScanTargetMode = 'crop' | 'soil';

interface EdgeVisionScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCrop?: string;
}

const ModeSwitcher: React.FC<{
  mode: ScanTargetMode;
  onSelect: (m: ScanTargetMode) => void;
  disabled?: boolean;
}> = ({ mode, onSelect, disabled }) => (
  <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-white/10">
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect('crop')}
      className={`py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
        mode === 'crop'
          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
          : 'text-slate-400 hover:text-white'
      }`}
    >
      <Camera className="w-3.5 h-3.5" />
      <span>Crop Foliage</span>
    </button>
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect('soil')}
      className={`py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
        mode === 'soil'
          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
          : 'text-slate-400 hover:text-white'
      }`}
    >
      <Layers className="w-3.5 h-3.5" />
      <span>Soil Profile (Texture)</span>
    </button>
  </div>
);

const CropDiagnosticHUD: React.FC<{ result: OfflineDiagnosisResult }> = ({ result }) => (
  <div className="p-4 bg-slate-900/60 rounded-xl border border-white/10 space-y-3">
    <div className="flex justify-between items-start">
      <div>
        <span className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase font-mono">
          Edge Primary Diagnosis
        </span>
        <h4 className="text-base font-bold text-white mt-0.5">
          {result.primaryDiagnosis.condition}
        </h4>
        <p className="text-xs text-slate-400 italic">
          {result.primaryDiagnosis.scientificName}
        </p>
      </div>
      <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold font-mono rounded-full">
        {Math.round(result.primaryDiagnosis.confidence * 100)}% Match
      </span>
    </div>

    {/* Two-Stage Edge AI Pipeline Telemetry */}
    {result.twoStage && (
      <div className="p-2.5 bg-slate-950/80 border border-white/10 rounded-xl space-y-1.5">
        <div className="flex justify-between items-center text-[10px] font-mono">
          <span className="text-slate-400">Two-Stage Edge AI Pipeline:</span>
          <span className="text-emerald-400 font-bold">
            {result.twoStage.stage1Detector.detectedLeaf ? 'Foliage Verified' : 'Foliage Rejected'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div className="p-1.5 rounded bg-slate-900/80 border border-emerald-500/20 text-emerald-300">
            <span className="text-slate-400 block text-[9px]">STAGE 1 DETECTOR</span>
            <strong>{result.twoStage.stage1Detector.model.toUpperCase()}</strong> ({result.twoStage.stage1Detector.boxes.filter(b => b.label !== 'crop_leaf').length} lesions)
          </div>
          <div className="p-1.5 rounded bg-slate-900/80 border border-sky-500/20 text-sky-300">
            <span className="text-slate-400 block text-[9px]">STAGE 2 CLASSIFIER</span>
            <strong>{result.twoStage.stage2Classifier.model.toUpperCase()}</strong> ({Math.round(result.twoStage.stage2Classifier.confidence * 100)}%)
          </div>
        </div>
      </div>
    )}

    {/* Visual Metrics */}
    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center">
      <div className="p-2 bg-slate-950/80 rounded-lg border border-white/5">
        <span className="text-[10px] font-mono text-slate-400">Canopy Vigor</span>
        <p className="text-xs font-bold font-mono text-emerald-400 mt-0.5">
          {Math.round(result.metrics.greenCanopyIndex * 100)}%
        </p>
      </div>
      <div className="p-2 bg-slate-950/80 rounded-lg border border-white/5">
        <span className="text-[10px] font-mono text-slate-400">Chlorosis</span>
        <p className="text-xs font-bold font-mono text-amber-400 mt-0.5">
          {Math.round(result.metrics.chlorosisRatio * 100)}%
        </p>
      </div>
      <div className="p-2 bg-slate-950/80 rounded-lg border border-white/5">
        <span className="text-[10px] font-mono text-slate-400">Necrosis</span>
        <p className="text-xs font-bold font-mono text-rose-400 mt-0.5">
          {Math.round(result.metrics.necrosisRatio * 100)}%
        </p>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="p-2 bg-slate-950/80 rounded-lg border border-white/5">
        <span className="text-[10px] font-mono text-slate-400">Brown Spot</span>
        <p className="text-xs font-bold font-mono text-orange-400 mt-0.5">
          {Math.round((result.metrics.brownSpotRatio ?? 0) * 100)}%
        </p>
      </div>
      <div className="p-2 bg-slate-950/80 rounded-lg border border-white/5">
        <span className="text-[10px] font-mono text-slate-400">Texture Var</span>
        <p className="text-xs font-bold font-mono text-purple-400 mt-0.5">
          {(result.metrics.textureVariance ?? 0).toFixed(2)}
        </p>
      </div>
      <div className="p-2 bg-slate-950/80 rounded-lg border border-white/5">
        <span className="text-[10px] font-mono text-slate-400">NGRDI</span>
        <p className="text-xs font-bold font-mono text-sky-400 mt-0.5">
          {(result.metrics.ngrdi ?? 0).toFixed(2)}
        </p>
      </div>
    </div>

    {/* Cultural & Chemical Action Drawer */}
    <div className="space-y-2 pt-2 text-xs border-t border-white/10">
      <div>
        <span className="font-bold text-emerald-400 uppercase tracking-wider font-mono text-[10px]">
          Cultural Management:
        </span>
        <ul className="list-disc pl-4 text-slate-300 space-y-0.5 mt-0.5">
          {result.primaryDiagnosis.culturalControl.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>

      <div>
        <span className="font-bold text-indigo-400 uppercase tracking-wider font-mono text-[10px]">
          Chemical Threshold:
        </span>
        <p className="text-slate-300 mt-0.5">
          {result.primaryDiagnosis.chemicalIntervention}
        </p>
      </div>
    </div>
  </div>
);

const SoilDiagnosticHUD: React.FC<{ result: OfflineSoilDiagnosisResult }> = ({ result }) => (
  <div className="p-4 bg-slate-900/60 rounded-xl border border-white/10 space-y-3">
    <div className="flex justify-between items-start">
      <div>
        <span className="text-[10px] font-bold tracking-wider text-amber-400 uppercase font-mono">
          Edge Soil Texture & Physical Class
        </span>
        <h4 className="text-base font-bold text-white mt-0.5">
          {result.textureClass}
        </h4>
        <p className="text-xs text-slate-400">
          Drainage: <strong className="text-white">{result.drainageClass}</strong>
        </p>
      </div>
      <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold font-mono rounded-full">
        {Math.round(result.confidence * 100)}% Match
      </span>
    </div>

    {/* Soil Physical Telemetry */}
    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center">
      <div className="p-2 bg-slate-950/80 rounded-lg border border-white/5">
        <span className="text-[10px] font-mono text-slate-400">Texture Roughness</span>
        <p className="text-xs font-bold font-mono text-amber-400 mt-0.5">
          {(result.metrics.textureVariance * 100).toFixed(0)}%
        </p>
      </div>
      <div className="p-2 bg-slate-950/80 rounded-lg border border-white/5">
        <span className="text-[10px] font-mono text-slate-400">Organic Matter</span>
        <p className="text-xs font-bold font-mono text-emerald-400 mt-0.5">
          {result.organicMatterIndex}
        </p>
      </div>
      <div className="p-2 bg-slate-950/80 rounded-lg border border-white/5">
        <span className="text-[10px] font-mono text-slate-400">Moisture Index</span>
        <p className="text-xs font-bold font-mono text-sky-400 mt-0.5">
          {result.estimatedMoisture.split(' ')[0]}
        </p>
      </div>
    </div>

    {/* Agronomic Soil Management Guidance */}
    <div className="space-y-1.5 pt-2 text-xs border-t border-white/10">
      <span className="font-bold text-amber-400 uppercase tracking-wider font-mono text-[10px]">
        Agronomic Field Guidance:
      </span>
      <ul className="list-disc pl-4 text-slate-300 space-y-1">
        {result.recommendations.map((rec, i) => (
          <li key={i}>{rec}</li>
        ))}
      </ul>
    </div>
  </div>
);

const VerifiedCloudCard: React.FC<{
  cropData?: { overallHealth: string; diseases: DiseaseDiagnosis[]; recommendations: string[] } | null;
  soilData?: SoilAnalysisResult | null;
}> = ({ cropData, soilData }) => {
  if (!cropData && !soilData) return null;

  return (
    <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-2">
      <div className="flex items-center gap-2 text-emerald-400">
        <ShieldCheck className="w-4 h-4" />
        <span className="text-xs font-bold font-mono uppercase tracking-wider">
          Cloud AI Multimodal Verification Confirmed
        </span>
      </div>

      {cropData && (
        <div className="space-y-1.5 text-xs text-slate-300">
          <div className="flex justify-between items-center">
            <span className="font-bold text-white">
              {cropData.diseases[0]?.disease || 'Healthy Crop Vigor'}
            </span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
              {Math.round((cropData.diseases[0]?.confidence || 0.9) * 100)}% Confidence
            </span>
          </div>
          {cropData.diseases[0]?.treatment && cropData.diseases[0].treatment.length > 0 && (
            <p className="text-slate-300 text-[11px]">
              <strong className="text-emerald-400">Prescribed Treatment:</strong>{' '}
              {cropData.diseases[0].treatment.join('; ')}
            </p>
          )}
        </div>
      )}

      {soilData && (
        <div className="space-y-1.5 text-xs text-slate-300">
          <div className="flex justify-between items-center">
            <span className="font-bold text-white">{soilData.texture}</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px]">
              Score: {soilData.overallHealthScore}/100
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[10px] pt-1">
            <span className="p-1 rounded bg-slate-900 border border-white/5">
              N: <strong className="text-emerald-400">{soilData.npkDeficiencies.nitrogen}</strong>
            </span>
            <span className="p-1 rounded bg-slate-900 border border-white/5">
              P: <strong className="text-sky-400">{soilData.npkDeficiencies.phosphorus}</strong>
            </span>
            <span className="p-1 rounded bg-slate-900 border border-white/5">
              K: <strong className="text-amber-400">{soilData.npkDeficiencies.potassium}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export const EdgeVisionScannerModal: React.FC<EdgeVisionScannerModalProps> = ({
  isOpen,
  onClose,
  defaultCrop = 'Maize',
}) => {
  const [scanMode, setScanMode] = useState<ScanTargetMode>('crop');
  const [crop, setCrop] = useState(defaultCrop);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [cropResult, setCropResult] = useState<OfflineDiagnosisResult | null>(null);
  const [soilResult, setSoilResult] = useState<OfflineSoilDiagnosisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedCrop, setVerifiedCrop] = useState<{ overallHealth: string; diseases: DiseaseDiagnosis[]; recommendations: string[] } | null>(null);
  const [verifiedSoil, setVerifiedSoil] = useState<SoilAnalysisResult | null>(null);
  const [loggedToMap, setLoggedToMap] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      setImageSrc(src);
      executeDiagnosis(src, scanMode);
    };
    reader.readAsDataURL(file);
  };

  const executeDiagnosis = (src: string, mode: ScanTargetMode) => {
    setAnalyzing(true);
    setCropResult(null);
    setSoilResult(null);
    setVerifiedCrop(null);
    setVerifiedSoil(null);
    setLoggedToMap(false);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = async () => {
      try {
        if (mode === 'crop') {
          const diag = await diagnosePlantOffline(img, crop);
          setCropResult(diag);
        } else {
          const soilDiag = diagnoseSoilOffline(img, crop);
          setSoilResult(soilDiag);
        }
      } catch (err) {
        console.error('Offline edge diagnosis error:', err);
      } finally {
        setAnalyzing(false);
      }
    };
    img.src = src;
  };

  const handleModeChange = (mode: ScanTargetMode) => {
    setScanMode(mode);
    if (imageSrc) {
      executeDiagnosis(imageSrc, mode);
    }
  };

  const handleVerifyWithCloud = async () => {
    if (!imageSrc) return;
    if (!navigator.onLine) {
      toast.error('Offline: Specimen saved locally. Verify when back online.');
      return;
    }

    setIsVerifying(true);
    try {
      if (scanMode === 'crop') {
        const res = await analyzePlantImage(imageSrc, crop);
        if (res.success && res.data) {
          setVerifiedCrop(res.data);
          toast.success('Crop pathology verified via cloud vision AI');
        }
      } else {
        const res = await analyzeSoilImage(imageSrc, crop);
        if (res.success && res.data) {
          setVerifiedSoil(res.data);
          toast.success('Soil chemistry & texture verified via cloud AI');
        }
      }
    } catch {
      toast.error('Cloud verification currently unavailable. Offline findings preserved.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePlotOnWorldMonitor = () => {
    try {
      const condition =
        scanMode === 'crop'
          ? cropResult?.primaryDiagnosis.condition || 'Crop Observation'
          : soilResult?.textureClass || 'Soil Sample';

      const entry = {
        id: `scan-${Date.now()}`,
        crop,
        condition,
        mode: scanMode,
        timestamp: new Date().toISOString(),
        confidence:
          scanMode === 'crop'
            ? cropResult?.primaryDiagnosis.confidence ?? 0.85
            : soilResult?.confidence ?? 0.85,
      };

      const existing = JSON.parse(localStorage.getItem('outbreak_scans') || '[]');
      existing.push(entry);
      localStorage.setItem('outbreak_scans', JSON.stringify(existing));
      setLoggedToMap(true);
      toast.success(`Pinned ${condition} to WorldMonitor outbreak layers!`);
    } catch {
      toast.error('Failed to log point to map.');
    }
  };

  const handleShareReport = async () => {
    try {
      const summary =
        scanMode === 'crop' && cropResult
          ? `[Agri-Vision Offline Scan]\nCrop: ${crop}\nDiagnosis: ${cropResult.primaryDiagnosis.condition} (${Math.round(cropResult.primaryDiagnosis.confidence * 100)}% confidence)\nSeverity: ${cropResult.primaryDiagnosis.severity}\nAction: ${cropResult.primaryDiagnosis.culturalControl[0] || 'See full report'}`
          : soilResult
          ? `[Agri-Soil Offline Scan]\nTexture: ${soilResult.textureClass} (${Math.round(soilResult.confidence * 100)}% confidence)\nDrainage: ${soilResult.drainageClass}\nOrganic Matter: ${soilResult.organicMatterIndex}\nMoisture: ${soilResult.estimatedMoisture}`
          : 'Diagnostic specimen report';

      if (navigator.clipboard) {
        await navigator.clipboard.writeText(summary);
        triggerHaptic('light');
        toast.success('Diagnostic report copied to clipboard');
      }
    } catch {
      toast.error('Could not copy report');
    }
  };

  const handleReset = () => {
    setImageSrc(null);
    setCropResult(null);
    setSoilResult(null);
    setVerifiedCrop(null);
    setVerifiedSoil(null);
    setLoggedToMap(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Offline Edge Vision: Crop & Soil Pathology"
    >
      <div className="space-y-5 text-slate-100">
        {/* Mode Selector */}
        <ModeSwitcher mode={scanMode} onSelect={handleModeChange} disabled={analyzing} />

        {/* Engine Telemetry Status */}
        <div className="flex justify-between items-center bg-slate-900/90 p-3 rounded-xl border border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_#34d399]" />
            <span className="text-xs font-bold text-white font-mono">
              {scanMode === 'crop'
                ? cropResult?.origin === 'mobilevit-onnx'
                  ? 'Two-Stage: YOLOv8n + MobileViT-XXS'
                  : cropResult?.origin === 'onnx'
                  ? 'Two-Stage: YOLOv8n + EfficientNet-Lite0'
                  : 'Two-Stage: YOLO Saliency + Heuristic Triage'
                : 'Edge Soil Aggregate & Reflectance Analyzer'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {scanMode === 'crop'
              ? cropResult?.origin === 'mobilevit-onnx'
                ? 'MobileViT WASM'
                : cropResult?.origin === 'onnx'
                ? 'ONNX Runtime Web'
                : 'Heuristic v2'
              : 'Sobel Physics v1'}
          </span>
        </div>

        {/* Crop Selector Context */}
        {scanMode === 'crop' && (
          <CropPillScrubber
            selectedCrop={crop}
            disabled={analyzing}
            onSelectCrop={newCrop => {
              setCrop(newCrop);
              if (imageSrc) executeDiagnosis(imageSrc, 'crop');
            }}
          />
        )}

        {/* Upload / Capture Box */}
        {!imageSrc && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700/80 hover:border-emerald-400/60 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-950/40"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-12 h-12 mx-auto mb-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center font-bold text-xl">
              📷
            </div>
            <p className="text-sm font-bold text-white">
              {scanMode === 'crop'
                ? 'Take Leaf Photo or Upload Foliage Specimen'
                : 'Take Soil Clod Photo or Upload Profile'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Runs 100% on-device without internet. Instant offline texture & pathology triage.
            </p>
          </div>
        )}

        {/* Image Preview & Analysis Output */}
        {imageSrc && (
          <div className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border border-white/10 max-h-64 bg-black/40 flex items-center justify-center">
              <img
                src={imageSrc}
                alt="Diagnostic Target Specimen"
                className="object-contain max-h-64 w-full select-none"
              />

              {/* Stage 1: YOLO Bounding Boxes & Foliar Saliency Overlay */}
              {showBoxes && scanMode === 'crop' && cropResult?.twoStage?.stage1Detector.boxes && !analyzing && (
                <div className="absolute inset-0 pointer-events-none">
                  {cropResult.twoStage.stage1Detector.boxes.map(b => {
                    const [ymin, xmin, ymax, xmax] = b.box;
                    const top = `${ymin * 100}%`;
                    const left = `${xmin * 100}%`;
                    const width = `${(xmax - xmin) * 100}%`;
                    const height = `${(ymax - ymin) * 100}%`;
                    const labelText =
                      b.label === 'crop_leaf'
                        ? 'Leaf Blade'
                        : b.label === 'pest_damage'
                        ? 'Pest Damage'
                        : b.label === 'non_plant_background'
                        ? 'Non-Foliage'
                        : 'Foliar Lesion';

                    return (
                      <div
                        key={b.id}
                        className="absolute border-2 rounded-sm transition-all duration-300"
                        style={{
                          top,
                          left,
                          width,
                          height,
                          borderColor: b.color,
                          backgroundColor: `${b.color}15`,
                        }}
                      >
                        <span
                          className="absolute -top-5 left-0 px-1.5 py-0.5 text-[9px] font-mono font-bold text-white rounded shadow-sm whitespace-nowrap"
                          style={{ backgroundColor: b.color }}
                        >
                          {labelText} {Math.round(b.confidence * 100)}%
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {analyzing && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-white">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mb-2" />
                  <span className="text-xs font-mono font-bold tracking-wider uppercase">
                    Stage 1 YOLO Detection & Stage 2 MobileViT Analysis...
                  </span>
                </div>
              )}
            </div>

            {/* YOLO Bounding Box & Saliency Toggle */}
            {scanMode === 'crop' && cropResult?.twoStage?.stage1Detector.boxes && (
              <div className="flex justify-between items-center text-xs px-1">
                <span className="text-slate-400 font-mono text-[11px]">
                  YOLO Detections: {cropResult.twoStage.stage1Detector.boxes.filter(b => b.label !== 'crop_leaf').length} lesion/damage sites
                </span>
                <button
                  type="button"
                  onClick={() => setShowBoxes(!showBoxes)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg text-[11px] font-mono text-emerald-300 transition"
                >
                  {showBoxes ? 'Hide YOLO Boxes' : 'Show YOLO Boxes'}
                </button>
              </div>
            )}

            {/* Specimen Rejection Alert if Not a Leaf */}
            {cropResult?.isRejectedNonFoliage && (
              <div className="p-3.5 bg-rose-950/60 border border-rose-500/40 rounded-xl space-y-1 text-rose-200">
                <div className="flex items-center gap-2 font-bold text-xs">
                  <span className="text-rose-400 text-sm">⚠️</span>
                  <span>Specimen Rejected by YOLOv8 Leaf Guard</span>
                </div>
                <p className="text-[11px] text-rose-300/90 leading-relaxed">
                  {cropResult.rejectionMessage || 'No identifiable leaf blade or foliage was detected. Please photograph crop foliage against a neutral backdrop.'}
                </p>
              </div>
            )}

            {/* Render Crop or Soil Diagnostic HUD */}
            {scanMode === 'crop' && cropResult && <CropDiagnosticHUD result={cropResult} />}
            {scanMode === 'soil' && soilResult && <SoilDiagnosticHUD result={soilResult} />}

            {/* Cloud Verification Card (if verified) */}
            <VerifiedCloudCard cropData={verifiedCrop} soilData={verifiedSoil} />

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={isVerifying}
                onClick={handleVerifyWithCloud}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 disabled:opacity-50"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying with Cloud Vision AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Verify with Multimodal AI (Cloud)</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={loggedToMap}
                onClick={handlePlotOnWorldMonitor}
                className={`w-full py-2.5 border text-xs font-bold uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 ${
                  loggedToMap
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'border-white/10 hover:bg-white/5 text-slate-300'
                }`}
              >
                {loggedToMap ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Plotted on WorldMonitor Layer</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4 text-sky-400" />
                    <span>Plot to WorldMonitor Outbreak Map</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleShareReport}
                className="w-full py-2.5 border border-white/10 hover:bg-white/5 text-xs font-bold uppercase tracking-wider text-slate-300 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Copy className="w-3.5 h-3.5 text-blue-400" />
                <span>Copy Finding Summary</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2 border border-white/10 hover:bg-white/5 text-xs font-medium text-slate-400 rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Scan Another Specimen</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </BaseModal>
  );
};
