import React from 'react';
import { CheckCircle2, Sprout } from 'lucide-react';
import type { PlotTelemetry } from '@/pages/farmerChatSafety';
import { useLanguage } from '@/lib/LanguageContext';

// Forecast thresholds are estimates, not confirmed outbreaks or official alerts.

export interface DetectedHazard {
  hazardType: string;
  threatLevel: string;
  title: string;
}

export interface HazardEvaluation {
  conversationId: string | null;
  status: 'idle' | 'loading' | 'ready' | 'unavailable';
  hazards: DetectedHazard[];
  evaluatedDays?: number;
  totalDays?: number;
}

/** What the conversation record may carry about the farmer's plot. */
export interface FarmerPlotSnapshot {
  ndvi?: number;
  ph?: number;
  temperature?: number;
}

type TelemetryReading = Pick<PlotTelemetry, 'ph' | 'soc' | 'moisture' | 'temp' | 'loading'>;

const CARD = 'p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200/80 dark:border-white/[0.06] space-y-1';
const LABEL = 'text-[10px] font-mono text-slate-500 dark:text-white/40';
const NOTE = 'text-[9px] text-slate-500 dark:text-white/40';

function ndviBand(ndvi: number): string {
  if (ndvi > 0.6) return '(Optimal)';
  if (ndvi > 0.3) return '(Moderate)';
  return '(Low)';
}

function soilValue(t: TelemetryReading, farmer?: FarmerPlotSnapshot): string {
  if (t.loading) return '…';
  if (t.ph != null) return `${t.ph.toFixed(1)} pH / ${t.soc ?? '—'} g/kg SOC`;
  if (farmer?.ph) return `${farmer.ph.toFixed(1)} pH`;
  return '—';
}

function soilSource(t: TelemetryReading, farmer?: FarmerPlotSnapshot): string {
  if (t.ph != null) return '• live';
  return farmer?.ph ? '• cached' : '• no farmer geo';
}

function weatherValue(t: TelemetryReading, farmer?: FarmerPlotSnapshot): string {
  if (t.temp != null) return `${t.temp}°C`;
  if (t.moisture != null) return `${t.moisture}% VWC`;
  if (farmer?.temperature) return `${farmer.temperature}°C`;
  return '—';
}

function hazardHeadline(h: HazardEvaluation): string {
  if (h.status === 'loading') return '…';
  if (h.status !== 'ready') return '—';
  if (h.hazards.length === 0) return 'No thresholds triggered on evaluated days';
  return `${h.hazards.length} hazard window${h.hazards.length > 1 ? 's' : ''}`;
}

function hazardDetail(h: HazardEvaluation): string {
  if (h.status === 'ready' && h.hazards.length > 0) return h.hazards[0].title;
  if (h.status === 'unavailable') return 'Live weather unavailable — hazard evaluation skipped';
  if (h.status === 'idle') return 'Add farmer region for live hazard evaluation';
  if (h.status === 'loading') return 'Evaluating available forecast data';
  return 'No hazard thresholds detected on available days';
}

/** Right-hand drawer in the farmer chat: plot vigor, soil, weather and forecast thresholds. */
export const PlotTelemetryDrawer: React.FC<{
  farmer?: FarmerPlotSnapshot;
  telemetry: TelemetryReading;
  hazardEval: HazardEvaluation;
}> = ({ farmer, telemetry, hazardEval }) => {
  const { t } = useLanguage();
  const hazardTone = hazardEval.status === 'ready' && hazardEval.hazards.length > 0
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className="hidden xl:flex w-72 flex-col backdrop-blur-xl bg-white/95 dark:bg-slate-900/70 border border-slate-200 dark:border-white/[0.08] rounded-xl p-5 shadow-sm space-y-4 overflow-y-auto">
      <div className="text-xs font-mono font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
        <Sprout className="w-4 h-4" />
        <span>{t('ui_plot_telemetry_drawer_plot_telemetry')}</span>
      </div>

      <div className={CARD}>
        <div className={LABEL}>{t('ui_plot_telemetry_drawer_ndvi_canopy_vigor')}</div>
        <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
          {farmer?.ndvi ? `${farmer.ndvi.toFixed(2)} ${ndviBand(farmer.ndvi)}` : '—'}
        </div>
        <div className={NOTE}>{t('ui_plot_telemetry_drawer_sentinel_2_multispectral_add_field_p')}</div>
      </div>

      <div className={CARD}>
        <div className={LABEL}>{t('ui_plot_telemetry_drawer_soil_ph_carbon')}</div>
        <div className="text-base font-bold text-amber-600 dark:text-amber-400">{soilValue(telemetry, farmer)}</div>
        <div className={NOTE}>{t('ui_plot_telemetry_drawer_isric_soilgrids_250m')} {soilSource(telemetry, farmer)}</div>
      </div>

      <div className={CARD}>
        <div className={LABEL}>{t('ui_plot_telemetry_drawer_nasa_power_weather')}</div>
        <div className="text-base font-bold text-sky-600 dark:text-sky-400">{weatherValue(telemetry, farmer)}</div>
        <div className={NOTE}>{t('ui_plot_telemetry_drawer_open_meteo_modeled')} {telemetry.temp != null ? '• live' : '• no geo'}</div>
      </div>

      <div className={CARD}>
        <div className={LABEL}>{t('ui_plot_telemetry_drawer_forecast_thresholds')}</div>
        <div className={`text-base font-bold ${hazardTone} flex items-center gap-1`}>
          <CheckCircle2 className={`w-4 h-4 ${hazardTone}`} />
          <span>{hazardHeadline(hazardEval)}</span>
        </div>
        <div className={NOTE}>{hazardDetail(hazardEval)}</div>
        {hazardEval.status === 'ready' && (
          <div className={NOTE}>
            {t('ui_plot_telemetry_drawer_estimated_thresholds_only')} {hazardEval.evaluatedDays}/{hazardEval.totalDays} {t('ui_plot_telemetry_drawer_days_evaluated_not_an_outbreak_diagn')}
          </div>
        )}
      </div>
    </div>
  );
};
