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
    subtitle: 'How solar flux and rainfall drive the season',
    badge: 'STAGE 01 // SATELLITE',
    icon: Satellite,
    color: '#38bdf8',
  },
  {
    id: 1,
    title: 'Topological Farm Mesh & NDVI Analysis',
    subtitle: 'How canopy growth is mapped across a field',
    badge: 'STAGE 02 // TOPOGRAPHY',
    icon: MapPin,
    color: '#34d399',
  },
  {
    id: 2,
    title: 'Subsurface Soil Horizon Stratigraphy',
    subtitle: 'How clay, pH and moisture shape the root zone',
    badge: 'STAGE 03 // SOILGRIDS',
    icon: Layers,
    color: '#fbbf24',
  },
  {
    id: 3,
    title: 'Autonomous AI Synthesis & Edge Uplink',
    subtitle: 'How an advisory reaches a farmer by SMS or USSD',
    badge: 'STAGE 04 // EDGE DISPATCH',
    icon: Radio,
    color: '#a855f7',
  },
];
