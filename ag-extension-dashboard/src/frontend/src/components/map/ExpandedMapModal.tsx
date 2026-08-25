import React from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import L from 'leaflet';
import { themes, ThemeName } from '@/theme';
import { FarmerData } from './mapConstants';
import { FarmlistSidebar } from './FarmlistSidebar';

interface ExpandedMapModalProps {
  theme: (typeof themes)[ThemeName];
  themeName: ThemeName;
  farmers: FarmerData[];
  filteredFarmers: FarmerData[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isFarmlistCollapsed: boolean;
  setIsFarmlistCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  selectedFarmer: FarmerData | null;
  setSelectedFarmer: (f: FarmerData) => void;
  setMapCenter: (coords: [number, number]) => void;
  setMapZoom: (z: number) => void;
  setMapBounds: (b: L.LatLngBoundsExpression | undefined) => void;
  setIsExpanded: (exp: boolean) => void;
  mapContent: React.ReactNode;
  stats: {
    cropCounts: Record<string, number>;
    totalSize: number;
    avgYield: number;
    topCrops: [string, number][];
    totalFarms: number;
  };
  t: (key: string) => string;
}

export const ExpandedMapModal: React.FC<ExpandedMapModalProps> = ({
  theme,
  themeName,
  farmers,
  filteredFarmers,
  searchQuery,
  setSearchQuery,
  isFarmlistCollapsed,
  setIsFarmlistCollapsed,
  selectedFarmer,
  setSelectedFarmer,
  setMapCenter,
  setMapZoom,
  setMapBounds,
  setIsExpanded,
  mapContent,
  stats,
  t,
}) => {
  const cropColors = ['500', '600', '700'] as const;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-modal-title"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 md:p-8 animate-in fade-in duration-300"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-xl transition-opacity"
        onClick={() => setIsExpanded(false)}
      />

      <div
        className={`relative w-full max-w-7xl h-full max-h-[92vh] sm:max-h-[90vh] rounded-2xl sm:rounded-[32px] overflow-hidden flex flex-col shadow-2xl border ${
          themeName === 'cyber'
            ? 'bg-gray-900 border-gray-800'
            : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800'
        }`}
      >
        <div
          className={`px-4 sm:px-8 py-3 sm:py-5 border-b flex items-center justify-between gap-2 sm:gap-4 ${
            themeName === 'cyber'
              ? 'border-gray-800 bg-gray-900/50'
              : 'border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50'
          }`}
        >
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              onClick={() => setIsFarmlistCollapsed(!isFarmlistCollapsed)}
              className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl border text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all shrink-0"
              title={isFarmlistCollapsed ? 'Show Farmlist' : 'Hide Farmlist'}
            >
              {isFarmlistCollapsed ? (
                <PanelLeftOpen className="w-4 sm:w-5 h-4 sm:h-5" />
              ) : (
                <PanelLeftClose className="w-4 sm:w-5 h-4 sm:h-5" />
              )}
            </button>
            <div className="min-w-0">
              <h2 id="map-modal-title" className="text-base sm:text-xl font-bold truncate text-gray-900 dark:text-white">
                {t('interactive_farmer_map') || 'Interactive Map'}
              </h2>
              <p className="text-xxs sm:text-xs text-gray-400 font-medium truncate">
                {farmers.length} {t('registered_farms_overview') || 'Registered farms'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="relative hidden md:block w-64">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={t('search_farmer_crop') || 'Search farmers, crops...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border-0 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <X className="w-4 sm:w-5 h-4 sm:h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden relative">
          <FarmlistSidebar
            isFarmlistCollapsed={isFarmlistCollapsed}
            setIsFarmlistCollapsed={setIsFarmlistCollapsed}
            filteredFarmers={filteredFarmers}
            selectedFarmer={selectedFarmer}
            setSelectedFarmer={setSelectedFarmer}
            setMapCenter={setMapCenter}
            setMapZoom={setMapZoom}
            setMapBounds={setMapBounds}
            searchQuery={searchQuery}
            themeName={themeName}
          />
          <div className="flex-1 h-full relative">{mapContent}</div>
        </div>

        <div className="px-4 sm:px-8 py-3 sm:py-4 border-t flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 backdrop-blur-sm bg-gray-50/80 dark:bg-gray-800/80 border-gray-100 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-4 sm:gap-8">
            <div className="flex flex-col">
              <span className="text-xxs uppercase font-black tracking-widest text-gray-400">
                {t('map_farms') || 'Total Farms'}
              </span>
              <span className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">{farmers.length}</span>
            </div>
            <div className="h-8 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />
            <div className="flex flex-wrap items-center gap-3 sm:gap-6">
              {stats.topCrops.map(([crop], idx) => (
                <div key={crop} className="flex items-center gap-1.5 sm:gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: theme.primary[cropColors[idx]] }}
                  />
                  <span className="text-xs sm:text-sm font-bold capitalize text-gray-600 dark:text-gray-300">
                    {crop}: <span className="font-normal text-gray-400">{stats.cropCounts[crop]}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div
            className="flex items-center gap-2 text-xs font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border"
            style={{
              color: theme.primary[600],
              backgroundColor: themeName === 'cyber' ? 'var(--color-outline)' : `${theme.primary[50]}`,
              borderColor: themeName === 'cyber' ? 'var(--color-outline)' : `${theme.primary[100]}`,
            }}
          >
            <div
              className="w-2 h-2 rounded-full animate-ping"
              style={{ backgroundColor: theme.primary[500] }}
            />
            <span className={themeName === 'cyber' ? 'text-primary-300' : ''}>System Online</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
