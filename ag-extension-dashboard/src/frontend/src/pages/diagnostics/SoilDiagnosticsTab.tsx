import React, { useState, useEffect } from 'react';
import {
  Upload,
  Activity,
  Layers,
  Droplet,
  AlertTriangle,
  Download,
  Loader2,
  FlaskConical,
  MapPin,
  Database,
  Beaker,
} from 'lucide-react';
import { analyzeSoilImage, type SoilAnalysisResult } from '../../api/diseaseService';
import { downloadReportPdf } from '../../api/reportService';
import { fetchFarmerSoilProfile, type FarmerSoilProfile } from '../../api/soilService';
import { fetchFarmers } from '../../api/farmerService';
import { SoilNutrientHeatmapCanvas, type SoilHeatmapRealPoints } from '../../components/canvas-ui/SoilNutrientHeatmapCanvas';
import toast from 'react-hot-toast';

interface Props {
  cropType: string;
  setCropType: (val: string) => void;
  radiusClass: string;
  btnClass: string;
  addNotification: (notification: { type: string; message: string }) => void;
}

const SoilUploadSection: React.FC<{
  cropType: string;
  setCropType: (v: string) => void;
  farmNotes: string;
  setFarmNotes: (v: string) => void;
  soilImagePreview: string | null;
  selectedSoilImage: File | null;
  onSelectImage: (f: File) => void;
  onRemoveImage: () => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}> = ({
  cropType,
  setCropType,
  farmNotes,
  setFarmNotes,
  soilImagePreview,
  selectedSoilImage,
  onSelectImage,
  onRemoveImage,
  onAnalyze,
  isAnalyzing,
}) => (
  <div className="p-5 rounded-[4px] bg-slate-900/80 border border-slate-800 flex flex-col justify-between space-y-4">
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-emerald-400" />
          Soil Chemistry & Texture Sample
        </h3>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-[3px] border border-emerald-500/30">
          MULTISPECTRAL SENSOR
        </span>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
            Target Crop Context
          </label>
          <input
            type="text"
            value={cropType}
            onChange={e => setCropType(e.target.value)}
            placeholder="e.g. Maize, Coffee, Legumes, Vegetables"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-[3px] text-xs text-white placeholder-slate-600 focus:border-emerald-500/60 font-mono transition-all"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider mb-1">
            Field Observation Notes
          </label>
          <textarea
            value={farmNotes}
            onChange={e => setFarmNotes(e.target.value)}
            placeholder="Soil slope, topsoil drainage, previous season fertilizer..."
            rows={2}
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-[3px] text-xs text-white placeholder-slate-600 focus:border-emerald-500/60 font-mono transition-all resize-none"
          />
        </div>

        {/* Viewfinder Dropzone */}
        <div className="relative rounded-[4px] border-2 border-dashed border-slate-700/80 hover:border-emerald-500/60 bg-slate-950/80 p-5 text-center transition-all group overflow-hidden">
          {/* Corner Reticles */}
          <div className="absolute top-1.5 left-1.5 w-3 h-3 border-t-2 border-l-2 border-emerald-400/80" />
          <div className="absolute top-1.5 right-1.5 w-3 h-3 border-t-2 border-r-2 border-emerald-400/80" />
          <div className="absolute bottom-1.5 left-1.5 w-3 h-3 border-b-2 border-l-2 border-emerald-400/80" />
          <div className="absolute bottom-1.5 right-1.5 w-3 h-3 border-b-2 border-r-2 border-emerald-400/80" />

          {soilImagePreview ? (
            <div className="space-y-3 relative z-10">
              <div className="relative max-w-xs mx-auto rounded-[3px] overflow-hidden border border-emerald-500/40 shadow-lg shadow-emerald-950/60">
                <img src={soilImagePreview} alt="Soil Specimen" className="w-full h-40 object-cover" />
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
            <div className="space-y-3 py-3">
              <div className="w-11 h-11 mx-auto rounded-[4px] bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 group-hover:text-emerald-400 group-hover:border-emerald-500/40 transition-colors">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <label htmlFor="soil-upload" className="cursor-pointer">
                  <span className="text-xs font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-wider">
                    Upload Soil Profile Photo
                  </span>
                  <p className="text-[10px] font-mono text-slate-500 mt-1">
                    Direct topsoil or clod close-up (Max 10MB)
                  </p>
                </label>
                <input
                  id="soil-upload"
                  type="file"
                  accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) onSelectImage(file);
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
      disabled={!selectedSoilImage || isAnalyzing}
      className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-[4px] shadow-lg shadow-emerald-950/60 uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
    >
      {isAnalyzing ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-white" />
          <span>Analyzing Soil Chemistry & Texture...</span>
        </>
      ) : (
        <>
          <Activity className="w-4 h-4" />
          <span>Execute Soil Diagnostics</span>
        </>
      )}
    </button>
  </div>
);

