import { Layers, Sprout, Bug, Camera, Scale, FlaskConical } from 'lucide-react';

/** The step types, starting templates and palette of the Advisory Studio protocol builder. */
export interface WorkflowStep {
  id: string;
  type: 'crop_select' | 'soil_test' | 'pest_scout' | 'photo_leaf' | 'dosage_advisory' | 'text_input';
  title: string;
  icon?: string;
  condition?: string;
  config: Record<string, string | number | boolean>;
}

export function renderStepIcon(type: WorkflowStep['type']) {
  switch (type) {
    case 'crop_select':
      return <Sprout className="w-4 h-4 text-emerald-400" />;
    case 'soil_test':
      return <FlaskConical className="w-4 h-4 text-slate-400" />;
    case 'pest_scout':
      return <Bug className="w-4 h-4 text-amber-400" />;
    case 'photo_leaf':
      return <Camera className="w-4 h-4 text-slate-400" />;
    case 'dosage_advisory':
      return <Scale className="w-4 h-4 text-emerald-400" />;
    default:
      return <Layers className="w-4 h-4 text-slate-400" />;
  }
}

export const DEFAULT_TEMPLATES: Record<string, { title: string; category: string; description: string; steps: WorkflowStep[] }> = {
  maize_armyworm: {
    title: 'Kenya Maize & Fall Armyworm Bio-Protocol',
    category: 'crop_protection',
    description: 'Autonomous field scouting checklist for scouting leaf funnels and computing cold-pressed Neem bio-dosages.',
    steps: [
      {
        id: 'step-crop',
        type: 'crop_select',
        title: 'Crop & phenology phase',
        config: { crop: 'Maize', stage: 'V4 - Early Whorl' },
      },
      {
        id: 'step-pest',
        type: 'pest_scout',
        title: 'Fall armyworm severity assessment',
        condition: 'Crop == "Maize"',
        config: { threshold: 30, action: 'Trigger Neem Bio-Dosage' },
      },
      {
        id: 'step-photo',
        type: 'photo_leaf',
        title: 'Leaf funnel photo scan',
        condition: 'Severity > 20%',
        config: { model: 'MobileNetV3-Agro-Edge', gpsTag: true },
      },
      {
        id: 'step-dosage',
        type: 'dosage_advisory',
        title: 'Precision Bio-Dosage Calculator',
        config: { rateLitersPerAcre: 0.4, waterPerAcreLiters: 133 },
      },
    ],
  },
  soil_lime: {
    title: 'Acidic soil remediation & lime advisory',
    category: 'soil_health',
    description: 'Diagnostic survey calculating dolomitic lime requirement based on regional soil pH.',
    steps: [
      {
        id: 'step-soil',
        type: 'soil_test',
        title: 'Soil pH Sensor Input',
        config: { baselinePh: 4.8, targetPh: 6.5 },
      },
      {
        id: 'step-crop-remediation',
        type: 'crop_select',
        title: 'Target cereal crop',
        config: { crop: 'Wheat / Cereal', stage: 'Pre-Planting' },
      },
      {
        id: 'step-lime-calc',
        type: 'dosage_advisory',
        title: 'Agricultural lime rate formula',
        condition: 'pH < 5.5',
        config: { ratePerHectareMin: 2.0, ratePerHectareMax: 2.5 },
      },
    ],
  },
};

export interface PaletteItem {
  type: WorkflowStep['type'];
  title: string;
  icon?: string;
  description: string;
  defaultConfig: Record<string, string | number | boolean>;
}

export const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'crop_select',
    title: 'Crop & phenology',
    description: 'Crop species, variety, and growth stage selector.',
    defaultConfig: { crop: 'Maize', stage: 'V4 - Early Whorl' },
  },
  {
    type: 'soil_test',
    title: 'Soil Chemistry & pH',
    description: 'pH sensor input, texture class & ISRIC telemetry.',
    defaultConfig: { baselinePh: 5.5, targetPh: 6.5 },
  },
  {
    type: 'pest_scout',
    title: 'Pest & disease rater',
    description: 'Severity slider (1-100%) and threshold alert.',
    defaultConfig: { threshold: 30, action: 'Flag outbreak alert' },
  },
  {
    type: 'photo_leaf',
    title: 'Camera Diagnostic',
    description: 'Offline MobileNet leaf photo scan & GPS tag.',
    defaultConfig: { model: 'MobileNetV3-Agro-Edge', gpsTag: true },
  },
  {
    type: 'dosage_advisory',
    title: 'Bio-Dosage Calculator',
    description: 'Dynamic Neem oil or Lime dosage per acreage.',
    defaultConfig: { rateLitersPerAcre: 0.4, waterPerAcreLiters: 133 },
  },
];
