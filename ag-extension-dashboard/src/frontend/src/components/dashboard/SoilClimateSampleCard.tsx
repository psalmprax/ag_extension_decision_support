import React from 'react';
import { Droplets, Sprout, Thermometer } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

/**
 * Fixed illustrative soil and climate readings. There is no live soil telemetry feed yet,
 * so this card is shown only in the demo session; real accounts never see these numbers.
 */
export const SoilClimateSampleCard: React.FC<{ cardClass: string }> = ({ cardClass }) => {
  const { t } = useLanguage();
  return (
    <div className={`${cardClass} p-4 sm:p-6 space-y-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sprout className="w-4 h-4 text-emerald-500" />
          <h3 className="text-xs sm:text-sm font-headline font-bold text-gray-900 dark:text-white  ">
            {t('ui_soil_climate_sample_card_soil_telemetry_climate_radar')}
          </h3>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
          {t('ui_soil_climate_sample_card_illustrative_sample_not_live_telemet')}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
            <Droplets className="w-3 h-3 text-slate-500" />
            <span>{t('ui_soil_climate_sample_card_soil_moisture')}</span>
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">28.4%</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{t('ui_soil_climate_sample_card_optimal_root_zone')}</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
            <Thermometer className="w-3 h-3 text-amber-500" />
            <span>{t('ui_soil_climate_sample_card_topsoil_temp')}</span>
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">22.8 °C</div>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="font-medium text-slate-600 dark:text-slate-300">{t('ui_soil_climate_sample_card_regional_soil_ph')}</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{t('ui_soil_climate_sample_card_6_2_neutral_fertile')}</span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
          <div className="bg-emerald-500 h-full rounded-full" style={{ width: '62%' }} />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-slate-400">
          <span>{t('ui_soil_climate_sample_card_acidic_4_0')}</span>
          <span>{t('ui_soil_climate_sample_card_optimal_6_5')}</span>
          <span>{t('ui_soil_climate_sample_card_alkaline_8_5')}</span>
        </div>
      </div>
    </div>
  );
};
