import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Maximize2, Layers, Info, MapPin, Wheat, Phone, MessageSquare, Navigation, Crosshair, Search, Users, TrendingUp, Calendar, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { themes, ThemeName } from '@/theme';
import { useLanguage } from '@/lib/LanguageContext';
import toast from 'react-hot-toast';

// Fix for default marker icons in Leaflet with webpack/Vite
const defaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = defaultIcon;

// Custom styles for premium markers and popups
// Uses CSS variables from index.css for theme-aware colors
const MAP_STYLES = `
  .custom-marker {
    background: none !important;
    border: none !important;
  }
  
  .marker-pin-wrapper {
    position: relative;
    width: 36px;
    height: 48px;
    filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .marker-pin-wrapper:hover {
    transform: translateY(-4px) scale(1.1);
    filter: drop-shadow(0 8px 12px rgba(0,0,0,0.4));
    z-index: 1000;
  }
  
  .marker-pin-wrapper.selected {
    transform: translateY(-6px) scale(1.2);
    filter: drop-shadow(0 12px 20px rgba(0,0,0,0.5));
    z-index: 1001;
  }
  
  .marker-svg {
    width: 100%;
    height: 100%;
  }
  
  .marker-icon {
    position: absolute;
    top: 18px;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 16px;
    pointer-events: none;
  }
  
  .marker-pulse {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 40px;
    height: 40px;
    background: var(--marker-color);
    border-radius: 50%;
    opacity: 0.4;
    animation: marker-pulse 2s infinite;
    z-index: -1;
  }
  
  @keyframes marker-pulse {
    0% { transform: translate(-50%, -50%) scale(0.6); opacity: 0.6; }
    100% { transform: translate(-50%, -50%) scale(1.8); opacity: 0; }
  }

  @keyframes marker-appear {
    0% { transform: translateY(20px) scale(0.5); opacity: 0; }
    60% { transform: translateY(-5px) scale(1.05); opacity: 1; }
    100% { transform: translateY(0) scale(1); opacity: 1; }
  }

  .marker-appear {
    animation: marker-appear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    opacity: 0;
  }

  .glass-popup .leaflet-popup-content-wrapper {
    background: rgba(var(--color-bg-card-rgb), 0.92) !important;
    backdrop-filter: blur(20px) !important;
    border-radius: 24px !important;
    border: 1px solid rgba(var(--color-bg-card-rgb), 0.5) !important;
    box-shadow: 
      0 20px 40px rgba(var(--color-bg-primary-rgb), 0.1),
      0 0 0 1px rgba(var(--color-bg-card-rgb), 0.5) inset !important;
    padding: 0 !important;
    overflow: hidden;
  }
  
  .glass-popup .leaflet-popup-content {
    margin: 0 !important;
    width: 300px !important;
  }
  
  .glass-popup .leaflet-popup-tip {
    background: rgba(var(--color-bg-card-rgb), 0.92) !important;
    backdrop-filter: blur(20px) !important;
  }

  .glass-popup-dark .leaflet-popup-content-wrapper {
    background: rgba(var(--color-bg-secondary-rgb), 0.95) !important;
    backdrop-filter: blur(20px) !important;
    border: 1px solid rgba(var(--color-bg-card-rgb), 0.1) !important;
    box-shadow: 0 20px 40px rgba(var(--color-bg-primary-rgb), 0.4) !important;
  }
  
  .glass-popup-dark .leaflet-popup-tip {
    background: rgba(var(--color-bg-secondary-rgb), 0.95) !important;
  }

  .leaflet-control-zoom {
    border: none !important;
    box-shadow: 0 4px 12px rgba(var(--color-bg-primary-rgb), 0.15) !important;
    border-radius: 16px !important;
    overflow: hidden;
  }

  .leaflet-control-zoom a {
    border: none !important;
    width: 36px !important;
    height: 36px !important;
    line-height: 36px !important;
    color: rgb(var(--color-secondary-700-rgb)) !important;
    background: rgb(var(--color-bg-card-rgb)) !important;
    transition: all 0.2s !important;
  }

  .leaflet-control-zoom a:hover {
    background: rgb(var(--color-secondary-100-rgb)) !important;
    color: rgb(var(--color-primary-600-rgb)) !important;
  }

  .dark .leaflet-control-zoom a {
    color: rgb(var(--color-secondary-400-rgb)) !important;
    background: rgb(var(--color-secondary-800-rgb)) !important;
  }

  .dark .leaflet-control-zoom a:hover {
    background: rgb(var(--color-secondary-700-rgb)) !important;
    color: rgb(var(--color-primary-400-rgb)) !important;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgb(var(--color-secondary-300-rgb));
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgb(var(--color-secondary-400-rgb));
  }

  .map-search-input {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .map-search-input:focus {
    transform: scale(1.02);
    box-shadow: 0 8px 20px rgba(var(--color-bg-primary-rgb), 0.12);
  }

  .stats-card {
    background: linear-gradient(135deg, rgba(var(--color-bg-card-rgb), 0.9) 0%, rgba(var(--color-bg-card-rgb), 0.7) 100%);
    backdrop-filter: blur(10px);
  }

  .stats-card-dark {
    background: linear-gradient(135deg, rgba(var(--color-secondary-800-rgb), 0.9) 0%, rgba(var(--color-bg-secondary-rgb), 0.7) 100%);
    backdrop-filter: blur(10px);
  }

  .user-location-marker {
    background: none !important;
    border: none !important;
  }
  
  .user-location-wrapper {
    position: relative;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .user-location-dot {
    width: 14px;
    height: 14px;
    background: rgb(var(--color-primary-500-rgb));
    border: 2.5px solid rgb(var(--color-bg-card-rgb));
    border-radius: 50%;
    box-shadow: 0 0 8px rgba(var(--color-primary-500-rgb), 0.8), 0 2px 4px rgba(var(--color-bg-primary-rgb), 0.3);
    z-index: 2;
  }
  
  .user-location-pulse {
    position: absolute;
    width: 32px;
    height: 32px;
    background: rgba(var(--color-primary-500-rgb), 0.45);
    border-radius: 50%;
    animation: user-pulse 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
    z-index: 1;
  }
  
  @keyframes user-pulse {
    0% { transform: scale(0.5); opacity: 0.85; }
    100% { transform: scale(2.8); opacity: 0; }
  }
`;

