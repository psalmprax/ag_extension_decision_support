import { useState, useCallback, useMemo } from 'react';
import { OutbreakLayer } from '@/components/outbreaks/OutbreakLayer';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Maximize2,
  Phone,
  MessageSquare,
  Crosshair,
  Search,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { themes, ThemeName } from '@/theme';
import { useLanguage } from '@/lib/LanguageContext';
import toast from 'react-hot-toast';
import {
  FarmerData,
  MapLayer,
  TILE_LAYERS,
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
  DEFAULT_DEMO_MAP_FARMERS,
  createMarkerIcon,
  createCurrentUserMarkerIcon,
  MAP_STYLES,
} from './map/mapConstants';
import { MapController } from './map/MapController';
import { LayerSwitcher } from './map/LayerSwitcher';
import { MapLegend } from './map/MapLegend';
import { ExpandedMapModal } from './map/ExpandedMapModal';

export type { FarmerData };

export interface FarmerMapProps {
  initialCenter?: [number, number];
  initialZoom?: number;
  showLegend?: boolean;
  height?: string;
  className?: string;
  onFarmerClick?: (farmer: FarmerData) => void;
  farmers?: FarmerData[];
  isExternalExpanded?: boolean;
  onToggleExpand?: (isExpanded: boolean) => void;
}

