import { Satellite, MapPin, Layers, Radio } from 'lucide-react';
import React from 'react';

export interface AgroStageMeta {
  id: number;
  title: string;
  subtitle: string;
  badge: string;
  /** Label on the stage's jump button. */
  short: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

export const AGRO_STAGES: AgroStageMeta[] = [
  {
    id: 0,
    title: 'Weather from satellite',
    subtitle: 'How sunshine and rainfall drive the season',
    badge: 'Step 1 of 4',
    short: 'Weather',
    icon: Satellite,
    color: '#38bdf8',
  },
  {
    id: 1,
    title: 'Crop greenness across the field',
    subtitle: 'How canopy growth is mapped across a field',
    badge: 'Step 2 of 4',
    short: 'Crop',
    icon: MapPin,
    color: '#34d399',
  },
  {
    id: 2,
    title: 'Soil layers and moisture',
    subtitle: 'How clay, pH and moisture shape the root zone',
    badge: 'Step 3 of 4',
    short: 'Soil',
    icon: Layers,
    color: '#fbbf24',
  },
  {
    id: 3,
    title: 'Advice sent to the farmer',
    subtitle: 'How an advisory reaches a farmer by SMS or USSD',
    badge: 'Step 4 of 4',
    short: 'Advice',
    icon: Radio,
    color: '#a855f7',
  },
];