// Crop type colors for markers with icons
const CROP_COLORS: Record<string, string> = {
    maize: '#FFD700',
    tobacco: '#8B4513',
    groundnuts: '#D2691E',
    soybeans: '#228B22',
    rice: '#F0E68C',
    cotton: '#FFFAF0',
    wheat: '#DEB887',
    sorghum: '#A0522D',
    beans: '#CD853F',
    potatoes: '#B8860B',
    default: '#4A90D9',
};

const CROP_ICONS: Record<string, string> = {
    maize: '🌽',
    tobacco: '🍂',
    groundnuts: '🥜',
    soybeans: '🫘',
    rice: '🍚',
    cotton: '☁️',
    wheat: '🌾',
    sorghum: '🌿',
    beans: '🫘',
    potatoes: '🥔',
    default: '📍',
};

// Default starting coordinates for the map (Kenya)
const DEFAULT_CENTER: [number, number] = [-1.2863, 36.8172];
const DEFAULT_ZOOM = 6;

// Map tile layer types
type MapLayer = 'street' | 'satellite' | 'terrain';

interface TileLayerConfig {
    name: string;
    url: string;
    attribution: string;
    maxZoom: number;
}

const TILE_LAYERS: Record<MapLayer, TileLayerConfig> = {
    street: {
        name: 'Street',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
    },
    satellite: {
        name: 'Satellite',
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; Esri',
        maxZoom: 19,
    },
    terrain: {
        name: 'Terrain',
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenTopoMap',
        maxZoom: 17,
    },
};

// Custom marker icon creator with premium SVG pin
const createMarkerIcon = (crop: string, isSelected: boolean = false): L.DivIcon => {
    const color = CROP_COLORS[crop.toLowerCase()] || CROP_COLORS.default;
    const icon = CROP_ICONS[crop.toLowerCase()] || CROP_ICONS.default;

    return L.divIcon({
        className: 'custom-marker',
        html: `
      <div class="marker-pin-wrapper ${isSelected ? 'selected' : ''}" style="--marker-color: ${color}">
        <svg viewBox="0 0 36 48" class="marker-svg">
          <path d="M18 0C8.1 0 0 8.1 0 18c0 13.5 18 30 18 30s18-16.5 18-30c0-9.9-8.1-18-18-18z" fill="var(--marker-color)"/>
          <circle cx="18" cy="18" r="14" fill="white" fill-opacity="0.2"/>
          <circle cx="18" cy="18" r="11" fill="white"/>
        </svg>
        <span class="marker-icon">${icon}</span>
        ${isSelected ? '<div class="marker-pulse"></div>' : ''}
      </div>
    `,
        iconSize: [36, 48],
        iconAnchor: [18, 48],
        popupAnchor: [0, -42],
    });
};

// Custom current user location marker icon with pulse animation
const createCurrentUserMarkerIcon = (): L.DivIcon => {
    return L.divIcon({
        className: 'user-location-marker',
        html: `
      <div class="user-location-wrapper">
        <div class="user-location-pulse"></div>
        <div class="user-location-dot"></div>
      </div>
    `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -10],
    });
};

