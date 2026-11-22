import { useRef, useEffect } from 'react';
import L from 'leaflet';
import { MapLayer, TILE_LAYERS } from './mapConstants';

interface LayerSwitcherProps {
  currentLayer: MapLayer;
  onLayerChange: (layer: MapLayer) => void;
  t: (key: string) => string;
}

export function LayerSwitcher({ currentLayer, onLayerChange, t }: LayerSwitcherProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, []);

  // A segmented control under the Expand button (top right), so the two
  // never overlap.
  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: '56px', marginRight: '12px' }}>
      <div
        ref={containerRef}
        role="radiogroup"
        aria-label={t('map_type') || 'Map type'}
        className="leaflet-control !m-0 flex rounded-md bg-white/95 dark:bg-theme-bg-primary/95 border border-slate-900/[0.1] dark:border-white/[0.12] shadow-sm p-0.5"
      >
        {(Object.keys(TILE_LAYERS) as MapLayer[]).map(layer => (
          <button
            key={layer}
            type="button"
            role="radio"
            aria-checked={currentLayer === layer}
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              onLayerChange(layer);
            }}
            className={`h-8 px-2.5 rounded text-xs transition-colors ${
              currentLayer === layer
                ? 'bg-emerald-700 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {TILE_LAYERS[layer].name}
          </button>
        ))}
      </div>
    </div>
  );
}
