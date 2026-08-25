import L from 'leaflet';
import { DEMO_FARMERS } from '@/demo';

export interface FarmerData {
  id: string;
  name: string;
  lat: number;
  lng: number;
  crop: string;
  region: string;
  size: number;
  phone?: string;
  yield?: number;
  status?: string;
  notes?: string;
}

export type MapLayer = 'street' | 'satellite' | 'terrain';

export interface TileLayerConfig {
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
}

export const TILE_LAYERS: Record<MapLayer, TileLayerConfig> = {
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

export const CROP_COLORS: Record<string, string> = {
  maize: 'var(--color-primary-500)',
  tobacco: 'var(--color-primary-500)',
  groundnuts: 'var(--color-primary-500)',
  soybeans: 'var(--color-primary-500)',
  rice: 'var(--color-primary-500)',
  cotton: 'var(--color-primary-500)',
  wheat: 'var(--color-primary-500)',
  sorghum: 'var(--color-primary-500)',
  beans: 'var(--color-primary-500)',
  potatoes: 'var(--color-primary-500)',
  default: 'var(--color-primary-500)',
};

export const CROP_ICONS: Record<string, string> = {
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

export const DEFAULT_CENTER: [number, number] = [-1.2863, 36.8172];
export const DEFAULT_ZOOM = 6;

export const DEFAULT_DEMO_MAP_FARMERS: FarmerData[] = DEMO_FARMERS.map(f => ({
  id: f.id,
  name: `${f.firstName} ${f.lastName}`,
  lat: f.latitude,
  lng: f.longitude,
  crop: f.crops[0] || 'Maize',
  region: f.region || 'Unknown',
  size: f.farmSize || 0,
  phone: f.phone,
  yield: f.yield || 0,
}));

export const createMarkerIcon = (crop: string, isSelected: boolean = false): L.DivIcon => {
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

export const createCurrentUserMarkerIcon = (): L.DivIcon => {
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

export const MAP_STYLES = `
  .custom-marker {
    background: none !important;
    border: none !important;
  }
  
  .marker-pin-wrapper {
    position: relative;
    width: 36px;
    height: 48px;
    filter: drop-shadow(0 4px 6px var(--color-outline));
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .marker-pin-wrapper:hover {
    transform: translateY(-4px) scale(1.1);
    filter: drop-shadow(0 8px 12px var(--color-outline));
    z-index: 1000;
  }
  
  .marker-pin-wrapper.selected {
    transform: translateY(-6px) scale(1.2);
    filter: drop-shadow(0 12px 20px var(--color-outline));
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
    background: var(--color-outline) !important;
    backdrop-filter: blur(20px) !important;
    border-radius: 24px !important;
    border: 1px solid var(--color-outline) !important;
    box-shadow: 
      0 20px 40px var(--color-outline),
      0 0 0 1px var(--color-outline) inset !important;
    padding: 0 !important;
    overflow: hidden;
  }
  
  .glass-popup .leaflet-popup-content {
    margin: 0 !important;
    width: 300px !important;
  }
  
  .glass-popup .leaflet-popup-tip {
    background: var(--color-outline) !important;
    backdrop-filter: blur(20px) !important;
  }

  .glass-popup-dark .leaflet-popup-content-wrapper {
    background: var(--color-outline) !important;
    backdrop-filter: blur(20px) !important;
    border: 1px solid var(--color-outline) !important;
    box-shadow: 0 20px 40px var(--color-outline) !important;
  }
  
  .glass-popup-dark .leaflet-popup-tip {
    background: var(--color-outline) !important;
  }

  .leaflet-control-zoom {
    border: none !important;
    box-shadow: 0 4px 12px var(--color-outline) !important;
    border-radius: 16px !important;
    overflow: hidden;
  }

  .leaflet-control-zoom a {
    border: none !important;
    width: 36px !important;
    height: 36px !important;
    line-height: 36px !important;
    color: var(--color-outline) !important;
    background: white !important;
    transition: all 0.2s !important;
  }

  .leaflet-control-zoom a:hover {
    background: var(--color-bg-secondary) !important;
    color: var(--color-primary-500) !important;
  }

  .dark .leaflet-control-zoom a {
    color: var(--color-on-surface) !important;
    background: var(--color-bg-secondary) !important;
  }

  .dark .leaflet-control-zoom a:hover {
    background: var(--color-outline) !important;
    color: var(--color-primary-400) !important;
  }

  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: var(--color-on-surface);
    border-radius: 3px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: var(--color-chart-gray);
  }

  .map-search-input {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .map-search-input:focus {
    transform: scale(1.02);
    box-shadow: 0 8px 20px var(--color-outline);
  }

  .stats-card {
    background: linear-gradient(135deg, var(--color-outline) 0%, var(--color-outline) 100%);
    backdrop-filter: blur(10px);
  }

  .stats-card-dark {
    background: linear-gradient(135deg, var(--color-outline) 0%, var(--color-outline) 100%);
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
    background: var(--color-chart-blue);
    border: 2.5px solid var(--color-primary-500);
    border-radius: 50%;
    box-shadow: 0 0 8px var(--color-outline), 0 2px 4px var(--color-outline);
    z-index: 2;
  }
  
  .user-location-pulse {
    position: absolute;
    width: 32px;
    height: 32px;
    background: var(--color-outline);
    border-radius: 50%;
    animation: user-pulse 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
    z-index: 1;
  }
  
  @keyframes user-pulse {
    0% { transform: scale(0.5); opacity: 0.85; }
    100% { transform: scale(2.8); opacity: 0; }
  }
`;
