import { Briefcase, Landmark, Layers, MapPin, Radio, Satellite, UserCheck } from 'lucide-react';

// Content of the satellite-to-soil pipeline section: the same four stages told for each audience.

export type AudiencePersona = 'officers' | 'agribusiness' | 'donors';

export const personas = [
  { id: 'officers' as const, label: 'Field officers', icon: UserCheck },
  { id: 'agribusiness' as const, label: 'Agribusiness & co-ops', icon: Briefcase },
  { id: 'donors' as const, label: 'Gov & donors', icon: Landmark },
];

/** The four stages, whoever the story is for. */
export const pipelineStages = [
  { name: 'Satellite', subtitle: 'How solar flux and rainfall drive the season', icon: Satellite },
  { name: 'Topography', subtitle: 'How canopy growth is mapped across a field', icon: MapPin },
  { name: 'SoilGrids', subtitle: 'How clay, pH and moisture shape the root zone', icon: Layers },
  { name: 'Edge dispatch', subtitle: 'How an advisory reaches a farmer by SMS or USSD', icon: Radio },
];

export interface StageStory {
  num: string;
  title: string;
  category: string;
  bullets: string[];
  tag: string;
}

export const STAGE_STORIES: Record<AudiencePersona, StageStory[]> = {
  officers: [
    {
      num: '01',
      title: 'Orbital recon & atmospheric ingestion',
      category: 'Remote sensing engine',
      bullets: [
        'Real-time NASA POWER solar radiation flux (MJ/m²)',
        'Global GPM daily precipitation coefficients',
        'Automated spatial coordinate locks on smallholder plots',
      ],
      tag: 'NASA POWER + Sentinel-2',
    },
    {
      num: '02',
      title: 'Topological elevation & NDVI biomass',
      category: 'Canopy health & GPS mapping',
      bullets: [
        'Centimeter-accurate field boundary polygon mapping',
        'Multi-spectral NDVI vegetation vigor indices',
        'Stressed foliage early anomaly alerts before yield loss',
      ],
      tag: 'Sub-meter polygon precision',
    },
    {
      num: '03',
      title: 'Subsurface soil horizon stratigraphy',
      category: 'ISRIC SoilGrids v2 integration',
      bullets: [
        'Clay, sand, and silt density gradients (0-100cm depth)',
        'Cation exchange capacity (CEC) & pH aluminum toxicity risk',
        'Root-zone soil moisture percolation modeling',
      ],
      tag: 'Depth-calibrated agronomy',
    },
    {
      num: '04',
      title: 'AI decision synthesis & edge uplink',
      category: 'Autonomous advisory & USSD dispatch',
      bullets: [
        'Agronomic RAG synthesis citing FAO, IITA & CIMMYT protocols',
        'Instant prescription routing to field extension officers',
        'Zero-internet SMS/USSD fallback for offline farmers',
      ],
      tag: 'Offline-ready delivery',
    },
  ],
  agribusiness: [
    {
      num: '01',
      title: 'Macro weather sourcing & climatology',
      category: 'Commodity supply security',
      bullets: [
        'Predict seasonal drought risks across outgrower clusters',
        'Verify planting rainfall windows before fertilizer procurement',
        'Continuous supply risk scoring across your farmer contract portfolio',
      ],
      tag: 'Yield risk modeling',
    },
    {
      num: '02',
      title: 'Farm yield forecast & acreage tracking',
      category: 'Portfolio canopy monitoring',
      bullets: [
        'Sub-meter field boundaries eliminate phantom smallholder acreage',
        'Vegetation-anomaly signals to flag emerging crop stress early',
        'Predict harvest tonnage volume for warehouse logistics',
      ],
      tag: 'Supply assurance',
    },
    {
      num: '03',
      title: 'Input efficiency & fertilizer optimization',
      category: 'ISRIC SoilGrids precision inputs',
      bullets: [
        'Custom N-P-K & lime blend recommendations per district',
        'Targeted fertilizer guidance to cut smallholder input wastage',
        'Protect topsoil fertility against long-term acidification',
      ],
      tag: 'Optimized input spend',
    },
    {
      num: '04',
      title: 'Enterprise ERP & buyer telemetry',
      category: 'Automated dispatch & compliance',
      bullets: [
        '[Status: Demonstrator] EUDR deforestation heuristic estimator (not regulatory certification)',
        'Broadcast bulk harvest instructions via 2-way SMS gateway',
        '[Roadmap] SAP/NetSuite connector — not yet integrated',
      ],
      tag: 'Export & ERP [demo/roadmap]',
    },
  ],
  donors: [
    {
      num: '01',
      title: 'Climate adaptation & satellite monitoring',
      category: 'Food security resilience',
      bullets: [
        'Track climate vulnerability across vulnerable rural zones',
        'Early-warning food-supply signals ahead of harvest',
        'Satellite-backed transparency for grant reporting',
      ],
      tag: 'UN SDG 2: Zero Hunger',
    },
    {
      num: '02',
      title: 'Smallholder land inclusion & GPS footprints',
      category: 'Equitable access & tenure',
      bullets: [
        'Digital farm identity for underbanked women & youth farmers',
        'Verify smallholder boundary compliance without field disputes',
        'Aggregate community crop health indices for program audits',
      ],
      tag: 'Financial inclusion',
    },
    {
      num: '03',
      title: 'Regenerative soil & carbon stratigraphy',
      category: 'Soil carbon & conservation',
      bullets: [
        'Measure topsoil organic carbon buildup year-over-year',
        'Identify soil erosion hotspots for reforestation programs',
        'Target subsidised lime distributions to severe acid soils',
      ],
      tag: 'Regenerative agriculture',
    },
    {
      num: '04',
      title: 'Last-mile digital extension & USSD',
      category: 'No smallholder left behind',
      bullets: [
        'Serve basic 2G feature phones without requiring internet access',
        'Multi-language advisory in local dialects and voice synthesis',
        'Track measured smallholder yield & income change per programme',
      ],
      tag: 'Last-mile impact',
    },
  ],
};
