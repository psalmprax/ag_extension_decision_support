import React, { useState } from 'react';
import { Camera, FileImage, Loader2, CheckCircle, Zap, ShieldAlert, Sparkles } from 'lucide-react';
import {
  analyzePlantImage,
  type DiagnosticProvenance,
  type DiseaseDiagnosis,
  type DiagnosticReviewStatus,
} from '../../api/diseaseService';
import { classifyPlantImageOnDevice } from '@/services/offlineDiseaseClassifier';
import { DiseaseSaliencyCanvas } from '@/components/canvas-ui/DiseaseSaliencyCanvas';
import toast from 'react-hot-toast';

interface Props {
  cropType: string;
  setCropType: (val: string) => void;
  radiusClass: string;
  btnClass: string;
  t: (key: string) => string;
  addNotification: (notification: { type: string; message: string }) => void;
  getSeverityColor: (severity: string) => string;
}

interface ImageAnalysisData {
  overallHealth: string;
  diseases: DiseaseDiagnosis[];
  recommendations: string[];
  confidence: number;
  reviewStatus: DiagnosticReviewStatus;
  provenance: DiagnosticProvenance;
}

const ImageUploadViewfinder: React.FC<{
  cropType: string;
  setCropType: (v: string) => void;
  imagePreview: string | null;
  selectedImage: File | null;
  onImageSelect: (f: File) => void;
  onRemoveImage: () => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}> = ({
  cropType,
  setCropType,
  imagePreview,
  selectedImage,
  onImageSelect,
  onRemoveImage,
  onAnalyze,
  isAnalyzing,
}) => (
  <div className="p-5 rounded-[4px] bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-4">
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Camera className="w-4 h-4 text-emerald-400" />
          Field Specimen Viewfinder
        </h3>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-[3px] border border-emerald-500/30">
          NEURAL SENSOR
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
            Target Crop (Optional Context)
          </label>
          <input
            type="text"
            value={cropType}
            onChange={e => setCropType(e.target.value)}
            placeholder="e.g. Coffee, Maize, Tomato, Cassava"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-[3px] text-xs text-white placeholder-slate-600 focus:border-emerald-500/60 focus:ring-1 focus:ring-emerald-500/40 font-mono transition-all"
          />
        </div>

        {/* Viewfinder Dropzone */}
        <div className="relative rounded-[4px] border-2 border-dashed border-slate-700/80 hover:border-emerald-500/60 bg-slate-950/80 p-5 text-center transition-all group overflow-hidden">
          {/* Corner Reticles */}
          <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-emerald-400/80" />
          <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-emerald-400/80" />
          <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-emerald-400/80" />
          <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-emerald-400/80" />

          {imagePreview ? (
            <div className="space-y-3 relative z-10">
              <div className="relative max-w-xs mx-auto rounded-[3px] overflow-hidden border border-emerald-500/40 shadow-lg shadow-emerald-950/60">
                <img src={imagePreview} alt="Specimen" className="w-full h-44 object-cover" />
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-emerald-500/20 backdrop-blur-[1px] flex items-center justify-center">
                    <div className="w-full h-0.5 bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onRemoveImage}
                className="text-[11px] font-mono text-rose-400 hover:text-rose-300 underline uppercase tracking-wider"
              >
                [ Clear & Retake ]
              </button>
            </div>
          ) : (
            <div className="space-y-3 py-4">
              <div className="w-12 h-12 mx-auto rounded-[4px] bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 group-hover:text-emerald-400 group-hover:border-emerald-500/40 transition-colors">
                <FileImage className="w-6 h-6" />
              </div>
              <div>
                <label htmlFor="image-upload" className="cursor-pointer">
                  <span className="text-xs font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider">
                    Capture or Upload Leaf Photo
                  </span>
                  <p className="text-[10px] font-mono text-slate-500 mt-1">
                    Drag & Drop JPG, PNG (Max 10MB)
                  </p>
                </label>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) onImageSelect(file);
                  }}
                  className="hidden"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    <button
      onClick={onAnalyze}
      disabled={!selectedImage || isAnalyzing}
      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-[4px] shadow-lg shadow-emerald-950/60 uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
    >
      {isAnalyzing ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-white" />
          <span>Executing Neural Pathology Scan...</span>
        </>
      ) : (
        <>
          <Camera className="w-4 h-4" />
          <span>Run AI Pathology Analysis</span>
        </>
      )}
    </button>
  </div>
);

