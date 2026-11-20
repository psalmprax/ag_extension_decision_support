import React, { useState } from 'react';
import { Info, ChevronDown } from 'lucide-react';
import { CROP_COLORS } from './mapConstants';

interface MapLegendProps {
  show: boolean;
  /** Crops on the map; the legend lists only these. */
  crops: string[];
  t: (key: string) => string;
}

export const MapLegend: React.FC<MapLegendProps> = ({ show, crops, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!show || crops.length === 0) return null;
  const entries = Array.from(new Set(crops.map(c => c.toLowerCase())))
    .slice(0, 8)
    .map(crop => [crop, CROP_COLORS[crop] ?? CROP_COLORS.default] as const);

  return (
    <div
      className="leaflet-bottom leaflet-left"
      style={{ marginBottom: '30px', marginLeft: '10px' }}
    >
      <div className="leaflet-control bg-white/95 dark:bg-[#0d1a14]/95 text-slate-900 dark:text-slate-100 rounded-md shadow-sm border border-slate-900/[0.08] dark:border-white/[0.1] p-2.5 sm:p-3 min-w-[120px] sm:min-w-[150px]">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-full text-xs font-medium text-slate-600 dark:text-slate-300 gap-1.5"
        >
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" aria-hidden="true" /> {t('map_legend') || 'Crops'}
          </span>
          <ChevronDown className={`sm:hidden w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        <div className={`${isOpen ? 'flex' : 'hidden sm:flex'} flex-col gap-1.5 sm:gap-2 mt-2`}>
          {entries.map(([crop, color]) => (
              <div key={crop} className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xs capitalize text-slate-700 dark:text-slate-200">
                  {crop}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
