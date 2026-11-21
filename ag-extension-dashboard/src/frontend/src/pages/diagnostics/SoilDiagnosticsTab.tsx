import React, { useState, useEffect } from 'react';
import { Layers, Droplet, AlertTriangle, Loader2, MapPin, Database, Beaker } from 'lucide-react';
import { analyzeSoilImage, type SoilAnalysisResult } from '../../api/diseaseService';
import { SoilSampleForm } from './soil/SoilSampleForm';
import { SoilResults } from './soil/SoilResults';
import { downloadReportPdf } from '../../api/reportService';
import { fetchFarmerSoilProfile, type FarmerSoilProfile } from '../../api/soilService';
import { fetchFarmers, updateFarmer } from '../../api/farmerService';
import { requestGpsFix } from '@/lib/geo';
import { SoilNutrientHeatmapCanvas, type SoilHeatmapRealPoints } from '../../components/canvas-ui/SoilNutrientHeatmapCanvas';
import { useDemoMode } from '@/demo';
import toast from 'react-hot-toast';
import { useLanguage } from '@/lib/LanguageContext';

interface Props {
  cropType: string;
  setCropType: (val: string) => void;
  radiusClass: string;
  btnClass: string;
  addNotification: (notification: { type: string; message: string }) => void;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function SoilDiagnosticsTab({
  cropType,
  setCropType,
  radiusClass: _radiusClass,
  btnClass: _btnClass,
  addNotification,
}: Props) {
  const { t } = useLanguage();
  const { isDemo } = useDemoMode();
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
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [profileReloadKey, setProfileReloadKey] = useState(0);
  const [farmersError, setFarmersError] = useState<string | null>(null);

  useEffect(() => {
    fetchFarmers()
      .then(res => {
        if (res.success && Array.isArray(res.data?.farmers)) {
          setFarmersList(res.data.farmers);
        } else if (Array.isArray(res.data)) {
          setFarmersList(res.data);
        }
      })
      .catch((err: unknown) => setFarmersError(err instanceof Error ? err.message : 'request failed'));
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
  }, [selectedFarmerId, profileReloadKey]);

  /** Capture the device GPS fix and save it as the farmer's field location. */
  const handleCaptureLocation = () => {
    if (!selectedFarmerId || isSavingLocation) return;
    setIsSavingLocation(true);
    setLocationNotice(null);
    requestGpsFix()
      .then(async fix => {
        try {
          await updateFarmer(selectedFarmerId, {
            locationLat: fix.latitude,
            locationLng: fix.longitude,
          });
          setLocationNotice('Field location saved — loading the soil estimate…');
          setProfileReloadKey(k => k + 1);
        } catch {
          setLocationNotice('Could not save the location. Check connectivity and try again.');
        } finally {
          setIsSavingLocation(false);
        }
      })
      .catch((err: unknown) => {
        setIsSavingLocation(false);
        setLocationNotice(err instanceof Error ? err.message : 'Could not read GPS. Try again.');
      });
  };

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
    // Honest: a single SoilGrids 250m pixel gives one value per property for the farm centroid.
    // Do NOT synthesize spatial variation. Use a uniform field (all points same value) so the heatmap
    // shows a flat color until the farmer has multiple field polygons or lab points with coordinates.
    const uniform = (base: number | null) => (base == null ? undefined : [
      { x: 0.2, y: 0.25, val: base }, { x: 0.45, y: 0.55, val: base }, { x: 0.65, y: 0.3, val: base },
      { x: 0.82, y: 0.35, val: base }, { x: 0.72, y: 0.85, val: base }, { x: 0.25, y: 0.78, val: base },
    ]);
    const phPts = uniform(b.ph as number | null);
    const nPts = uniform(b.nitrogenMgPerKg as number | null);
    const cPts = uniform(b.organicCarbonGPerKg as number | null);
    const moistureVal =
      (profile.moisture as unknown as { soilMoisture?: { avgTop9cm?: number | null } })?.soilMoisture?.avgTop9cm != null
        ? (profile.moisture as unknown as { soilMoisture: { avgTop9cm: number } }).soilMoisture.avgTop9cm * 100
        : null;
    const mPts = moistureVal != null ? uniform(moistureVal) : undefined;
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
        if (res.data.colorDiscoloration === 'Analysis unavailable') {
          toast.error('Soil image analysis is unavailable. No measurements were generated.');
          addNotification({
            type: 'error',
            message: 'Soil image analysis is unavailable — no measurements were generated.',
          });
        } else {
          toast.success(t('ui_soil_tab_done', 'Soil photo analyzed'));
        }
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
          <h3 className="text-xs font-medium text-white flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-400" />
            {t('ui_soil_diagnostics_tab_field_soil_context')}
            <span className="px-1.5 py-0.5 rounded-[2px] text-[9px] font-mono bg-slate-500/10 text-slate-300 border border-slate-500/20">{t('ui_live_activity_stream_live')}</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedFarmerId}
              onChange={e => setSelectedFarmerId(e.target.value)}
              className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-[3px] text-xs text-white focus:border-slate-500 outline-none"
            >
              <option value="">{t('ui_soil_diagnostics_tab_select_farmer_to_load_real_soil_base')}</option>
              {farmersList.map(f => (
                <option key={f.id} value={f.id}>
                  {f.firstName} {f.lastName}
                </option>
              ))}
            </select>
            {selectedFarmerId && (
              <button
                type="button"
                onClick={handleCaptureLocation}
                disabled={isSavingLocation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] text-xs font-medium bg-slate-600 text-white hover:bg-slate-500 disabled:opacity-50 disabled:cursor-wait transition-colors"
              >
                {isSavingLocation ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MapPin className="w-3.5 h-3.5" />
                )}
                {isSavingLocation ? 'Saving location…' : 'Use my location'}
              </button>
            )}
          </div>
        </div>
        {farmersError && (
          <p className="text-[11px] text-rose-400 mb-3" role="alert">
            {t('ui_soil_tab_farmers_failed', 'Could not load your farmers. Check the connection and reload.')} ({farmersError})
          </p>
        )}
        {locationNotice && (
          <p className="text-[11px] text-slate-300 mb-3" role="status">
            {locationNotice}
          </p>
        )}

        {!selectedFarmerId ? (
          <p className="text-[11px] font-mono text-slate-500">
            {t('ui_soil_diagnostics_tab_choose_a_farmer_to_load_their_soil_s')}{' '}
            {t('ui_soil_diagnostics_tab_recent_topsoil_moisture_and_the_farm')}{' '}
            <span className="text-amber-300">{t('ui_soil_diagnostics_tab_soil_lab_history')}</span>{t('ui_soil_diagnostics_tab_without_a_farmer_soil_photo_inferenc')}
          </p>
        ) : isLoadingProfile ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" /> {t('ui_soil_diagnostics_tab_loading_soil_profile')}
          </div>
        ) : profileError ? (
          <p className="text-xs text-rose-400">{profileError}</p>
        ) : soilProfile ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* SoilGrids Baseline */}
            <div className="p-3 rounded-[3px] bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 mb-1">
                <MapPin className="w-3 h-3" /> {t('ui_plot_telemetry_drawer_isric_soilgrids_250m')}
              </div>
              {soilProfile.baseline && (soilProfile.baseline as { ph?: number | null }).ph !== undefined ? (
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400">pH (H₂O)</span>
                    <span className="text-white font-medium">{(soilProfile.baseline as { ph: number | null }).ph ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">SOC</span>
                    <span className="text-white">{(soilProfile.baseline as { organicCarbonGPerKg: number | null }).organicCarbonGPerKg ?? '—'} g/kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t('ui_soil_diagnostics_tab_n_total')}</span>
                    <span className="text-white">{(soilProfile.baseline as { nitrogenMgPerKg: number | null }).nitrogenMgPerKg ?? '—'} mg/kg</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">CEC</span>
                    <span className="text-white">{(soilProfile.baseline as { cecCmolPerKg: number | null }).cecCmolPerKg ?? '—'} {t('ui_soil_diagnostics_tab_cmol_kg')}</span>
                  </div>
                  <p className="text-[10px] text-amber-400/80 leading-tight pt-1 border-t border-slate-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{t('ui_soil_diagnostics_tab_satellite_estimate_for_this_area_not')}</span>
                  </p>
                </div>
              ) : soilProfile.location ? (
                <p className="text-xs text-amber-400">{t('ui_soil_diagnostics_tab_baseline_fetch_failed_check_connecti')}</p>
              ) : (
                <p className="text-xs text-slate-500">{t('ui_soil_diagnostics_tab_no_field_location_saved_yet_tap_use')}</p>
              )}
            </div>

            {/* Live Moisture */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-1.5 text-xxs font-mono text-emerald-400 mb-1">
                <Droplet className="w-3 h-3" /> {t('ui_soil_diagnostics_tab_open_meteo_soil_moisture')}
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
                  <p className="text-[10px] text-amber-400/80 leading-tight pt-1 border-t border-slate-800 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{t('ui_soil_diagnostics_tab_modeled_era5_ecmwf_estimate_not_a_fi')}</span>
                  </p>
                </div>
              ) : soilProfile.location ? (
                <p className="text-xs text-amber-400">{t('ui_soil_diagnostics_tab_moisture_fetch_failed')}</p>
              ) : (
                <p className="text-xs text-slate-500">{t('ui_soil_diagnostics_tab_no_field_location_yet')}</p>
              )}
            </div>

            {/* Lab History */}
            <div className="p-3 rounded-[3px] bg-slate-950 border border-slate-800">
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400 mb-1">
                <Beaker className="w-3 h-3" /> {t('ui_soil_diagnostics_tab_soil_lab_history')}
              </div>
              {soilProfile.labResults.length > 0 ? (
                <div className="space-y-1.5 max-h-28 overflow-y-auto pe-1">
                  {soilProfile.labResults.slice(0, 5).map(r => (
                    <div key={r.id} className="text-[11px] font-mono border-b border-slate-800 pb-1">
                      <div className="flex justify-between text-white font-medium">
                        <span>{r.labName ?? 'Lab'}</span>
                        <span className="text-slate-400">{r.testedAt ? new Date(r.testedAt).toLocaleDateString() : '—'}</span>
                      </div>
                      <div className="text-slate-400">
                        pH {r.ph ?? '—'} • N {r.nitrogenPpm ?? '—'}{t('ui_soil_diagnostics_tab_ppm_p')} {r.phosphorusPpm ?? '—'} • K {r.potassiumPpm ?? '—'}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">{t('ui_soil_diagnostics_tab_no_lab_results_yet_import_via_field')}</p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {selectedFarmerId && soilProfile && (() => {
        const realPoints = buildRealPoints(soilProfile);
        const hasLive = Boolean(realPoints && Object.keys(realPoints).length);
        if (!hasLive && !isDemo) {
          return (
            <div className="p-4 rounded-[4px] bg-slate-900/80 border border-slate-800 text-center">
              <p className="text-xs font-medium text-white">{t('ui_soil_diagnostics_tab_live_soil_map_per_farmer')}</p>
              <p className="text-xs text-white/50 mt-1 max-w-md mx-auto">{t('ui_soil_diagnostics_tab_no_live_soil_map_yet_tap_use_my_loca')}</p>
            </div>
          );
        }
        return (
          <div className="p-4 rounded-[4px] bg-slate-900/80 border border-slate-800">
            <h4 className="text-xs font-medium text-white mb-3 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              {t('ui_soil_diagnostics_tab_field_map')} {hasLive ? t('ui_soil_tab_map_estimate', 'estimate') : t('ui_soil_tab_map_demo', 'demo preview')}
              <span className={`ms-auto text-[9px] font-mono px-1.5 py-0.5 rounded border ${hasLive ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-amber-300 bg-amber-500/10 border-amber-500/20'}`}>
                {hasLive ? t('ui_live_activity_stream_live') : t('ui_soil_tab_demo_badge', 'Demo')}
              </span>
            </h4>
            <SoilNutrientHeatmapCanvas
              initialLayer="ph"
              realPointsByLayer={realPoints}
              provenanceOverride={
                hasLive
                  ? (soilProfile.baseline as { disclaimer?: string })?.disclaimer ?? undefined
                  : 'Demo preview mesh — not a field measurement.'
              }
            />
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SoilSampleForm
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

      <SoilResults soilAnalysis={soilAnalysis} onExport={handleExportSoilReport} isExporting={isExporting} />
      </div>
    </div>
  );
}