const SoilNpkGrid: React.FC<{ npk: SoilAnalysisResult['npkDeficiencies'] }> = ({ npk }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'optimal':
        return 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30';
      case 'low':
        return 'text-rose-300 bg-rose-500/10 border-rose-500/30';
      default:
        return 'text-amber-300 bg-amber-500/10 border-amber-500/30';
    }
  };

  return (
    <div>
      <h4 className="text-xs font-black text-white uppercase tracking-wider mb-2">
        Nutrient Balance Matrix (NPK)
      </h4>
      <div className="grid grid-cols-3 gap-2.5">
        <div className="p-2.5 rounded-[4px] bg-slate-950 border border-slate-800 text-center">
          <div className="w-7 h-7 rounded-[3px] bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto mb-1 text-rose-400 font-bold font-mono text-xs">
            N
          </div>
          <p className="text-[10px] font-mono text-slate-400 uppercase">Nitrogen</p>
          <span className={`inline-block mt-1 px-1.5 py-0.2 rounded-[2px] text-[9px] font-mono font-bold uppercase border ${getStatusBadge(npk.nitrogen)}`}>
            {npk.nitrogen}
          </span>
        </div>

        <div className="p-2.5 rounded-[4px] bg-slate-950 border border-slate-800 text-center">
          <div className="w-7 h-7 rounded-[3px] bg-sky-500/15 border border-sky-500/30 flex items-center justify-center mx-auto mb-1 text-sky-400 font-bold font-mono text-xs">
            P
          </div>
          <p className="text-[10px] font-mono text-slate-400 uppercase">Phosphorus</p>
          <span className={`inline-block mt-1 px-1.5 py-0.2 rounded-[2px] text-[9px] font-mono font-bold uppercase border ${getStatusBadge(npk.phosphorus)}`}>
            {npk.phosphorus}
          </span>
        </div>

        <div className="p-2.5 rounded-[4px] bg-slate-950 border border-slate-800 text-center">
          <div className="w-7 h-7 rounded-[3px] bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-1 text-amber-400 font-bold font-mono text-xs">
            K
          </div>
          <p className="text-[10px] font-mono text-slate-400 uppercase">Potassium</p>
          <span className={`inline-block mt-1 px-1.5 py-0.2 rounded-[2px] text-[9px] font-mono font-bold uppercase border ${getStatusBadge(npk.potassium)}`}>
            {npk.potassium}
          </span>
        </div>
      </div>
    </div>
  );
};

