import React from 'react';
import { AlertTriangle, CheckCircle2, Sprout } from 'lucide-react';
import type { PlotTelemetry } from '@/pages/farmerChatSafety';
import { useLanguage } from '@/lib/LanguageContext';
import { useUnits } from '@/hooks/useUnits';

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

type Translate = (key: string, options?: { defaultValue?: string } & Record<string, unknown>) => string;

const CARD = 'p-3.5 rounded-xl bg-slate-50 dark:bg-theme-bg-primary/80 border border-slate-200/80 dark:border-white/[0.06] space-y-1';
const LABEL = 'text-sm text-slate-600 dark:text-theme-text-muted';
const NOTE = 'text-xs text-slate-500 dark:text-theme-text-muted';

function ndviBand(ndvi: number, t: Translate): string {
  if (ndvi > 0.6) return t('plot_vigor_optimal', { defaultValue: 'Optimal' });
  if (ndvi > 0.3) return t('plot_vigor_moderate', { defaultValue: 'Moderate' });
  return t('plot_vigor_low', { defaultValue: 'Low' });
}

function soilValue(r: TelemetryReading, farmer?: FarmerPlotSnapshot): string {
  if (r.loading) return '…';
  if (r.ph != null) return `${r.ph.toFixed(1)} pH / ${r.soc ?? '—'} g/kg SOC`;
  if (farmer?.ph) return `${farmer.ph.toFixed(1)} pH`;
  return '—';
}

function soilSource(r: TelemetryReading, t: Translate, farmer?: FarmerPlotSnapshot): string {
  if (r.ph != null) return t('data_status_live', { defaultValue: 'Live' });
  return farmer?.ph
    ? t('plot_source_cached', { defaultValue: 'Saved reading' })
    : t('plot_source_no_location', { defaultValue: 'No farm location' });
}

function weatherValue(r: TelemetryReading, temp: (celsius: number) => string, farmer?: FarmerPlotSnapshot): string {
  if (r.temp != null) return temp(r.temp);
  if (r.moisture != null) return `${r.moisture}% VWC`;
  if (farmer?.temperature) return temp(Number(farmer.temperature));
  return '—';
}

function hazardHeadline(h: HazardEvaluation, t: Translate): string {
  if (h.status === 'loading') return '…';
  if (h.status !== 'ready') return '—';
  if (h.hazards.length === 0) return t('plot_risk_none', { defaultValue: 'No risk thresholds reached' });
  return t('plot_risk_count', { count: h.hazards.length, defaultValue: 'Risk periods: {count}' });
}

/** The line under the headline; nothing when the headline already says it all. */
function hazardDetail(h: HazardEvaluation, t: Translate): string | null {
  if (h.status === 'ready') return h.hazards[0]?.title ?? null;
  if (h.status === 'unavailable') return t('plot_risk_unavailable', { defaultValue: 'Weather unavailable, so risk was not checked' });
  if (h.status === 'idle') return t('plot_risk_needs_region', { defaultValue: "Add the farmer's region to check risk" });
  return t('plot_risk_checking', { defaultValue: 'Checking the forecast' });
}

/** Right-hand drawer in the farmer chat: plot vigor, soil, weather and forecast thresholds. */
export const PlotTelemetryDrawer: React.FC<{
  farmer?: FarmerPlotSnapshot;
  telemetry: TelemetryReading;
  hazardEval: HazardEvaluation;
}> = ({ farmer, telemetry, hazardEval }) => {
  const { t } = useLanguage();
  const units = useUnits();
  const hazardsFound = hazardEval.status === 'ready' && hazardEval.hazards.length > 0;
  const hazardTone = hazardsFound ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400';
  const HazardIcon = hazardsFound ? AlertTriangle : CheckCircle2;

  return (
    <div className="hidden xl:flex w-72 flex-col bg-white dark:bg-white/[0.03] border border-slate-900/[0.08] dark:border-white/[0.08] rounded-lg p-5 space-y-4 overflow-y-auto">
      <h2 className="text-base font-medium text-slate-900 dark:text-white flex items-center gap-2">
        <Sprout className="w-4 h-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
        <span>{t('ui_plot_telemetry_drawer_plot_telemetry')}</span>
      </h2>

      <div className={CARD}>
        <div className={LABEL}>{t('ui_plot_telemetry_drawer_ndvi_canopy_vigor')}</div>
        <div className="text-base font-medium text-emerald-600 dark:text-emerald-400">
          {farmer?.ndvi ? `${farmer.ndvi.toFixed(2)} (${ndviBand(farmer.ndvi, t)})` : '—'}
        </div>
        <div className={NOTE}>{t('ui_plot_telemetry_drawer_sentinel_2_multispectral_add_field_p')}</div>
      </div>

      <div className={CARD}>
        <div className={LABEL}>{t('ui_plot_telemetry_drawer_soil_ph_carbon')}</div>
        <div className="text-base font-medium text-amber-600 dark:text-amber-400">{soilValue(telemetry, farmer)}</div>
        <div className={NOTE}>{t('ui_plot_telemetry_drawer_isric_soilgrids_250m')} • {soilSource(telemetry, t, farmer)}</div>
      </div>

      <div className={CARD}>
        <div className={LABEL}>{t('weather_title', { defaultValue: 'Weather' })}</div>
        <div className="text-base font-medium text-slate-600 dark:text-theme-text-muted">{weatherValue(telemetry, units.temp, farmer)}</div>
        <div className={NOTE}>{t('ui_plot_telemetry_drawer_open_meteo_modeled')} • {telemetry.temp != null ? t('data_status_live', { defaultValue: 'Live' }) : t('plot_source_no_location', { defaultValue: 'No farm location' })}</div>
      </div>

      <div className={CARD}>
        <div className={LABEL}>{t('ui_plot_telemetry_drawer_forecast_thresholds')}</div>
        <div className={`text-base font-medium ${hazardTone} flex items-center gap-1`}>
          <HazardIcon className={`w-4 h-4 shrink-0 ${hazardTone}`} aria-hidden="true" />
          <span>{hazardHeadline(hazardEval, t)}</span>
        </div>
        {hazardDetail(hazardEval, t) && <div className={NOTE}>{hazardDetail(hazardEval, t)}</div>}
        {hazardEval.status === 'ready' && (
          <div className={NOTE}>
            {t('ui_plot_telemetry_drawer_estimated_thresholds_only')} {hazardEval.evaluatedDays}/{hazardEval.totalDays} {t('ui_plot_telemetry_drawer_days_evaluated_not_an_outbreak_diagn')}
          </div>
        )}
      </div>
    </div>
  );
};
