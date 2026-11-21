import { useState } from 'react';
import { Camera, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { dosagePreviewText } from './dosagePreview';
import type { WorkflowStep } from './studioModel';

export function PhoneSimulator({ steps }: { steps: WorkflowStep[] }) {
  const { t } = useLanguage();
  const [selectedCrop, setSelectedCrop] = useState('Maize');
  const [severity, setSeverity] = useState(35);
  const [soilPh, setSoilPh] = useState(4.8);
  const [submitted, setSubmitted] = useState(false);

  const isArmywormVisible = selectedCrop === 'Maize';
  const isLimeVisible = soilPh < 5.5;

  return (
    <div className="w-full max-w-[280px] aspect-[9/18] rounded-[28px] border-2 border-slate-900/[0.08] dark:border-white/[0.08] bg-white dark:bg-[#0d1a14] shadow-xl p-3 flex flex-col relative overflow-hidden">
      <div className="w-20 h-4 bg-slate-100 dark:bg-white/[0.07] rounded-full mx-auto mb-2 shrink-0 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-slate-50 dark:bg-white/[0.04]" />
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 text-[11px] pe-1">
        <div className="pb-2 border-b border-slate-900/[0.08] dark:border-white/[0.08]">
          <div className="text-slate-900 dark:text-white font-medium text-[12px] flex items-center justify-between">
            <span>{t('ui_advisory_studio_page_field_scouting_pwa')}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.07] text-slate-700 dark:text-slate-300">
              {t('advisory_preview_offline', { defaultValue: 'Works offline' })}
            </span>
          </div>
          <div className="text-[10px] text-slate-400">{t('ui_advisory_studio_page_kitale_sector_4_plot_12a')}</div>
        </div>

        {steps.map((step, idx) => {
          if (step.type === 'crop_select') {
            return (
              <div key={step.id} className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08]">
                <label className="text-[10px] text-slate-400 block mb-1">
                  {t('ui_advisory_studio_page_step')} {idx + 1}{t('ui_advisory_studio_page_select_crop')}
                </label>
                <select
                  value={selectedCrop}
                  onChange={(e) => setSelectedCrop(e.target.value)}
                  className="w-full bg-white dark:bg-[#0d1a14] border border-slate-900/[0.08] dark:border-white/[0.08] rounded px-1.5 py-1 text-slate-900 dark:text-white text-[11px]"
                >
                  <option value="Maize">{t('ui_advisory_studio_page_maize_mahindi')}</option>
                  <option value="Cassava">{t('ui_advisory_studio_page_cassava_mhogo')}</option>
                  <option value="Sorghum">{t('ui_advisory_studio_page_sorghum_mtama')}</option>
                </select>
              </div>
            );
          }

          if (step.type === 'pest_scout') {
            if (!isArmywormVisible) return null;
            return (
              <div key={step.id} className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08]">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-slate-400">{t('ui_advisory_studio_page_step')} {idx + 1}{t('ui_advisory_studio_page_infestation')}</label>
                  <span className="text-amber-400 font-mono text-[10px]">{severity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={severity}
                  onChange={(e) => setSeverity(parseInt(e.target.value, 10))}
                  className="w-full accent-emerald-500 h-1 bg-slate-100 dark:bg-white/[0.07] rounded"
                />
                {severity >= 30 && (
                  <div className="mt-1 text-[9px] text-amber-800 dark:text-amber-300 font-medium flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>{t('ui_advisory_studio_page_threshold_exceeded_action_required')}</span>
                  </div>
                )}
              </div>
            );
          }

          if (step.type === 'soil_test') {
            return (
              <div key={step.id} className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08]">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] text-slate-400">{t('ui_advisory_studio_page_step')} {idx + 1}{t('ui_advisory_studio_page_soil_ph')}</label>
                  <span className="text-slate-400 font-mono text-[10px]">{soilPh.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="4.0"
                  max="7.5"
                  step="0.1"
                  value={soilPh}
                  onChange={(e) => setSoilPh(parseFloat(e.target.value))}
                  className="w-full accent-slate-400 h-1 bg-slate-100 dark:bg-white/[0.07] rounded"
                />
              </div>
            );
          }

          if (step.type === 'photo_leaf') {
            return (
              <div key={step.id} className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08]">
                <label className="text-[10px] text-slate-400 block mb-1">{t('ui_advisory_studio_page_step')} {idx + 1}{t('ui_advisory_studio_page_leaf_diagnostic')}</label>
                <div className="p-2 rounded bg-white dark:bg-[#0d1a14] border border-dashed border-slate-900/[0.08] dark:border-white/[0.08] flex flex-col items-center text-center">
                  <Camera className="w-4 h-4 text-slate-400 mb-0.5" />
                  <span className="text-[9px] text-slate-400">{t('ui_advisory_studio_page_tap_to_scan_whorl_with_camera')}</span>
                </div>
              </div>
            );
          }

          if (step.type === 'dosage_advisory') {
            const isLime = step.condition?.includes('pH');
            if (isLime && !isLimeVisible) return null;

            return (
              <div key={step.id} className="p-2 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-900/[0.08] dark:border-white/[0.08]">
                <label className="text-[10px] text-emerald-400 font-medium block mb-0.5">
                  {t('ui_advisory_studio_page_step')} {idx + 1}{t('ui_advisory_studio_page_automated_recommendation')}
                </label>
                <p className="text-[10px] text-slate-700 dark:text-slate-300 leading-snug">{dosagePreviewText(step.config, Boolean(isLime))}</p>
              </div>
            );
          }

          return null;
        })}

        <button
          type="button"
          onClick={() => setSubmitted(true)}
          className="w-full py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm transition-colors"
        >
          {submitted
            ? t('advisory_preview_finished', { defaultValue: 'Preview finished. Nothing was saved.' })
            : t('advisory_preview_finish', { defaultValue: 'Finish preview' })}
        </button>
      </div>

      <div className="w-16 h-1 bg-slate-200 dark:bg-white/[0.1] rounded-full mx-auto mt-2 shrink-0" />
    </div>
  );
}