const SoilResultsHUD: React.FC<{
  soilAnalysis: SoilAnalysisResult | null;
  onExport: () => void;
  isExporting: boolean;
}> = ({ soilAnalysis, onExport, isExporting }) => {
  if (!soilAnalysis) {
    return (
      <div className="p-5 rounded-[4px] bg-slate-900/80 border border-slate-800 flex flex-col justify-center space-y-4 text-center">
        <div className="py-12 text-slate-500 space-y-2">
          <FlaskConical className="w-10 h-10 mx-auto opacity-30 text-emerald-400" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Awaiting Soil Sample
          </p>
          <p className="text-[11px] font-mono text-slate-500 max-w-xs mx-auto">
            Upload topsoil photos on the left to infer texture, NPK balance, and moisture retention.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-[4px] bg-slate-900/80 border border-slate-800 space-y-4">
      {/* Overall Health Score Pod */}
      <div className="p-3.5 rounded-[4px] bg-slate-950 border border-emerald-500/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-black text-white uppercase tracking-wider">
              Agronomic Soil Index
            </h4>
          </div>
          <span className="text-[10px] font-mono text-emerald-400 font-bold">
            CONFIDENCE: {(soilAnalysis.confidence * 100).toFixed(1)}%
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-900 rounded-[2px] overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 transition-all duration-1000"
              style={{ width: `${soilAnalysis.overallHealthScore ?? 0}%` }}
            />
          </div>
          <span className="text-lg font-mono font-black text-emerald-400">
            {soilAnalysis.overallHealthScore ?? 'N/A'}/100
          </span>
        </div>
      </div>

      {/* Physics Bento Grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2.5 rounded-[4px] bg-slate-950 border border-slate-800">
          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 mb-0.5 uppercase">
            <Layers className="w-3 h-3 text-emerald-400" />
            <span>Texture Class</span>
          </div>
          <p className="text-xs font-bold text-white">{soilAnalysis.texture}</p>
        </div>

        <div className="p-2.5 rounded-[4px] bg-slate-950 border border-slate-800">
          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 mb-0.5 uppercase">
            <Droplet className="w-3 h-3 text-sky-400" />
            <span>Moisture Level</span>
          </div>
          <p className="text-xs font-bold text-white">{soilAnalysis.estimatedMoisture}</p>
        </div>

        <div className="p-2.5 rounded-[4px] bg-slate-950 border border-slate-800">
          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 mb-0.5 uppercase">
            <Activity className="w-3 h-3 text-purple-400" />
            <span>Drainage Class</span>
          </div>
          <p className="text-xs font-bold text-white">{soilAnalysis.drainageClass}</p>
        </div>

        <div className="p-2.5 rounded-[4px] bg-slate-950 border border-slate-800">
          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 mb-0.5 uppercase">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>Discoloration</span>
          </div>
          <p className="text-xs font-bold text-white truncate" title={soilAnalysis.colorDiscoloration}>
            {soilAnalysis.colorDiscoloration}
          </p>
        </div>
      </div>

      {/* NPK Grid */}
      <SoilNpkGrid npk={soilAnalysis.npkDeficiencies} />

      {/* Suitable Crops */}
      {soilAnalysis.cropSuitability.length > 0 && (
        <div>
          <h4 className="text-xs font-black text-white uppercase tracking-wider mb-1.5">
            Optimal Crop Suitability
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {soilAnalysis.cropSuitability.map((crop, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded-[3px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] font-mono"
              >
                ✓ {crop}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* PDF Export Button */}
      <div className="pt-2 border-t border-slate-800">
        <button
          onClick={onExport}
          disabled={!soilAnalysis || isExporting}
          className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-300 text-xs font-bold rounded-[3px] transition-all flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          <span>{isExporting ? 'Generating PDF...' : 'Export Soil Report (PDF)'}</span>
        </button>
      </div>
    </div>
  );
};

// eslint-disable-next-line sonarjs/cognitive-complexity
export function SoilDiagnosticsTab({
  cropType,
  setCropType,
  radiusClass: _radiusClass,
  btnClass: _btnClass,
  addNotification,
}: Props) {
  const [selectedSoilImage, setSelectedSoilImage] = useState<File | null>(null);
  const [soilImagePreview, setSoilImagePreview] = useState<string | null>(null);
  const [isAnalyzingSoil, setIsAnalyzingSoil] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [soilAnalysis, setSoilAnalysis] = useState<SoilAnalysisResult | null>(null);
  const [farmNotes, setFarmNotes] = useState('');
  const [farmersList, setFarmersList] = useState<{ id: string; firstName: string; lastName: string }[]>([]);
  const [selectedFarmerId, setSelectedFarmerId] = useState<string>('');
  const [soilProfile, setSoilProfile] = useState<FarmerSoilProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    fetchFarmers()
      .then(res => {
        if (res.success && Array.isArray(res.data?.farmers)) {
          setFarmersList(res.data.farmers);
        } else if (Array.isArray(res.data)) {
          setFarmersList(res.data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedFarmerId) {
      setSoilProfile(null);
      setProfileError(null);
      return;
    }
    setIsLoadingProfile(true);
    setProfileError(null);
    fetchFarmerSoilProfile(selectedFarmerId)
      .then(res => {
        if (res.success) setSoilProfile(res.data);
        else setProfileError('Failed to load soil profile');
      })
      .catch(err => setProfileError(err instanceof Error ? err.message : 'Failed to load soil profile'))
      .finally(() => setIsLoadingProfile(false));
  }, [selectedFarmerId]);

  const handleSoilImageSelect = (file: File) => {
    setSelectedSoilImage(file);
    const reader = new FileReader();
    reader.onload = e => {
      setSoilImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const buildRealPoints = (profile: FarmerSoilProfile | null): SoilHeatmapRealPoints | undefined => {
    if (!profile?.baseline) return undefined;
    const b = profile.baseline as unknown as Record<string, number | null>;
    const jitter = (base: number | null, spread: number) =>
      base == null
        ? undefined
        : [
            { x: 0.2, y: 0.25, val: Number((base - spread * 0.6).toFixed(2)) },
            { x: 0.45, y: 0.55, val: Number((base + spread * 0.4).toFixed(2)) },
            { x: 0.65, y: 0.3, val: base },
            { x: 0.82, y: 0.35, val: Number((base - spread * 0.3).toFixed(2)) },
            { x: 0.72, y: 0.85, val: Number((base + spread * 0.7).toFixed(2)) },
            { x: 0.25, y: 0.78, val: Number((base - spread * 0.1).toFixed(2)) },
          ];
    const phPts = jitter(b.ph as number | null, 0.4);
    const nPts = jitter(b.nitrogenMgPerKg as number | null, 8);
    const cPts = jitter(b.organicCarbonGPerKg as number | null, 3);
    const moistureVal =
      (profile.moisture as unknown as { soilMoisture?: { avgTop9cm?: number | null } })?.soilMoisture?.avgTop9cm != null
        ? (profile.moisture as unknown as { soilMoisture: { avgTop9cm: number } }).soilMoisture.avgTop9cm * 100
        : null;
    const mPts = moistureVal != null ? jitter(moistureVal, 4) : undefined;
    const result: SoilHeatmapRealPoints = {};
    if (phPts) result.ph = phPts;
    if (nPts) result.nitrogen = nPts;
    if (cPts) result.carbon = cPts;
    if (mPts) result.moisture = mPts;
    // Overlay lab pH points if available to pull interpolation toward measured values
    if (profile.labResults?.length) {
      const labPhVals = profile.labResults.map(r => r.ph).filter((v): v is number => v != null);
      if (labPhVals.length && result.ph) {
        const avgLabPh = labPhVals.reduce((a, v) => a + v, 0) / labPhVals.length;
        result.ph = [
          { x: 0.35, y: 0.5, val: Number(avgLabPh.toFixed(2)) },
          ...result.ph.slice(0, 5),
        ];
      }
    }
    return Object.keys(result).length ? result : undefined;
  };

  const handleExportSoilReport = async () => {
    if (!soilAnalysis) return;
    setIsExporting(true);
    try {
      // Generate a soil diagnostic report first, then download its PDF
      const { generateReport } = await import('../../api/reportService');
      const gen = await generateReport('soil_diagnostic', `Soil Diagnostic - ${cropType || 'General'}`, undefined);
      const reportId = (gen as { data?: { id?: string } })?.data?.id || (gen as { id?: string })?.id;
      if (!reportId) throw new Error('Report generation did not return an id');
      const blob = await downloadReportPdf(reportId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `soil-report-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Soil report downloaded');
    } catch (err) {
      console.error('Soil report export failed:', err);
      toast.error('Failed to export soil report');
    } finally {
      setIsExporting(false);
    }
  };

  const handleAnalyzeSoil = async () => {
    if (!selectedSoilImage) return;

    setIsAnalyzingSoil(true);
    setSoilAnalysis(null);
    try {
      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target?.result as string);
        reader.onerror = err => reject(err);
        reader.readAsDataURL(selectedSoilImage);
      });
      const base64 = await base64Promise;
      const imageData = base64.split(',')[1];

      const res = await analyzeSoilImage(imageData, cropType || undefined, { farmNotes });
      if (res.success) {
        setSoilAnalysis(res.data);
        toast.success('Soil diagnostics completed successfully!');
      } else {
        addNotification({
          type: 'error',
          message: 'Soil analysis failed.',
        });
      }
    } catch (error) {
      console.error('Soil analysis error:', error);
      addNotification({
        type: 'error',
        message: 'Failed to analyze soil image',
      });
    } finally {
      setIsAnalyzingSoil(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Farmer Soil Context — Real Data Provenance */}
      <div className="p-4 rounded-[4px] bg-slate-900/80 border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-400" />
            Field Soil Context
            <span className="px-1.5 py-0.5 rounded-[2px] text-[9px] font-mono bg-sky-500/10 text-sky-300 border border-sky-500/20">LIVE</span>
          </h3>
          <select
            value={selectedFarmerId}
            onChange={e => setSelectedFarmerId(e.target.value)}
            className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-[3px] text-xs text-white focus:border-sky-500 outline-none"
          >
            <option value="">Select farmer to load real soil baselines…</option>
            {farmersList.map(f => (
              <option key={f.id} value={f.id}>
                {f.firstName} {f.lastName}
              </option>
            ))}
          </select>
        </div>

        {!selectedFarmerId ? (
          <p className="text-[11px] font-mono text-slate-500">
            Choose a farmer to pull <span className="text-sky-300">ISRIC SoilGrids 250m</span> regional baseline,{' '}
            <span className="text-emerald-300">Open-Meteo</span> modeled top-soil moisture, and the farmer&apos;s real{' '}
            <span className="text-amber-300">Soil Lab History</span>. Without a farmer, soil photo inference still works as a labeled estimate.
          </p>
        ) : isLoadingProfile ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading soil profile…
          </div>
        ) : profileError ? (
          <p className="text-xs text-rose-400">{profileError}</p>
        ) : soilProfile ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* SoilGrids Baseline */}
            <div className="p-3 rounded-[3px] bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-sky-400 uppercase tracking-wider mb-1">
                <MapPin className="w-3 h-3" /> ISRIC SoilGrids 250m
              </div>
              {soilProfile.baseline && (soilProfile.baseline as { ph?: number | null }).ph !== undefined ? (
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">pH (H₂O)</span>
                    <span className="text-white font-bold">{(soilProfile.baseline as { ph: number | null }).ph ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">SOC</span>
                    <span className="text-white">{(soilProfile.baseline as { organicCarbonGPerKg: number | null }).organicCarbonGPerKg ?? '—'} g/kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">N total</span>
                    <span className="text-white">{(soilProfile.baseline as { nitrogenMgPerKg: number | null }).nitrogenMgPerKg ?? '—'} mg/kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">CEC</span>
                    <span className="text-white">{(soilProfile.baseline as { cecCmolPerKg: number | null }).cecCmolPerKg ?? '—'} cmol/kg</span>
                  </div>
                  <p className="text-[9px] text-amber-400/80 leading-tight pt-1 border-t border-slate-800">
                    ⚠️ Regional baseline (250m pixel) — not a lab test.
                  </p>
                </div>
              ) : soilProfile.location ? (
                <p className="text-xs text-amber-400">Baseline fetch failed — check connectivity.</p>
              ) : (
                <p className="text-xs text-slate-500">No geolocation for this farmer — add lat/lng to enable baseline.</p>
              )}
            </div>

            {/* Live Moisture */}
            <div className="p-3 rounded-[3px] bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 uppercase tracking-wider mb-1">
                <Droplet className="w-3 h-3" /> Open-Meteo Soil Moisture
              </div>
              {soilProfile.moisture && (soilProfile.moisture as { soilMoisture: { avgTop9cm: number | null } }).soilMoisture ? (
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">0–1 cm</span>
                    <span className="text-white">{(soilProfile.moisture as { soilMoisture: Record<string, number | null> }).soilMoisture['0-1cm'] ?? '—'} m³/m³</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">1–3 cm</span>
                    <span className="text-white">{(soilProfile.moisture as { soilMoisture: Record<string, number | null> }).soilMoisture['1-3cm'] ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">3–9 cm</span>
                    <span className="text-white">{(soilProfile.moisture as { soilMoisture: Record<string, number | null> }).soilMoisture['3-9cm'] ?? '—'}</span>
                  </div>
                  <p className="text-[9px] text-amber-400/80 leading-tight pt-1 border-t border-slate-800">
                    ⚠️ Modeled ERA5/ECMWF estimate — not a field probe.
                  </p>
                </div>
              ) : soilProfile.location ? (
                <p className="text-xs text-amber-400">Moisture fetch failed.</p>
              ) : (
                <p className="text-xs text-slate-500">No geolocation.</p>
              )}
            </div>

            {/* Lab History */}
            <div className="p-3 rounded-[3px] bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400 uppercase tracking-wider mb-1">
                <Beaker className="w-3 h-3" /> Soil Lab History
              </div>
              {soilProfile.labResults.length > 0 ? (
                <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                  {soilProfile.labResults.slice(0, 5).map(r => (
                    <div key={r.id} className="text-[11px] font-mono border-b border-slate-800 pb-1">
                      <div className="flex justify-between text-white font-bold">
                        <span>{r.labName ?? 'Lab'}</span>
                        <span className="text-slate-400">{r.testedAt ? new Date(r.testedAt).toLocaleDateString() : '—'}</span>
                      </div>
                      <div className="text-slate-400">
                        pH {r.ph ?? '—'} • N {r.nitrogenPpm ?? '—'}ppm • P {r.phosphorusPpm ?? '—'} • K {r.potassiumPpm ?? '—'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No lab results yet. Import via Field Intel → Soil Lab CSV.</p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {selectedFarmerId && soilProfile && (
        <div className="p-4 rounded-[4px] bg-slate-900/80 border border-slate-800">
          <h4 className="text-xs font-black text-white uppercase tracking-wider mb-3 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            Field Interpolation — Live SoilGrids Anchors
            <span className="ml-auto text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              {soilProfile.baseline ? 'SoilGrids 250m' : 'Lab points'}
            </span>
          </h4>
          <SoilNutrientHeatmapCanvas
            initialLayer="ph"
            realPointsByLayer={buildRealPoints(soilProfile)}
            provenanceOverride={
              soilProfile.baseline
                ? (soilProfile.baseline as { disclaimer?: string }).disclaimer ?? undefined
                : 'Live interpolation over the farmer’s lab points — add lat/lng for regional baseline.'
            }
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SoilUploadSection
        cropType={cropType}
        setCropType={setCropType}
        farmNotes={farmNotes}
        setFarmNotes={setFarmNotes}
        soilImagePreview={soilImagePreview}
        selectedSoilImage={selectedSoilImage}
        onSelectImage={handleSoilImageSelect}
        onRemoveImage={() => {
          setSelectedSoilImage(null);
          setSoilImagePreview(null);
        }}
        onAnalyze={handleAnalyzeSoil}
        isAnalyzing={isAnalyzingSoil}
      />

      <SoilResultsHUD soilAnalysis={soilAnalysis} onExport={handleExportSoilReport} isExporting={isExporting} />
      </div>
    </div>
  );
}