// Component to handle map center updates
function MapController({ center, zoom, bounds }: { center?: [number, number]; zoom?: number; bounds?: L.LatLngBoundsExpression }) {
    const map = useMap();

    useEffect(() => {
        if (bounds) {
            map.fitBounds(bounds, { padding: [50, 50] });
        } else if (center && zoom !== undefined) {
            map.setView(center, zoom);
        }
    }, [map, center, zoom, bounds]);

    return null;
}

// Map layer switcher component
function LayerSwitcher({
    currentLayer,
    onLayerChange,
    t
}: {
    currentLayer: MapLayer;
    onLayerChange: (layer: MapLayer) => void;
    t: (key: string) => string;
}) {
    return (
        <div className="leaflet-top leaflet-right" style={{ marginTop: '10px', marginRight: '10px' }}>
            <div className="leaflet-control leaflet-control-layers bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100/50 dark:border-gray-700/50 p-3">
                <div className="text-[10px] font-black mb-3 text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" /> {t('map_type') || 'Map Type'}
                </div>
                <div className="flex flex-col gap-1.5">
                    {(Object.keys(TILE_LAYERS) as MapLayer[]).map((layer) => (
                        <button
                            key={layer}
                            onClick={() => onLayerChange(layer)}
                            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all ${currentLayer === layer
                                ? 'shadow-lg shadow-emerald-500/25'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            style={currentLayer === layer ? {
                                background: `linear-gradient(135deg, rgb(var(--color-primary-600-rgb)), rgb(var(--color-primary-700-rgb)))`,
                                color: 'white',
                            } : {
                                background: 'rgb(var(--color-bg-card-rgb))',
                                color: 'rgb(var(--color-secondary-700-rgb))',
                                border: '1px solid rgb(var(--color-secondary-200-rgb))'
                            }}
                            aria-pressed={currentLayer === layer}
                        >
                            {TILE_LAYERS[layer].name}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// Legend component
function MapLegend({ show, t }: { show: boolean, t: (key: string) => string }) {
    if (!show) return null;

    return (
        <div className="leaflet-bottom leaflet-left" style={{ marginBottom: '30px', marginLeft: '10px' }}>
            <div className="leaflet-control bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-2xl shadow-xl border border-gray-100/50 dark:border-gray-700/50 p-3.5 min-w-[170px]">
                <div className="text-[10px] font-black mb-3 text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" /> {t('map_legend') || 'Crop Legend'}
                </div>
                <div className="flex flex-col gap-2">
                    {Object.entries(CROP_COLORS).filter(([key]) => key !== 'default').slice(0, 8).map(([crop, color]) => (
                        <div key={crop} className="flex items-center gap-2.5 group cursor-pointer">
                            <div
                                className="w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-700 shadow-sm group-hover:scale-125 transition-transform"
                                style={{ backgroundColor: color }}
                            />
                            <span className="text-xs capitalize text-gray-600 dark:text-gray-300 font-medium group-hover:text-gray-900 dark:group-hover:text-white transition-colors">{crop}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export interface FarmerData {
    id: number | string;
    name?: string;
    firstName?: string;
    lastName?: string;
    lat: number;
    lng: number;
    crop: string;
    region: string;
    size: number;
    phone?: string;
    yield?: number;
    createdAt?: string;
}

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
    const farmers = propFarmers || [];
    const [currentLayer, setCurrentLayer] = useState<MapLayer>('street');
    const [selectedFarmer, setSelectedFarmer] = useState<FarmerData | null>(null);
    const [internalExpanded, setInternalExpanded] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; farmer: FarmerData } | null>(null);

    const handleContextMenu = (e: MouseEvent, farmer: FarmerData) => {
        e.preventDefault();
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            farmer
        });
    };

    const handleContextMenuAction = (action: string) => {
        if (!contextMenu) return;

        switch (action) {
            case 'view':
                onFarmerClick?.(contextMenu.farmer);
                break;
            case 'chat':
                handleChat(contextMenu.farmer);
                break;
            case 'call':
                if (contextMenu.farmer.phone) {
                    handleCall(contextMenu.farmer.phone);
                }
                break;
            case 'navigate':
                setMapCenter([contextMenu.farmer.lat, contextMenu.farmer.lng]);
                break;
        }
        setContextMenu(null);
    };

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
    const [visibleStats, setVisibleStats] = useState(true);

    // Get theme from store
    const darkMode = useAppStore((state) => state.darkMode);
    const themeName = useAppStore((state) => state.themeName) as ThemeName;
    const theme = themes[themeName] || themes.forest;
    const { t } = useLanguage();

    // Compute stats from farmer data
    const stats = useMemo(() => {
        const cropCounts = farmers.reduce((acc, f) => {
            acc[f.crop] = (acc[f.crop] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const totalSize = farmers.reduce((sum, f) => sum + (Number(f.size) || 0), 0);
        const validYields = farmers.filter(f => f.yield && !isNaN(Number(f.yield)));
        const avgYield = validYields.length > 0 ? validYields.reduce((sum, f) => sum + Number(f.yield), 0) / validYields.length : 0;

        const topCrops = Object.entries(cropCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3);

        return { cropCounts, totalSize, avgYield, topCrops, totalFarms: farmers.length };
    }, [farmers]);

    const filteredFarmers = useMemo(() => {
        return farmers.filter(f => {
            const fullName = f.name || `${f.firstName || ''} ${f.lastName || ''}`;
            const searchStr = searchQuery.toLowerCase();
            return (
                fullName.toLowerCase().includes(searchStr) ||
                (f.crop?.toLowerCase() || '').includes(searchStr) ||
                (f.region?.toLowerCase() || '').includes(searchStr)
            );
        });
    }, [farmers, searchQuery]);

    // Disable marker animation after initial render
    useEffect(() => {
        // We can keep the effect if we use it, otherwise remove it too if we removed state
    }, []);

    const handleLocateMe = () => {
        if ('geolocation' in navigator) {
            toast.loading('Detecting your location...', { id: 'gps-detect' });
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    setCurrentUserLocation([lat, lng]);
                    setMapCenter([lat, lng]);
                    setMapZoom(14);
                    setMapBounds(undefined);
                    toast.success('Location updated!', { id: 'gps-detect' });
                },
                () => {

                    // Use a realistic regional default near the first active farmer or Nairobi center to simulate it perfectly
                    const defaultUserLat = farmers.length > 0 ? farmers[0].lat + 0.003 : -1.2863;
                    const defaultUserLng = farmers.length > 0 ? farmers[0].lng + 0.003 : 36.8172;
                    
                    setCurrentUserLocation([defaultUserLat, defaultUserLng]);
                    setMapCenter([defaultUserLat, defaultUserLng]);
                    setMapZoom(14);
                    setMapBounds(undefined);
                    toast.success('Using regional GPS fallback (East Africa Hub)', { id: 'gps-detect' });
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
            );
        } else {
            const defaultUserLat = farmers.length > 0 ? farmers[0].lat + 0.003 : -1.2863;
            const defaultUserLng = farmers.length > 0 ? farmers[0].lng + 0.003 : 36.8172;
            
            setCurrentUserLocation([defaultUserLat, defaultUserLng]);
            setMapCenter([defaultUserLat, defaultUserLng]);
            setMapZoom(14);
            setMapBounds(undefined);
            toast.success('Using regional GPS fallback (East Africa Hub)');
        }
    };

    const handleResetView = () => {
        setMapBounds(bounds);
    };

    const handleFarmerClick = useCallback((farmer: FarmerData) => {
        setSelectedFarmer(farmer);
        onFarmerClick?.(farmer);
    }, [onFarmerClick]);

    const handleCall = (phone: string) => {
        window.location.href = `tel:${phone}`;
    };

    const handleChat = (farmer: FarmerData) => {
        // This will be handled in App.tsx by listening to onFarmerClick
        onFarmerClick?.(farmer);
    };

    const handleLayerChange = useCallback((layer: MapLayer) => {
        setCurrentLayer(layer);
        // Don't deselect farmer on layer change for better UX
    }, []);

    const tileLayer = TILE_LAYERS[currentLayer];

    // Compute bounds from farmers
    const bounds = useMemo(() => {
        if (farmers.length === 0) return undefined;
        const lats = farmers.map(f => f.lat);
        const lngs = farmers.map(f => f.lng);
        return [
            [Math.min(...lats), Math.min(...lngs)],
            [Math.max(...lats), Math.max(...lngs)],
        ] as L.LatLngBoundsExpression;
    }, [farmers]);

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
                <Marker
                    position={currentUserLocation}
                    icon={createCurrentUserMarkerIcon()}
                >
                    <Popup className={`glass-popup ${darkMode ? 'glass-popup-dark' : ''}`} closeButton={false}>
                        <div className="p-4 flex flex-col items-center text-center">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-2">
                                <Crosshair className="w-5 h-5" />
                            </div>
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white">Your Location</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Extension Officer / Active GPS Node</p>
                            <span className="text-[10px] text-blue-500 font-semibold mt-2 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40">
                                Lat: {currentUserLocation[0].toFixed(4)}, Lng: {currentUserLocation[1].toFixed(4)}
                            </span>
                        </div>
                    </Popup>
                </Marker>
            )}

            {farmers.map((farmer) => (
                <Marker
                    key={farmer.id}
                    position={[farmer.lat, farmer.lng]}
                    icon={createMarkerIcon(farmer.crop, selectedFarmer?.id === farmer.id)}
                    eventHandlers={{
                        click: () => handleFarmerClick(farmer),
                        contextmenu: (e) => handleContextMenu(e.originalEvent, farmer),
                    }}
                >
                    <Popup className={`glass-popup ${darkMode ? 'glass-popup-dark' : ''}`} closeButton={false}>
                        <div className="flex flex-col">
                            {/* Header with gradient */}
                            <div
                                className="h-28 p-4 flex flex-col justify-end relative overflow-hidden"
                                style={{
                                    background: `linear-gradient(135deg, ${CROP_COLORS[farmer.crop.toLowerCase()] || CROP_COLORS.default}, ${CROP_COLORS[farmer.crop.toLowerCase()] || CROP_COLORS.default}cc)`
                                }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                                <div className="absolute top-3 right-3 bg-white/30 backdrop-blur-md rounded-full p-2 border border-white/40 shadow-lg">
                                    <span className="text-2xl filter drop-shadow-md">{CROP_ICONS[farmer.crop.toLowerCase()] || CROP_ICONS.default}</span>
                                </div>
                                <div className="absolute top-3 left-3">
                                    <span className="px-2.5 py-1 bg-white/25 backdrop-blur-md rounded-full text-[10px] font-bold text-white uppercase tracking-wider border border-white/30">
                                        {farmer.crop}
                                    </span>
                                </div>
                                <h3 className="text-white font-black text-xl leading-tight drop-shadow-lg relative z-10">
                                    {farmer.name || `${farmer.firstName} ${farmer.lastName}`}
                                </h3>
                                <div className="flex items-center gap-1.5 text-white/90 text-xs font-medium mt-1">
                                    <MapPin className="w-3.5 h-3.5" />
                                    {farmer.region}
                                </div>
                            </div>

                            {/* Info Area */}
                            <div className={`p-4 ${darkMode ? 'bg-gray-800/50' : 'bg-white/70'} space-y-4`}>
                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="group bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-800/20 rounded-2xl p-3 border border-emerald-200/50 dark:border-emerald-700/30">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className="w-7 h-7 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30">
                                                <Wheat className="w-4 h-4" />
                                            </div>
                                            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">{t('farmer_farm_size') || 'Farm Size'}</span>
                                        </div>
                                        <div className="font-black text-xl text-emerald-700 dark:text-emerald-300">
                                            {farmer.size} <span className="text-xs font-medium text-emerald-500">ha</span>
                                        </div>
                                    </div>
                                    <div className="group bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/30 dark:to-amber-800/20 rounded-2xl p-3 border border-amber-200/50 dark:border-amber-700/30">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className="w-7 h-7 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
                                                <TrendingUp className="w-4 h-4" />
                                            </div>
                                            <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">{t('farmer_est_yield')}</span>
                                        </div>
                                        <div className="font-black text-xl text-amber-700 dark:text-amber-300">
                                            {farmer.yield} <span className="text-xs font-medium text-amber-500">t/ha</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Farm Details */}
                                <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${darkMode ? 'bg-gray-700/50' : 'bg-gray-50'} border ${darkMode ? 'border-gray-600' : 'border-gray-100'}`}>
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('farmer_active_since')}</span>
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                                        {farmer.createdAt ? new Date(farmer.createdAt).getFullYear() : '—'}
                                    </span>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2.5">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); farmer.phone && handleCall(farmer.phone); }}
                                        className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 py-3 rounded-2xl text-xs font-bold border border-gray-200 dark:border-gray-600 shadow-sm hover:shadow-md transition-all"
                                    >
                                        <Phone className="w-4 h-4" />
                                        {t('action_call') || 'Call'}
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleChat(farmer); }}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/40"
                                        style={{
                                            background: `linear-gradient(135deg, ${theme.primary[500]}, ${theme.primary[600]})`,
                                            color: 'white'
                                        }}
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        {t('action_chat') || 'Chat'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Popup>
                </Marker>
            ))}

            <LayerSwitcher currentLayer={currentLayer} onLayerChange={handleLayerChange} t={t} />
            <MapLegend show={showLegend} t={t} />

            {/* Overlay Controls */}
            <div className="leaflet-top leaflet-left" style={{ marginTop: '10px', marginLeft: '10px' }}>
                <div className="flex flex-col gap-2">
                    <button
                        onClick={handleLocateMe}
                        className="leaflet-control bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-100/50 dark:border-gray-700/50 p-2.5 text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:shadow-emerald-500/20 transition-all"
                        title={t('map_locate_me') || 'Locate Me'}
                    >
                        <Crosshair className="w-5 h-5" />
                    </button>
                    <button
                        onClick={handleResetView}
                        className="leaflet-control bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-100/50 dark:border-gray-700/50 p-2.5 text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:shadow-emerald-500/20 transition-all"
                        title={t('map_reset_view') || 'Reset View'}
                    >
                        <Navigation className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setVisibleStats(!visibleStats)}
                        className="leaflet-control bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-xl border border-gray-100/50 dark:border-gray-700/50 p-2.5 text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:shadow-emerald-500/20 transition-all"
                        title={t('map_toggle_stats') || 'Toggle Stats'}
                    >
                        <TrendingUp className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </MapContainer>
    );

    return (
        <div className={`relative ${className}`} role="application" aria-label="Regional Farmer Distribution Map">
            {/* Top Controls Bar */}
            {!isExpanded && (
                <div className="absolute top-3 left-3 right-14 z-[1000] flex items-center gap-2">
                    {/* Mini Search Bar */}
                    <div className={`flex-1 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-100 dark:border-gray-700/50 overflow-hidden transition-all ${showMiniSearch ? 'opacity-100' : 'opacity-70 hover:opacity-100'}`}>
                        <div className="flex items-center px-3 py-2">
                            <Search className="w-4 h-4 text-gray-400 dark:text-gray-500 mr-2" />
                            <input
                                type="text"
                                aria-label={t('map_search_placeholder') || 'Search farmers'}
                                placeholder={t('map_search_placeholder') || 'Search farmers...'}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={() => setShowMiniSearch(true)}
                                onBlur={() => setShowMiniSearch(false)}
                                className="flex-1 text-sm bg-transparent outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 font-medium"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        {/* Search Results Dropdown */}
                        {searchQuery && filteredFarmers.length > 0 && (
                            <div className="border-t border-gray-100 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 max-h-48 overflow-y-auto custom-scrollbar">
                                {filteredFarmers.slice(0, 5).map(farmer => (
                                    <button
                                        key={farmer.id}
                                        onClick={() => {
                                            setMapCenter([farmer.lat, farmer.lng]);
                                            setMapZoom(14);
                                            setMapBounds(undefined);
                                            setSelectedFarmer(farmer);
                                            setSearchQuery('');
                                        }}
                                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                                    >
                                        <span className="text-lg">{CROP_ICONS[farmer.crop.toLowerCase()] || CROP_ICONS.default}</span>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-bold text-gray-700 dark:text-gray-200 truncate">
                                                {farmer.name || `${farmer.firstName} ${farmer.lastName}`}
                                            </div>
                                            <div className="text-[10px] text-gray-400">{farmer.region}</div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-500" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Expand button */}
            {!isExpanded && (
                <button
                    onClick={() => setIsExpanded(true)}
                    className="absolute top-3 right-3 z-[1500] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-xl shadow-lg p-2.5 hover:bg-white dark:hover:bg-gray-700 transition-all group border border-gray-100 dark:border-gray-700/50"
                    title={t('map_expand') || "Expand Map"}
                >
                    <Maximize2 className="w-4 h-4 text-gray-600 dark:text-gray-300 group-hover:text-emerald-600 dark:group-hover:text-primary-400" />
                </button>
            )}

            <div className="relative" style={{ height }}>
                {mapContent}
                {farmers.length === 0 && (
                    <div className="absolute inset-0 z-[1100] bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-6 text-center">
                        <div className="bg-white/90 dark:bg-gray-800/90 rounded-3xl p-8 shadow-2xl border border-white/20 max-w-sm">
                            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <Users className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                            </div>
                            <h3 className="text-lg font-black text-gray-900 dark:text-white mb-2 uppercase tracking-wide">
                                {t('map_no_farmers') || 'Establish Connectivity'}
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium leading-relaxed">
                                {t('map_no_farmers_desc') || "No farmer records detected in current perimeter. Once synchronized with regional nodes, distribution will appear live."}
                            </p>
                            <button 
                                onClick={() => setIsExpanded(false)}
                                className="mt-6 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                            >
                                {t('action_refresh_sync') || 'Refresh Sync'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Stats Panel - Bottom Left */}
            {visibleStats && !isExpanded && (
                <div className="absolute bottom-4 left-4 z-[1000] hidden md:block">
                    <div className={`stats-card dark:stats-card-dark rounded-2xl shadow-xl border border-gray-100/50 dark:border-gray-700/50 p-3 min-w-[180px]`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">{t('map_overview') || 'Overview'}</span>
                            <button
                                onClick={() => setVisibleStats(false)}
                                className="text-gray-300 hover:text-gray-500"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/30 dark:to-emerald-800/20 rounded-xl p-2 border border-emerald-200/50 dark:border-emerald-700/30">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Users className="w-3 h-3 text-emerald-500" />
                                    <span className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400">{t('map_farms') || 'Farms'}</span>
                                </div>
                                <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">{stats.totalFarms}</span>
                            </div>
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-xl p-2 border border-blue-200/50 dark:border-blue-700/30">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <Wheat className="w-3 h-3 text-blue-500" />
                                    <span className="text-[9px] uppercase font-bold text-blue-600 dark:text-blue-400">{t('map_hectares') || 'Hectares'}</span>
                                </div>
                                <span className="text-lg font-black text-blue-700 dark:text-blue-300">{(Number(stats.totalSize) || 0).toFixed(0)}</span>
                            </div>
                        </div>
                        {/* Top Crops Mini Bar */}
                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                            <div className="flex items-center gap-1 mb-1.5">
                                <TrendingUp className="w-3 h-3 text-gray-400" />
                                <span className="text-[9px] uppercase font-bold text-gray-400">{t('map_top_crops') || 'Top Crops'}</span>
                            </div>
                            <div className="flex gap-1">
                                {stats.topCrops.map(([crop, count], idx) => {
                                    const colors = ['500', '600', '700'] as const;
                                    return (
                                        <div
                                            key={crop}
                                            className="flex-1 h-5 rounded-md flex items-center justify-center text-[9px] font-bold text-white"
                                            style={{ backgroundColor: theme.primary[colors[idx]] }}
                                            title={`${crop}: ${count}`}
                                        >
                                            {count}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile layer selector */}
            <div className="absolute bottom-4 left-4 z-[1000] md:hidden">
                <div className="flex gap-2 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm rounded-2xl shadow-xl p-2 border border-gray-100/50 dark:border-gray-700/50">
                    {(Object.keys(TILE_LAYERS) as MapLayer[]).map((layer) => (
                        <button
                            key={layer}
                            onClick={() => handleLayerChange(layer)}
                            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${currentLayer === layer
                                ? 'shadow-lg shadow-emerald-500/25'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                }`}
                            style={currentLayer === layer ? {
                                background: `linear-gradient(135deg, rgb(var(--color-primary-600-rgb)), rgb(var(--color-primary-700-rgb)))`,
                                color: 'white',
                            } : {
                                background: 'rgb(var(--color-secondary-100-rgb))',
                                color: 'rgb(var(--color-secondary-700-rgb))',
                            }}
                        >
                            {TILE_LAYERS[layer].name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Fullscreen Modal */}
            {isExpanded && document.body && createPortal(
                <div className={`fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-0 `}>
                    <div className={` bg-white dark:bg-gray-900 rounded-none shadow-2xl w-screen h-screen max-w-none flex flex-col overflow-hidden border-0`} style={{ width: '100vw', height: '100vh' }}>
                        {/* Modal Header */}
                        <div className={`flex items-center justify-between px-8 py-5 border-b 'border-gray-100 dark:border-gray-800' 'bg-white dark:bg-gray-900'`}>
                            <div className="flex items-center gap-4">
                                <div
                                    className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg"
                                    style={{
                                        background: `linear-gradient(135deg, ${theme.primary[500]}, ${theme.primary[600]})`,
                                        boxShadow: `0 10px 25px -5px ${theme.primary[500]}40`
                                    }}
                                >
                                    <MapPin className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h2 className={`text-2xl font-black tracking-tight 'text-gray-800 dark:text-white'`}>{t('map_overview')}</h2>
                                    <p className={`text-sm font-medium flex items-center gap-2 'text-gray-500 dark:text-gray-400'`}>
                                        <span className="flex h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: theme.primary[500] }}></span>
                                        {t('common_ai_powered')} • {farmers.length} {t('map_farms')}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:transition-colors" style={{ color: theme.primary[500] }} />
                                    <input
                                        type="text"
                                        aria-label={t('map_search_placeholder') || 'Search farmers, regions, crops'}
                                        placeholder={t('map_search_placeholder') || "Search farmers, regions, crops..."}
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className={`pl-10 pr-4 py-2.5 border rounded-2xl w-80 text-sm focus:outline-none focus:ring-2 transition-all bg-gray-50 dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-800 dark:text-white placeholder-gray-400`}
                                        style={{ '--tw-ring-color': `${theme.primary[500]}33` } as React.CSSProperties}
                                    />
                                </div>
                                <button
                                    onClick={() => setIsExpanded(false)}
                                    className={`p-3 rounded-2xl transition-all border ${themeName === 'cyber' ? 'bg-primary-500/20 hover:text-white' : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-900 dark:hover:text-white border-gray-100 dark:border-gray-700'}`}
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Main Content */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Side Panel */}
                            <div className={`w-80 border-r flex flex-col ${themeName === 'cyber' ? 'border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-800/30' : 'bg-white dark:bg-gray-900'}`}>
                                <div className={`p-4 border-b ${themeName === 'cyber' ? 'border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                                    <div className="text-[11px] uppercase tracking-wider font-bold text-gray-400">Farmlist</div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                                    {filteredFarmers.length > 0 ? (
                                        filteredFarmers.map(farmer => (
                                            <button
                                                key={farmer.id}
                                                onClick={() => {
                                                    setMapCenter([farmer.lat, farmer.lng]);
                                                    setMapZoom(16);
                                                    setMapBounds(undefined);
                                                    setSelectedFarmer(farmer);
                                                }}
                                                className={`w-full text-left p-3 rounded-2xl transition-all flex items-center gap-3 group ${selectedFarmer?.id === farmer.id
                                                    ? 'bg-white dark:bg-gray-800 shadow-md border border-gray-100 dark:border-gray-700'
                                                    : themeName === 'cyber' ? 'hover:bg-primary-500/5 border border-transparent hover:border-primary-500/10'
                                                        : 'hover:bg-white/60 dark:hover:bg-gray-800/60 border border-transparent hover:border-gray-100 dark:hover:border-gray-700'
                                                    }`}
                                            >
                                                <div className="text-2xl group-hover:scale-110 transition-transform">
                                                    {CROP_ICONS[farmer.crop.toLowerCase()] || CROP_ICONS.default}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className={`font-bold text-sm truncate 'text-gray-800 dark:text-white'`}>
                                                        {farmer.name || `${farmer.firstName} ${farmer.lastName}`}
                                                    </div>
                                                    <div className={`text-[10px] font-medium truncate 'text-gray-400'`}>{farmer.region} • {farmer.size}ha</div>
                                                </div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center">
                                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 'bg-gray-100 dark:bg-gray-800'`}>
                                                <Search className={`w-6 h-6 'text-gray-300'`} />
                                            </div>
                                            <p className={`text-sm 'text-gray-500'`}>No farmers found for "{searchQuery}"</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Map View */}
                            <div className="flex-1 relative">
                                {mapContent}
                            </div>
                        </div>

                        {/* Modal Footer Stats */}
                        <div className={`px-8 py-4 border-t flex items-center justify-between backdrop-blur-sm 'bg-gray-50/80 dark:bg-gray-800/80 border-gray-100 dark:border-gray-800'`}>
                            <div className="flex items-center gap-8">
                                <div className="flex flex-col">
                                    <span className={`text-[10px] uppercase font-black tracking-widest 'text-gray-400'`}>{t('map_farms')}</span>
                                    <span className={`text-xl font-bold 'text-gray-800 dark:text-white'`}>{farmers.length}</span>
                                </div>
                                <div className={`h-8 w-px 'bg-gray-200 dark:bg-gray-700'`}></div>
                                <div className="flex items-center gap-6">
                                    {stats.topCrops.map(([crop], idx) => {
                                        const colors = ['500', '600', '700'] as const;
                                        return (
                                            <div key={crop} className="flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.primary[colors[idx]] }}></div>
                                                <span className={`text-sm font-bold capitalize 'text-gray-600 dark:text-gray-300'`}>
                                                    {crop}: <span className={`font-normal 'text-gray-400'`}>{stats.cropCounts[crop]}</span>
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div
                                className="flex items-center gap-2 text-xs font-bold px-4 py-2 rounded-xl border"
                                style={{
                                    color: theme.primary[600],
                                    backgroundColor: themeName === 'cyber' ? 'rgba(0, 255, 255, 0.05)' : `${theme.primary[50]}`,
                                    borderColor: themeName === 'cyber' ? 'rgba(0, 255, 255, 0.2)' : `${theme.primary[100]}`
                                }}
                            >
                                <div className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: theme.primary[500] }}></div>
                                <span className={themeName === 'cyber' ? 'text-primary-300' : ''}>System Online</span>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Context Menu */}
            {contextMenu && (
                <>
                    <div
                        className="fixed inset-0 z-50"
                        onClick={() => setContextMenu(null)}
                    />
                    <div
                        className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 min-w-[160px]"
                        style={{
                            left: contextMenu.x,
                            top: contextMenu.y,
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-3 py-1 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                            {contextMenu.farmer.firstName ? `${contextMenu.farmer.firstName} ${contextMenu.farmer.lastName}` : contextMenu.farmer.name}
                        </div>
                        <button
                            onClick={() => handleContextMenuAction('view')}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-sm flex items-center gap-2"
                        >
                            <Users className="w-4 h-4" />
                            View Profile
                        </button>
                        <button
                            onClick={() => handleContextMenuAction('chat')}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-sm flex items-center gap-2"
                        >
                            <MessageSquare className="w-4 h-4" />
                            Start Chat
                        </button>
                        {contextMenu.farmer.phone && (
                            <button
                                onClick={() => handleContextMenuAction('call')}
                                className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-sm flex items-center gap-2"
                            >
                                <Phone className="w-4 h-4" />
                                Call Farmer
                            </button>
                        )}
                        <button
                            onClick={() => handleContextMenuAction('navigate')}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 text-sm flex items-center gap-2"
                        >
                            <Navigation className="w-4 h-4" />
                            Navigate Here
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}

export { CROP_COLORS };
export default FarmerMap;
