import { Layers, CloudRain, Bug, TrendingUp } from 'lucide-react';

export type OverlayLayer = 'weather' | 'disease' | 'market' | 'none';

interface MapLayerToggleProps {
  currentTileLayer: string;
  onTileLayerChange: (layer: string) => void;
  availableTileLayers: Record<string, { name: string; url: string }>;
  currentOverlay: OverlayLayer;
  onOverlayChange: (overlay: OverlayLayer) => void;
}

export const MapLayerToggle = ({
  currentTileLayer,
  onTileLayerChange,
  availableTileLayers,
  currentOverlay,
  onOverlayChange
}: MapLayerToggleProps) => {
  return (
    <div className="leaflet-control leaflet-control-layers bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100/50 dark:border-gray-700/50 p-3 space-y-4">
      {/* Base Map Layers */}
      <div>
        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center">
          <Layers className="w-3 h-3 mr-1" />
          Base Maps
        </h4>
        <div className="space-y-1">
          {Object.keys(availableTileLayers).map(layer => (
            <button
              key={layer}
              onClick={() => onTileLayerChange(layer)}
              className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center justify-between ${
                currentTileLayer === layer
                  ? 'bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              {availableTileLayers[layer].name}
              {currentTileLayer === layer && (
                <div className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(var(--color-primary-500),0.6)]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Overlay Layers */}
      <div>
        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
          Data Overlays
        </h4>
        <div className="space-y-1">
          <button
            onClick={() => onOverlayChange(currentOverlay === 'weather' ? 'none' : 'weather')}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center ${
              currentOverlay === 'weather'
                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            <CloudRain className="w-4 h-4 mr-2" />
            Weather Radar
          </button>
          <button
            onClick={() => onOverlayChange(currentOverlay === 'disease' ? 'none' : 'disease')}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center ${
              currentOverlay === 'disease'
                ? 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            <Bug className="w-4 h-4 mr-2" />
            Disease Hotspots
          </button>
          <button
            onClick={() => onOverlayChange(currentOverlay === 'market' ? 'none' : 'market')}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm font-medium transition-colors flex items-center ${
              currentOverlay === 'market'
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
            }`}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Market Heatmap
          </button>
        </div>
      </div>
    </div>
  );
};
