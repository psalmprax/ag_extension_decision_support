import { useState } from 'react';
import { Layers } from 'lucide-react';
import { MapLayer, TILE_LAYERS } from './mapConstants';

interface LayerSwitcherProps {
  currentLayer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  t: (key: string) => string;
}

export function LayerSwitcher({ currentLayer, onLayerChange, t }: LayerSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: '10px', marginRight: '10px' }}>
      <div className="leaflet-control leaflet-control-layers bg-slate-900/95 text-white backdrop-blur-xl rounded-2xl shadow-xl border border-white/10 p-2 sm:p-3">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="sm:hidden flex items-center gap-1.5 px-2 py-1 text-xxs font-bold uppercase tracking-wider text-emerald-400"
          title="Switch Map Tile Layer"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{TILE_LAYERS[currentLayer].name}</span>
        </button>

        <div className={`${isOpen ? 'flex' : 'hidden sm:flex'} flex-col gap-1.5 mt-2 sm:mt-0`}>
          <div className="hidden sm:flex text-xxs font-black mb-2 text-white/50 uppercase tracking-wider items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" /> {t('map_type') || 'Map Type'}
          </div>
          {(Object.keys(TILE_LAYERS) as MapLayer[]).map(layer => (
            <button
              key={layer}
              onClick={() => {
                onLayerChange(layer);
                setIsOpen(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all text-left flex items-center justify-between gap-2 ${
                currentLayer === layer
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <span>{TILE_LAYERS[layer].name}</span>
              {currentLayer === layer && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
