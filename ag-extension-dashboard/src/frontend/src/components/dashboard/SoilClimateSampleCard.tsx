import React from 'react';
import { Droplets, Sprout, Thermometer } from 'lucide-react';

/**
 * Fixed illustrative soil and climate readings. There is no live soil telemetry feed yet,
 * so this card is shown only in the demo session; real accounts never see these numbers.
 */
export const SoilClimateSampleCard: React.FC<{ cardClass: string }> = ({ cardClass }) => {
  return (
    <div className={`${cardClass} p-4 sm:p-6 space-y-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sprout className="w-4 h-4 text-emerald-500" />
          <h3 className="text-xs sm:text-sm font-headline font-bold text-gray-900 dark:text-white uppercase tracking-widest">
            Soil Telemetry & Climate Radar
          </h3>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
          Illustrative sample · not live telemetry
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
            <Droplets className="w-3 h-3 text-sky-500" />
            <span>Soil Moisture</span>
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">28.4%</div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Optimal root zone</div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
            <Thermometer className="w-3 h-3 text-amber-500" />
            <span>Topsoil Temp</span>
          </div>
          <div className="text-sm font-bold text-slate-900 dark:text-white">22.8 °C</div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">NASA POWER data</div>
        </div>
      </div>

      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/5 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="font-medium text-slate-600 dark:text-slate-300">Regional Soil pH</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400">6.2 (Neutral / Fertile)</span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
          <div className="bg-emerald-500 h-full rounded-full" style={{ width: '62%' }} />
        </div>
        <div className="flex justify-between text-[10px] font-mono text-slate-400">
          <span>Acidic (4.0)</span>
          <span>Optimal (6.5)</span>
          <span>Alkaline (8.5)</span>
        </div>
      </div>
    </div>
  );
};
