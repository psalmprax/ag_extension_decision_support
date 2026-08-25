import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { CROP_COLORS } from './mapConstants';

interface MapLegendProps {
  show: boolean;
  t: (key: string) => string;
}

export const MapLegend: React.FC<MapLegendProps> = ({ show, t }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!show) return null;

  return (
    <div
      className="leaflet-bottom leaflet-left"
      style={{ marginBottom: '30px', marginLeft: '10px' }}
    >
      <div className="leaflet-control bg-slate-900/95 text-white backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 p-2.5 sm:p-3.5 min-w-[120px] sm:min-w-[170px]">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center justify-between w-full text-xxs font-black text-white/60 uppercase tracking-wider gap-1.5"
        >
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-emerald-400" /> {t('map_legend') || 'Crop Legend'}
          </span>
          <span className="sm:hidden text-emerald-400 text-xs font-mono">{isOpen ? '▲' : '▼'}</span>
        </button>
        <div className={`${isOpen ? 'flex' : 'hidden sm:flex'} flex-col gap-1.5 sm:gap-2 mt-2`}>
          {Object.entries(CROP_COLORS)
            .filter(([key]) => key !== 'default')
            .slice(0, 6)
            .map(([crop, color]) => (
              <div key={crop} className="flex items-center gap-2 group cursor-pointer">
                <div
                  className="w-2.5 sm:w-3.5 h-2.5 sm:h-3.5 rounded-full border border-white/20 shadow-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="text-xxs sm:text-xs capitalize text-white/70 font-medium group-hover:text-white transition-colors">
                  {crop}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};
