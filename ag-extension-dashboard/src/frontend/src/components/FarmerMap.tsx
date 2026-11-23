import { useState, useCallback, useMemo, useEffect } from 'react';
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
import { isMapChatAllowed, isMapCallAllowed } from '@/lib/mapChatPolicy';
import { InfoPrompt, InfoPromptIcon } from '@/components/ui/InfoPrompt';
import { AudioReaderButton } from '@/components/audio/AudioReaderButton';
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
import { useFrameFarmers } from './map/useFrameFarmers';
import { LayerSwitcher } from './map/LayerSwitcher';
import { MapLegend } from './map/MapLegend';
import { ExpandedMapModal } from './map/ExpandedMapModal';
import { useUnits } from '@/hooks/useUnits';

const MAP_CONTROL = 'h-9 min-w-9 px-2 rounded-md bg-white/95 dark:bg-theme-bg-primary/95 text-slate-700 dark:text-theme-text-primary border border-slate-900/[0.1] dark:border-white/[0.12] shadow-sm hover:bg-white dark:hover:bg-theme-bg-secondary transition-colors flex items-center justify-center gap-1.5 text-sm';

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
  const [isFarmlistCollapsed, setIsFarmlistCollapsed] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  const darkMode = useAppStore(state => state.darkMode);
  const isDemo = useAppStore(state => state.isDemo);
  const user = useAppStore(state => state.user);
  const themeName = useAppStore(state => state.themeName) as ThemeName;
  const theme = themes[themeName] || themes.forest;
  const { t } = useLanguage();
  const units = useUnits();

  const canCall = isMapCallAllowed(user?.role, isDemo);
  const canChat = isMapChatAllowed(user?.role, isDemo);

  const farmers = useMemo(
    () => {
      if (propFarmers) return propFarmers;
      return isDemo ? DEFAULT_DEMO_MAP_FARMERS : [];
    },
    [propFarmers, isDemo]
  );

  useFrameFarmers(farmers, { setMapBounds, setMapCenter, setMapZoom });
  useEffect(() => {
    if (!('geolocation' in navigator) || !('permissions' in navigator)) return;
    let permissionStatus: PermissionStatus | undefined;
    let cancelled = false;
    const updateLocationIfGranted = () => {
      if (permissionStatus?.state !== 'granted' || cancelled) return;
      navigator.geolocation.getCurrentPosition(
        pos => applyGpsLocation(pos.coords.latitude, pos.coords.longitude, 'GPS position synchronized.'),
        () => {},
        { timeout: 5000, maximumAge: 60000 }
      );
    };
    navigator.permissions.query({ name: 'geolocation' }).then(result => {
      if (cancelled) return;
      permissionStatus = result;
      result.addEventListener('change', updateLocationIfGranted);
      updateLocationIfGranted();
    }).catch(() => {});
    return () => {
      cancelled = true;
      permissionStatus?.removeEventListener('change', updateLocationIfGranted);
    };
  }, []);

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

  const handleFarmerMarkerSelect = useCallback((farmer: FarmerData) => {
    setSelectedFarmer(farmer);
  }, []);

  const handleCall = (phone?: string, farmerName?: string) => {
    if (!canCall) {
      toast.error('Calling farmers is restricted to Extension Officers and Administrators.');
      return;
    }
    if (!phone) {
      toast.error('No phone number registered for this farmer.');
      return;
    }
    if (isDemo) {
      toast.success(`Demo: opening a call to ${farmerName || 'the farmer'} (${phone})`);
    } else {
      toast.success(`Calling ${farmerName || 'the farmer'}…`);
    }
    window.location.href = `tel:${phone}`;
  };

  const handleChatClick = (farmer: FarmerData) => {
    if (!canChat) {
      toast.error('Direct chat is restricted to Extension Officers and Administrators.');
      onFarmerClick?.(farmer);
      return;
    }
    onFarmerClick?.(farmer);
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
      scrollWheelZoom={false}
      dragging={typeof window === 'undefined' || !L.Browser.mobile || isExpanded}
      touchZoom={true}
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
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-theme-bg-secondary/30 flex items-center justify-center text-slate-600 dark:text-theme-text-muted mb-2">
                <Crosshair className="w-5 h-5" />
              </div>
              <h4 className="font-medium text-sm text-gray-900 dark:text-white">{t('ui_farmer_map_your_location')}</h4>
              <p className="text-xs text-gray-500 dark:text-theme-text-muted mt-1">
                {t('ui_farmer_map_extension_officer_active_gps_node')}
              </p>
              <span className="text-xxs text-slate-500 font-medium mt-2 px-2 py-0.5 rounded-md bg-slate-50 dark:bg-theme-bg-primary/40">
                {t('ui_farmer_map_lat')} {currentUserLocation[0].toFixed(4)}{t('ui_farmer_map_lng')} {currentUserLocation[1].toFixed(4)}
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
              click: e => {
                handleFarmerMarkerSelect(farmer);
                e?.target?.openPopup?.();
              },
              mouseover: e => {
                handleFarmerMarkerSelect(farmer);
                e?.target?.openPopup?.();
              },
            }}
          >
            <Popup
              className={`glass-popup ${darkMode ? 'glass-popup-dark' : ''}`}
              closeButton={false}
            >
              <div className="p-0 overflow-hidden">
                <div className="p-4 bg-emerald-800 text-white relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded-md">
                      {farmer.crop}
                    </span>
                    <span className="text-xxs font-mono opacity-80">ID: {farmer.id}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <h3 className="text-base font-medium tracking-tight">{farmer.name}</h3>
                    <AudioReaderButton
                      text={`Mkulima ${farmer.name}, eneo la ${farmer.region}. Zao kuu: ${farmer.crop}. Ukubwa wa shamba: hekta ${farmer.size}. Mavuno yanayokadiriwa: kilo ${farmer.yield || 0}.`}
                      size="xs"
                      variant="ghost"
                      className="text-white hover:text-emerald-100 hover:bg-white/20"
                    />
                  </div>
                  <p className="text-xs opacity-90">{farmer.region}</p>
                </div>

                <div className="p-4 space-y-3 bg-white dark:bg-theme-bg-secondary text-slate-800 dark:text-theme-text-primary">
                  <div className="grid grid-cols-2 gap-2 text-xxs">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-theme-bg-tertiary/60 border border-slate-100 dark:border-white/[0.08]">
                      <div className="text-slate-500">{t('ui_farmer_map_farm_area')}</div>
                      <div className="text-sm font-medium text-slate-800 dark:text-white mt-0.5">{units.area(farmer.size)}</div>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-theme-bg-tertiary/60 border border-slate-100 dark:border-white/[0.08]">
                      <div className="text-slate-500 flex items-center gap-1">
                        {t('farmer_est_yield')}
                        <InfoPromptIcon
                          title="Estimated Yield"
                          content="Projected seasonal harvest calculated from farm area, crop variety, and historical yield data."
                          variant="info"
                          ariaLabel="About estimated yield"
                        />
                      </div>
                      <div className="text-sm font-medium text-slate-800 dark:text-white mt-0.5">{farmer.yield || 0} kg</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {farmer.phone && (
                      canCall ? (
                        <button
                          onClick={() => handleCall(farmer.phone, farmer.name)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-white rounded-xl text-xs font-medium transition-all shadow-md bg-emerald-500 hover:bg-emerald-600 active:scale-95"
                          title={`Call ${farmer.name}`}
                          aria-label={`Call ${farmer.name}`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                          {t('action_call')}
                        </button>
                      ) : (
                        <InfoPrompt
                          title="Voice Calling"
                          content="Voice calls are available for extension officers, administrators, and active advisory sessions."
                          variant="guidance"
                          placement="top"
                          className="flex-1"
                        >
                          <button
                            type="button"
                            onClick={() => handleCall(farmer.phone, farmer.name)}
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-white rounded-xl text-xs font-medium transition-all bg-slate-400 dark:bg-white/[0.08] opacity-60 cursor-not-allowed"
                            aria-label={`Call ${farmer.name}`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {t('action_call')}
                          </button>
                        </InfoPrompt>
                      )
                    )}

                    {canChat ? (
                      <button
                        onClick={() => handleChatClick(farmer)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium transition-all bg-slate-100 hover:bg-slate-200 dark:bg-theme-bg-tertiary dark:hover:bg-white/[0.08] text-slate-700 dark:text-theme-text-primary active:scale-95"
                        title={`Chat with ${farmer.name}`}
                        aria-label={`Chat with ${farmer.name}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        {t('action_chat')}
                      </button>
                    ) : (
                      <InfoPrompt
                        title="Direct Chat"
                        content="Direct messaging is available for extension officers and administrators to protect farmer contact privacy."
                        variant="guidance"
                        placement="top"
                        className="flex-1"
                      >
                        <button
                          type="button"
                          onClick={() => handleChatClick(farmer)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-medium transition-all bg-slate-100 dark:bg-theme-bg-tertiary text-slate-400 opacity-60 cursor-not-allowed"
                          aria-label={`Chat with ${farmer.name}`}
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          {t('action_chat')}
                        </button>
                      </InfoPrompt>
                    )}
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}

      <OutbreakLayer />
      <LayerSwitcher currentLayer={currentLayer} onLayerChange={handleLayerChange} t={t} />
      <MapLegend show={showLegend && farmers.length > 0} crops={Object.keys(stats.cropCounts)} t={t} />
    </MapContainer>
  );

  return (
    <div
      className={`relative w-full rounded-lg overflow-hidden border ${
        themeName === 'cyber'
          ? 'border-gray-800 bg-gray-900/40'
          : 'border-slate-900/[0.08] dark:border-white/[0.08] bg-white dark:bg-theme-bg-primary'
      } ${className}`}
      style={{ height }}
    >
      <div className="absolute top-3 start-3 z-[400] flex items-center gap-1.5 sm:gap-2">
        <button
          onClick={handleLocateMe}
          className={MAP_CONTROL}
          title="Show my location" aria-label="Show my location"
        >
          <Crosshair className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          onClick={() => setShowMiniSearch(!showMiniSearch)}
          className={MAP_CONTROL}
          title="Search farmers" aria-label="Search farmers"
        >
          <Search className="w-4 h-4" aria-hidden="true" />
        </button>

        {showMiniSearch && (
          <div className="animate-in fade-in slide-in-from-left duration-200">
            <input
              type="text"
              placeholder="Filter by crop or region"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 px-3 text-sm rounded-md bg-white dark:bg-theme-bg-primary text-slate-900 dark:text-white border border-slate-900/[0.1] dark:border-white/[0.12] shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 w-40 sm:w-56"
            />
          </div>
        )}
      </div>

      <div className="absolute top-3 end-3 z-[400]">
        <button
          onClick={() => setIsExpanded(true)}
          className={MAP_CONTROL}
          title="Expand map" aria-label="Expand map"
        >
          <Maximize2 className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('ui_farmer_map_expand')}</span>
        </button>
      </div>

      {isDemo && (
        <div className="absolute bottom-3 start-3 z-[400] rounded-md bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 border border-amber-300">
          {t('ui_farmer_map_sample_demo_locations')}
        </div>
      )}

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
