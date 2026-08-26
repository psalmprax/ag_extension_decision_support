import { Satellite, MapPin, Layers, Radio } from 'lucide-react';
import React from 'react';

export interface AgroStageMeta {
  id: number;
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export const AGRO_STAGES: AgroStageMeta[] = [
  {
    id: 0,
    title: 'Orbital Recon & Atmospheric Radar',
    subtitle: 'NASA POWER Solar Flux & GPM Precipitation Ingestion',
    badge: 'STAGE 01 // SATELLITE',
    icon: Satellite,
    color: '#38bdf8',
  },
  {
    id: 1,
    title: 'Topological Farm Mesh & NDVI Analysis',
    subtitle: 'Multi-Spectral Canopy Biomass & Field GPS Boundaries',
    badge: 'STAGE 02 // TOPOGRAPHY',
    icon: MapPin,
    color: '#34d399',
  },
  {
    id: 2,
    title: 'Subsurface Soil Horizon Stratigraphy',
    subtitle: 'ISRIC SoilGrids v2 Clay, pH, and Moisture Dynamics',
    badge: 'STAGE 03 // SOILGRIDS',
    icon: Layers,
    color: '#fbbf24',
  },
  {
    id: 3,
    title: 'Autonomous AI Synthesis & Edge Uplink',
    subtitle: 'Agronomic RAG Reasoning to Offline USSD / SMS Dispatch',
    badge: 'STAGE 04 // EDGE DISPATCH',
    icon: Radio,
    color: '#a855f7',
  },
];