const AnalysisResultsHUD: React.FC<{
  imageAnalysis: ImageAnalysisData | null;
  imagePreview: string | null;
  isOfflineMode: boolean;
  getSeverityColor: (s: string) => string;
}> = ({ imageAnalysis, imagePreview, isOfflineMode, getSeverityColor }) => {
  if (!imageAnalysis) {
    return (
      <div className="p-5 rounded-[4px] bg-slate-900/80 border border-slate-800 flex flex-col justify-center space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider">
            Neural Attention Map & Loupe
          </span>
          <span className="text-[10px] font-mono text-slate-500">STANDBY MODE</span>
        </div>
        <div className="rounded-[4px] overflow-hidden border border-slate-800 bg-slate-950">
          <DiseaseSaliencyCanvas />
        </div>
        <p className="text-[11px] font-mono text-center text-slate-500">
          Upload a specimen photo on the left to trigger deep leaf pathology scanning.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-[4px] bg-slate-900/80 border border-slate-800 space-y-4">
      {/* Offline Alert */}
      {isOfflineMode && (
        <div className="flex items-center gap-2 p-2.5 rounded-[3px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
          <Zap className="w-4 h-4 text-emerald-400 shrink-0 animate-pulse" />
          <span>ON-DEVICE EDGE CLASSIFIER (OFFLINE) • SYNCS ON CLOUD RECONNECT</span>
        </div>
      )}

      {/* Saliency Heatmap */}
      <div className="rounded-[4px] p-2 bg-slate-950 border border-slate-800">
        <div className="px-2 py-1 mb-2 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[11px] font-mono font-bold text-slate-300 uppercase">
            Pathological Lesion Heatmap
          </span>
          <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
            2.5X LOUPE ACTIVE
          </span>
        </div>
        <DiseaseSaliencyCanvas
          imageSrc={imagePreview || undefined}
          detections={imageAnalysis.diseases.map((d, idx) => ({
            id: `det-${idx}`,
            x: 0.35 + ((idx * 0.2) % 0.4),
            y: 0.4 + ((idx * 0.25) % 0.4),
            radius: 0.12,
            label: d.disease,
            confidence: d.confidence,
            severity: (d.severity.toLowerCase() as 'mild' | 'moderate' | 'severe') || 'moderate',
          }))}
        />
      </div>

      {/* Health Metric Banner */}
      <div className="p-3.5 rounded-[4px] bg-slate-950 border border-emerald-500/30 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-black text-white uppercase tracking-wider">
              Health Status: {imageAnalysis.overallHealth}
            </h4>
          </div>
          <p className="text-[10px] font-mono text-slate-400 mt-1">
            Source: {imageAnalysis.provenance.source} {imageAnalysis.provenance.provider ? `(${imageAnalysis.provenance.provider})` : ''}
          </p>
        </div>
        <div className="text-right">
          <span className="text-xl font-mono font-black text-emerald-400">
            {(imageAnalysis.confidence * 100).toFixed(1)}%
          </span>
          <p className="text-[9px] font-mono uppercase text-slate-500">CONFIDENCE</p>
        </div>
      </div>

      {/* Detected Pathogens */}
      {imageAnalysis.diseases.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-black text-white uppercase tracking-wider">
            Detected Pathological Matches
          </h4>
          <div className="space-y-2">
            {imageAnalysis.diseases.map(disease => (
              <div
                key={disease.disease}
                className="p-3 rounded-[4px] bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <h5 className="text-xs font-bold text-white">
                    {disease.reviewStatus === 'needs_expert_review' ? 'Probable Match: ' : ''}
                    {disease.disease}
                  </h5>
                  <span
                    className={`px-2 py-0.5 rounded-[3px] text-[10px] font-mono font-bold uppercase ${getSeverityColor(
                      disease.severity
                    )}`}
                  >
                    {disease.severity}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-emerald-400">
                  Confidence: {(disease.confidence * 100).toFixed(1)}%
                </p>
                <p className="mt-1 text-[10px] text-amber-300 font-mono flex items-start gap-1">
                  <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                  {disease.safetyNotice}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prescribed Actions */}
      {imageAnalysis.recommendations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-black text-white uppercase tracking-wider">
            Immediate Agronomic Interventions
          </h4>
          <div className="grid grid-cols-1 gap-1.5">
            {imageAnalysis.recommendations.map((rec, index) => (
              <div
                key={index}
                className="p-2 rounded-[3px] bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-start gap-2"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export function ImageAnalysisTab({
  cropType,
  setCropType,
  radiusClass: _radiusClass,
  btnClass: _btnClass,
  t: _t,
  addNotification,
  getSeverityColor,
}: Props) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysisData | null>(null);

  const handleImageSelect = (file: File) => {
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = e => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeImage = async () => {
    if (!selectedImage) return;

    setIsAnalyzingImage(true);
    setImageAnalysis(null);
    setIsOfflineMode(false);

    try {
      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.onerror = err => reject(err);
        reader.readAsDataURL(selectedImage);
      });
      const base64 = await base64Promise;
      const imageData = base64.split(',')[1];

      if (!navigator.onLine) {
        const offlineResult = await classifyPlantImageOnDevice(imageData, cropType || undefined);
        setImageAnalysis({ ...offlineResult, reviewStatus: 'ready' });
        setIsOfflineMode(true);
        toast.success('⚡ On-Device Edge AI Diagnosis Completed (Offline Mode)');
        return;
      }

      try {
        const res = await analyzePlantImage(imageData, cropType || undefined);
        if (res.success) {
          setImageAnalysis(res.data);
          toast.success('Plant disease analysis completed!');
        } else {
          const offlineResult = await classifyPlantImageOnDevice(imageData, cropType || undefined);
          setImageAnalysis({ ...offlineResult, reviewStatus: 'ready' });
          setIsOfflineMode(true);
          toast.success('⚡ Used On-Device Edge Classifier fallback');
        }
      } catch {
        const offlineResult = await classifyPlantImageOnDevice(imageData, cropType || undefined);
        setImageAnalysis({ ...offlineResult, reviewStatus: 'ready' });
        setIsOfflineMode(true);
        toast.success('⚡ Used On-Device Edge Classifier (Offline)');
      }
    } catch (error) {
      console.error('Image analysis error:', error);
      addNotification({
        type: 'error',
        message: 'Failed to analyze image',
      });
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <ImageUploadViewfinder
        cropType={cropType}
        setCropType={setCropType}
        imagePreview={imagePreview}
        selectedImage={selectedImage}
        onImageSelect={handleImageSelect}
        onRemoveImage={() => {
          setSelectedImage(null);
          setImagePreview(null);
        }}
        onAnalyze={handleAnalyzeImage}
        isAnalyzing={isAnalyzingImage}
      />

      <AnalysisResultsHUD
        imageAnalysis={imageAnalysis}
        imagePreview={imagePreview}
        isOfflineMode={isOfflineMode}
        getSeverityColor={getSeverityColor}
      />
    </div>
  );
}
