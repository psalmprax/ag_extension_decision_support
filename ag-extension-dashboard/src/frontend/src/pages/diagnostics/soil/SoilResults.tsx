import React from 'react';
import { Activity, AlertTriangle, Check, Download, Droplet, FlaskConical, Layers, Loader2 } from 'lucide-react';
import type { SoilAnalysisResult } from '../../../api/diseaseService';
import { useLanguage } from '@/lib/LanguageContext';

const PANEL = 'p-5 rounded-[4px] bg-slate-50 dark:bg-theme-bg-secondary border border-slate-900/[0.08] dark:border-white/[0.08]';
const TILE = 'p-2.5 rounded-[4px] bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08]';
const STATUS_TONE: Record<string, string> = {
  optimal: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  low: 'text-rose-700 dark:text-rose-400 bg-rose-500/10 border-rose-500/30',
};
const TONE_OTHER = 'text-amber-800 dark:text-amber-300 bg-amber-500/10 border-amber-500/30';

const NutrientGrid: React.FC<{ npk: SoilAnalysisResult['npkDeficiencies'] }> = ({ npk }) => {
  const { t } = useLanguage();
  const nutrients = [
    { symbol: 'N', label: t('ui_soil_diagnostics_tab_nitrogen'), status: npk.nitrogen },
    { symbol: 'P', label: t('ui_soil_diagnostics_tab_phosphorus'), status: npk.phosphorus },
    { symbol: 'K', label: t('ui_soil_diagnostics_tab_potassium'), status: npk.potassium },
  ];
  return (
    <div>
      <h3 className="text-xs font-medium text-slate-900 dark:text-theme-text-primary mb-2">{t('ui_soil_diagnostics_tab_nutrient_balance_matrix_npk')}</h3>
      <div className="grid grid-cols-3 gap-2.5">
        {nutrients.map(n => (
          <div key={n.symbol} className={`${TILE} text-center`}>
            <div className="text-xs font-medium font-mono text-slate-700 dark:text-theme-text-secondary">{n.symbol}</div>
            <p className="text-[10px] text-slate-600 dark:text-theme-text-muted">{n.label}</p>
            <span className={`inline-block mt-1 px-1.5 rounded-[2px] text-[10px] font-medium border ${STATUS_TONE[n.status] ?? TONE_OTHER}`}>
              {n.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

interface Props {
  soilAnalysis: SoilAnalysisResult | null;
  onExport: () => void;
  isExporting: boolean;
}

/** What the soil photo analysis returned, or what to do before there is any. */
export const SoilResults: React.FC<Props> = ({ soilAnalysis, onExport, isExporting }) => {
  const { t } = useLanguage();
  if (!soilAnalysis) {
    return (
      <div className={`${PANEL} flex flex-col justify-center text-center py-12 space-y-2`}>
        <FlaskConical className="w-10 h-10 mx-auto opacity-30 text-emerald-700 dark:text-emerald-400" />
        <p className="text-xs font-medium text-slate-600 dark:text-theme-text-muted">{t('ui_soil_diagnostics_tab_awaiting_soil_sample')}</p>
        <p className="text-[11px] text-slate-600 dark:text-theme-text-muted max-w-xs mx-auto">{t('ui_soil_diagnostics_tab_upload_topsoil_photos_on_the_left_to')}</p>
      </div>
    );
  }

  const unavailable = soilAnalysis.colorDiscoloration === 'Analysis unavailable';
  const facts = [
    { icon: Layers, label: t('ui_soil_diagnostics_tab_texture_class'), value: soilAnalysis.texture },
    { icon: Droplet, label: t('ui_soil_diagnostics_tab_moisture_level'), value: soilAnalysis.estimatedMoisture },
    { icon: Activity, label: t('ui_soil_diagnostics_tab_drainage_class'), value: soilAnalysis.drainageClass },
    { icon: AlertTriangle, label: t('ui_soil_diagnostics_tab_discoloration'), value: soilAnalysis.colorDiscoloration },
  ];
  const score = soilAnalysis.overallHealthScore;

  return (
    <div className={`${PANEL} space-y-4`}>
      {unavailable && (
        <div className="flex items-start gap-2 p-2.5 rounded-[3px] bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{t('ui_soil_diagnostics_tab_analysis_unavailable_no_soil_measure')}</span>
        </div>
      )}
      <div className="p-3.5 rounded-[4px] bg-white dark:bg-theme-bg-primary border border-slate-900/[0.08] dark:border-white/[0.08]">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-medium text-slate-900 dark:text-theme-text-primary">{t('ui_soil_diagnostics_tab_agronomic_soil_index')}</h4>
          <span className="text-[11px] tabular-nums text-slate-600 dark:text-theme-text-muted">
            {t('ui_disease_saliency_canvas_confidence')} {unavailable ? '—' : `${(soilAnalysis.confidence * 100).toFixed(1)}%`}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-50 dark:bg-theme-bg-secondary rounded-[2px] overflow-hidden border border-slate-900/[0.08] dark:border-white/[0.08]">
            <div className="h-full bg-emerald-500" style={{ width: `${score ?? 0}%` }} />
          </div>
          <span className="text-base font-mono font-medium tabular-nums text-emerald-700 dark:text-emerald-400">{score == null ? '—' : `${score}/100`}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {facts.map(fact => (
          <div key={fact.label} className={TILE}>
            <div className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-theme-text-muted mb-0.5">
              <fact.icon className="w-3 h-3" />
              <span>{fact.label}</span>
            </div>
            <p className="text-xs font-medium text-slate-900 dark:text-theme-text-primary truncate" title={fact.value}>{fact.value}</p>
          </div>
        ))}
      </div>
      <NutrientGrid npk={soilAnalysis.npkDeficiencies} />
      {soilAnalysis.cropSuitability.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-slate-900 dark:text-theme-text-primary mb-1.5">{t('ui_soil_diagnostics_tab_optimal_crop_suitability')}</h4>
          <div className="flex flex-wrap gap-1.5">
            {soilAnalysis.cropSuitability.map(crop => (
              <span key={crop} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[3px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[11px]">
                <Check className="w-3 h-3" /> {crop}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="pt-2 border-t border-slate-900/[0.08] dark:border-white/[0.08]">
        <button
          type="button"
          onClick={onExport}
          disabled={isExporting}
          className="w-full py-2.5 bg-white dark:bg-theme-bg-primary hover:bg-slate-900 border border-slate-900/[0.08] dark:border-white/[0.08] text-slate-700 dark:text-theme-text-secondary text-xs font-medium rounded-[3px] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          <span>{isExporting ? t('ui_soil_results_exporting', 'Making the PDF…') : t('ui_soil_results_export', 'Download soil report (PDF)')}</span>
        </button>
      </div>
    </div>
  );
};
