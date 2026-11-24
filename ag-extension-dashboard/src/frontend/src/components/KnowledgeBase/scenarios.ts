// Example questions for the demo account. Each runs the real search; the app supplies no answer
// of its own, so nothing here can show a dose or a source that the search did not return.

import type { LucideIcon } from 'lucide-react';
import { Compass, Layers, ShieldCheck } from 'lucide-react';

export type SpatialCanvasMode = 'phenology' | 'soil_heatmap' | 'pathology';

/** The three illustration views on the knowledge workbench, in tab order. */
export const CANVAS_MODES: ReadonlyArray<{ id: SpatialCanvasMode; icon: LucideIcon; labelKey: string }> = [
  { id: 'phenology', icon: Compass, labelKey: 'ui_index_phenology_scrubber' },
  { id: 'soil_heatmap', icon: Layers, labelKey: 'ui_index_soil_heatmap_grid' },
  { id: 'pathology', icon: ShieldCheck, labelKey: 'ui_index_pathology_scanner' },
];

export interface ResearchScenario {
  id: string;
  title: string;
  crop: string;
  category: string;
  query: string;
  canvasMode: SpatialCanvasMode | 'rag_graph';
}

export const RESEARCH_SCENARIOS: ResearchScenario[] = [
  {
    id: 'fall_armyworm_ipm',
    title: 'Fall armyworm control in maize',
    crop: 'Maize',
    category: 'Pests',
    query: 'What are the biological and low-toxicity chemical control thresholds for Fall Armyworm (Spodoptera frugiperda) in maize?',
    canvasMode: 'rag_graph',
  },
  {
    id: 'soil_acidity_liming',
    title: 'Liming very acidic soil (pH below 5)',
    crop: 'Multi-Crop',
    category: 'Soil',
    query: 'How to calculate agricultural lime (CaCO3) requirement for soils with pH below 5.0 and high aluminum toxicity?',
    canvasMode: 'soil_heatmap',
  },
  {
    id: 'nasa_precipitation_window',
    title: 'When to plant cassava after the rains start',
    crop: 'Cassava & Cereals',
    category: 'Weather and planting',
    query: 'How do I choose the planting window for cassava from rainfall and soil moisture?',
    canvasMode: 'phenology',
  },
  {
    id: 'maize_foliar_rust_pathology',
    title: 'Common rust or southern rust on maize',
    crop: 'Maize',
    category: 'Plant pathology',
    query: 'How to diagnose and mitigate Common Rust (Puccinia sorghi) versus Southern Corn Rust (Puccinia polysora)?',
    canvasMode: 'pathology',
  },
];