export function FarmerMap({
  initialCenter = DEFAULT_CENTER,
  initialZoom = DEFAULT_ZOOM,
  showLegend = true,
  height = '400px',
  className = '',
  onFarmerClick,
  farmers: propFarmers,
  isExternalExpanded,
  onToggleExpand,
}: FarmerMapProps) {
  const [currentLayer, setCurrentLayer] = useState<MapLayer>('street');
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerData | null>(null);
  const [internalExpanded, setInternalExpanded] = useState(false);

  const isExpanded = isExternalExpanded !== undefined ? isExternalExpanded : internalExpanded;
  const setIsExpanded = (val: boolean) => {
    setInternalExpanded(val);
    onToggleExpand?.(val);
  };
  const [currentUserLocation, setCurrentUserLocation] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(initialCenter);
  const [mapZoom, setMapZoom] = useState<number>(initialZoom);
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMiniSearch, setShowMiniSearch] = useState(false);
  const [isFarmlistCollapsed, setIsFarmlistCollapsed] = useState(false);

  // Get theme from store
  const darkMode = useAppStore(state => state.darkMode);
  const isDemo = useAppStore(state => state.isDemo);
  const themeName = useAppStore(state => state.themeName) as ThemeName;
  const theme = themes[themeName] || themes.forest;
  const { t } = useLanguage();

  const farmers = useMemo(
    () => {
      if (propFarmers && propFarmers.length > 0) return propFarmers;
      if (isDemo) return DEFAULT_DEMO_MAP_FARMERS;
      // When real data is empty and not in demo mode, show empty (not demo) to avoid data leak
      if (propFarmers && propFarmers.length === 0) return [];
      return DEFAULT_DEMO_MAP_FARMERS;
    },
    [propFarmers, isDemo]
  );

  // Compute stats from farmer data
  const stats = useMemo(() => {
    const cropCounts = farmers.reduce(
      (acc, f) => {
        acc[f.crop] = (acc[f.crop] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const totalSize = farmers.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
    const validYields = farmers.filter(f => f.yield && !isNaN(Number(f.yield)));
    const avgYield =
      validYields.length > 0
        ? validYields.reduce((sum, f) => sum + Number(f.yield), 0) / validYields.length
        : 0;

    const topCrops = Object.entries(cropCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3);

    return { cropCounts, totalSize, avgYield, topCrops, totalFarms: farmers.length };
  }, [farmers]);

  const filteredFarmers = useMemo(() => {
    return farmers.filter(f => {
      const fullName = f.name;
      const searchStr = searchQuery.toLowerCase();
      return (
        fullName.toLowerCase().includes(searchStr) ||
        (f.crop?.toLowerCase() || '').includes(searchStr) ||
        (f.region?.toLowerCase() || '').includes(searchStr)
      );
    });
  }, [farmers, searchQuery]);

  const applyGpsLocation = (lat: number, lng: number, message: string) => {
    setCurrentUserLocation([lat, lng]);
    setMapCenter([lat, lng]);
    setMapZoom(14);
    setMapBounds(undefined);
    toast.success(message, { id: 'gps-detect' });
  };

  const handleLocateMe = () => {
    const fallbackLat = farmers.length > 0 ? farmers[0].lat + 0.003 : -1.2863;
    const fallbackLng = farmers.length > 0 ? farmers[0].lng + 0.003 : 36.8172;

    if (!('geolocation' in navigator)) {
      applyGpsLocation(fallbackLat, fallbackLng, 'Using regional GPS fallback (East Africa Hub)');
      return;
    }

    toast.loading('Detecting your location...', { id: 'gps-detect' });
    navigator.geolocation.getCurrentPosition(
      pos => applyGpsLocation(pos.coords.latitude, pos.coords.longitude, 'Location updated!'),
      () => applyGpsLocation(fallbackLat, fallbackLng, 'Using regional GPS fallback (East Africa Hub)'),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const handleFarmerClick = useCallback(
    (farmer: FarmerData) => {
      setSelectedFarmer(farmer);
      onFarmerClick?.(farmer);
    },
    [onFarmerClick]
  );

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleLayerChange = useCallback((layer: MapLayer) => {
    setCurrentLayer(layer);
  }, []);

  const tileLayer = TILE_LAYERS[currentLayer];

  const mapContent = (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      style={{ height: '100%', width: '100%' }}
      zoomControl={false}
    >
      <style>{MAP_STYLES}</style>
      <MapController center={mapCenter} zoom={mapZoom} bounds={mapBounds} />
      <ZoomControl position="bottomright" />

      <TileLayer
        key={tileLayer.url}
        url={tileLayer.url}
        attribution={tileLayer.attribution}
        maxZoom={tileLayer.maxZoom}
      />

      {currentUserLocation && (
        <Marker position={currentUserLocation} icon={createCurrentUserMarkerIcon()}>
          <Popup
            className={`glass-popup ${darkMode ? 'glass-popup-dark' : ''}`}
            closeButton={false}
          >
            <div className="p-4 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-2">
                <Crosshair className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-gray-900 dark:text-white">Your Location</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Extension Officer / Active GPS Node
              </p>
              <span className="text-xxs text-blue-500 font-semibold mt-2 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40">
                Lat: {currentUserLocation[0].toFixed(4)}, Lng: {currentUserLocation[1].toFixed(4)}
              </span>
            </div>
          </Popup>
        </Marker>
      )}

      {filteredFarmers.map(farmer => {
        const isSelected = selectedFarmer?.id === farmer.id;
        return (
          <Marker
            key={farmer.id}
            position={[farmer.lat, farmer.lng]}
            icon={createMarkerIcon(farmer.crop, isSelected)}
            eventHandlers={{
              click: () => handleFarmerClick(farmer),
            }}
          >
            <Popup
              className={`glass-popup ${darkMode ? 'glass-popup-dark' : ''}`}
              closeButton={false}
            >
              <div className="p-0 overflow-hidden">
                <div className="p-4 bg-gradient-to-br from-emerald-500 to-teal-700 text-white relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xxs font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md backdrop-blur-md">
                      {farmer.crop}
                    </span>
                    <span className="text-xxs font-mono opacity-80">ID: {farmer.id}</span>
                  </div>
                  <h3 className="text-base font-black mt-1 tracking-tight">{farmer.name}</h3>
                  <p className="text-xs opacity-90">{farmer.region}</p>
                </div>

                <div className="p-4 space-y-3 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                  <div className="grid grid-cols-2 gap-2 text-xxs">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <div className="text-slate-400 font-bold uppercase tracking-wider">Farm Area</div>
                      <div className="text-sm font-black text-slate-800 dark:text-white mt-0.5">{farmer.size} ha</div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <div className="text-slate-400 font-bold uppercase tracking-wider">Est. Yield</div>
                      <div className="text-sm font-black text-slate-800 dark:text-white mt-0.5">{farmer.yield || 0} kg</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {farmer.phone && (
                      <button
                        onClick={() => handleCall(farmer.phone!)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-500/20"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        Call
                      </button>
                    )}
                    <button
                      onClick={() => onFarmerClick?.(farmer)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Chat
                    </button>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      <OutbreakLayer />
      <LayerSwitcher currentLayer={currentLayer} onLayerChange={handleLayerChange} t={t} />
      <MapLegend show={showLegend} t={t} />
    </MapContainer>
  );

  return (
    <div
      className={`relative w-full rounded-xl overflow-hidden border shadow-xl ${
        themeName === 'cyber'
          ? 'border-gray-800 bg-gray-900/40'
          : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
      } ${className}`}
      style={{ height }}
    >
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={handleLocateMe}
          className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 text-white border border-white/10 shadow-lg backdrop-blur-md hover:bg-slate-800 active:scale-95 transition-all"
          title="Locate Current Position"
          aria-label="Locate Current Position"
        >
          <Crosshair className="w-4 h-4 text-emerald-400" />
        </button>

        <button
          onClick={() => setShowMiniSearch(!showMiniSearch)}
          className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 text-white border border-white/10 shadow-lg backdrop-blur-md hover:bg-slate-800 active:scale-95 transition-all"
          title="Search Farmers"
          aria-label="Search Farmers"
        >
          <Search className="w-4 h-4 text-emerald-400" />
        </button>

        {showMiniSearch && (
          <div className="animate-in fade-in slide-in-from-left duration-200">
            <input
              type="text"
              placeholder="Filter crops, region..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl bg-slate-900/95 text-white border border-white/20 backdrop-blur-md shadow-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 w-40 sm:w-56"
            />
          </div>
        )}
      </div>

      <div className="absolute top-3 right-3 z-[400]">
        <button
          onClick={() => setIsExpanded(true)}
          className="p-2 sm:p-2.5 rounded-xl bg-slate-900/90 text-white border border-white/10 shadow-lg backdrop-blur-md hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-bold"
          title="Expand Map Fullscreen"
          aria-label="Expand Map Fullscreen"
        >
          <Maximize2 className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Expand</span>
        </button>
      </div>

      {mapContent}

      {isExpanded && (
        <ExpandedMapModal
          theme={theme}
          themeName={themeName}
          farmers={farmers}
          filteredFarmers={filteredFarmers}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isFarmlistCollapsed={isFarmlistCollapsed}
          setIsFarmlistCollapsed={setIsFarmlistCollapsed}
          selectedFarmer={selectedFarmer}
          setSelectedFarmer={setSelectedFarmer}
          setMapCenter={setMapCenter}
          setMapZoom={setMapZoom}
          setMapBounds={setMapBounds}
          setIsExpanded={setIsExpanded}
          mapContent={mapContent}
          stats={stats}
          t={t}
        />
      )}
    </div>
  );
}

export default FarmerMap;
