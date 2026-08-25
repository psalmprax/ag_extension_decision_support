import React from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import L from 'leaflet';
import { ThemeName } from '@/theme';
import { FarmerData, CROP_ICONS } from './mapConstants';

interface FarmlistSidebarProps {
  isFarmlistCollapsed: boolean;
  setIsFarmlistCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  filteredFarmers: FarmerData[];
  selectedFarmer: FarmerData | null;
  setSelectedFarmer: (f: FarmerData) => void;
  setMapCenter: (coords: [number, number]) => void;
  setMapZoom: (z: number) => void;
  setMapBounds: (b: L.LatLngBoundsExpression | undefined) => void;
  searchQuery: string;
  themeName: ThemeName;
}

export const FarmlistSidebar: React.FC<FarmlistSidebarProps> = ({
  isFarmlistCollapsed,
  setIsFarmlistCollapsed,
  filteredFarmers,
  selectedFarmer,
  setSelectedFarmer,
  setMapCenter,
  setMapZoom,
  setMapBounds,
  searchQuery,
  themeName,
}) => {
  return (
    <div
      className={`transition-all duration-300 ease-in-out flex flex-col border-r shrink-0 z-20 ${
        isFarmlistCollapsed
          ? 'w-0 opacity-0 overflow-hidden border-r-0 pointer-events-none'
          : 'w-full sm:w-80 opacity-100'
      } ${
        themeName === 'cyber'
          ? 'border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/30'
          : 'bg-white dark:bg-gray-900'
      }`}
    >
      <div
        className={`p-4 border-b flex items-center justify-between ${
          themeName === 'cyber'
            ? 'border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50'
            : 'bg-gray-50 dark:bg-gray-800/50'
        }`}
      >
        <div className="text-xs-plus uppercase tracking-wider font-bold text-gray-400">
          Farmlist ({filteredFarmers.length})
        </div>
        <button
          onClick={() => setIsFarmlistCollapsed(true)}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="Collapse Farmlist"
          aria-label="Collapse Farmlist"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {filteredFarmers.length > 0 ? (
          filteredFarmers.map(farmer => {
            const isSelected = selectedFarmer?.id === farmer.id;
            return (
              <button
                key={farmer.id}
                onClick={() => {
                  setMapCenter([farmer.lat, farmer.lng]);
                  setMapZoom(16);
                  setMapBounds(undefined);
                  setSelectedFarmer(farmer);
                  if (typeof window !== 'undefined' && window.innerWidth < 640) {
                    setIsFarmlistCollapsed(true);
                  }
                }}
                className={`w-full text-left p-3 rounded-2xl transition-all flex items-center gap-3 group ${
                  isSelected
                    ? 'bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700'
                    : 'hover:bg-white/60 dark:hover:bg-gray-800/60 border border-transparent hover:border-gray-100 dark:border-gray-700'
                }`}
              >
                <div className="text-2xl group-hover:scale-110 transition-transform">
                  {CROP_ICONS[farmer.crop.toLowerCase()] || CROP_ICONS.default}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate text-gray-800 dark:text-white">
                    {farmer.name}
                  </div>
                  <div className="text-xxs font-medium truncate text-gray-400">
                    {farmer.region} • {farmer.size}ha
                  </div>
                </div>
              </button>
            );
          })
        ) : (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 bg-gray-100 dark:bg-gray-800">
              <Search className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm text-gray-500">No farmers found for "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
};
