import { Brain, Building2, CloudSun, GraduationCap, Heart, Layers, Wifi } from 'lucide-react';

// Content of the "why farmers choose", community, ecosystem and simulator sections.

export const painPoints = [
  {
    problem: 'Watching your crops wither while waiting days for an agronomist to visit',
    solution: 'Share leaf photos and symptoms to support a conversation with an extension officer',
  },
  {
    problem: 'Wasting hard-earned money on expensive chemical sprays that do not work',
    solution: 'Seek a confirmed diagnosis and locally authorized guidance before treatment',
  },
  {
    problem: 'Losing seeds and fertilizer because rain came late or washed soil away',
    solution: 'Use available forecasts alongside local field knowledge when planning farm activities',
  },
  {
    problem: 'Complicated technical advice written in foreign languages with small print',
    solution: 'Voice and visual guidance in your local dialect with zero confusing tech jargon',
  },
];

export const audiences = [
  {
    icon: Heart,
    title: 'Smallholder farmers',
    desc: 'Explore crop observations and available weather information, then consult a local expert.',
  },
  {
    icon: GraduationCap,
    title: 'Field extension officers',
    desc: 'Equipped with offline mobile tools to visit more farms, map parcels, and halt outbreaks rapidly.',
  },
  {
    icon: Building2,
    title: 'Ag cooperatives & ministries',
    desc: 'Track regional pest radars, monitor aggregate district health, and coordinate input distribution.',
  },
];

export const capabilities = [
  {
    icon: CloudSun,
    title: 'Satellite weather',
    badge: 'NASA POWER API',
    desc: 'Solar irradiance, precipitation coefficients, and thermal forecasts tailored to exact GPS farm coordinates.',
  },
  {
    icon: Layers,
    title: 'Soil telemetry',
    badge: 'SoilGrids ISRIC',
    desc: 'Explore available soil information; local testing and expert interpretation remain important.',
  },
  {
    icon: Brain,
    title: 'AI advisory engine',
    badge: 'RAG knowledge graph',
    desc: 'Explore possible causes and retrieved information; expert confirmation is required.',
  },
  {
    icon: Wifi,
    title: 'Offline-first sync',
    badge: 'Field workflows',
    desc: 'Some field workflows support offline capture and synchronization when connectivity returns.',
  },
];

export const operationalStandards = [
  { title: 'FAOSTAT integrated', sub: 'Production & price statistics', target: '#capabilities' },
  { title: 'Voice synthesis', sub: 'Automated visit logs', target: '#features' },
  { title: 'Multi-district', sub: 'Climatic zone profiling', target: '#agent-os' },
  { title: 'Encrypted store', sub: 'Tamper-proof records', target: '#faq' },
];

export type ChannelTab = 'sms' | 'whatsapp' | 'telegram';

/** Fictional scenarios for the advisory simulator: nothing is sent and no farmer is real. */
export const SANDBOX_PRESETS = [
  {
    id: 'armyworm',
    title: 'Fall armyworm containment',
    goalPrompt: 'Illustrate a possible workflow for reporting maize symptoms and requesting expert review.',
    targetRegion: 'Nakuru County',
    targetCrop: 'Maize',
    affectedFarmers: 45,
    alertsDispatched: 45,
    visitsQueued: 3,
    skillTitle: 'Example crop observation',
    skillBody: 'Record symptoms and location, then consult a local extension officer before treatment.',
    channelPreview: {
      sms: 'Example: Please contact your local extension officer about observed maize symptoms.',
      whatsapp: 'Example: Record maize symptoms and contact an extension officer for confirmation.',
      telegram: 'Example: A crop observation may need expert review.',
    },
  },
  {
    id: 'potato-blight',
    title: 'Potato late blight prevention',
    goalPrompt: 'Illustrate a possible workflow for reviewing potato symptoms and local weather.',
    targetRegion: 'Nyandarua County',
    targetCrop: 'Irish potatoes',
    affectedFarmers: 62,
    alertsDispatched: 62,
    visitsQueued: 5,
    skillTitle: 'Example potato observation',
    skillBody: 'Weather and symptoms alone do not confirm a disease. Ask a local expert to assess the crop.',
    channelPreview: {
      sms: 'Example: Consult an extension officer about potato symptoms.',
      whatsapp: 'Example: Share observations with a local expert for diagnosis.',
      telegram: 'Example: Potato symptoms may need expert review.',
    },
  },
  {
    id: 'nutrient-recovery',
    title: 'Heavy rain nutrient recovery',
    goalPrompt: 'Illustrate a possible workflow for reviewing soil conditions after rain.',
    targetRegion: 'Uasin Gishu County',
    targetCrop: 'Maize & wheat',
    affectedFarmers: 38,
    alertsDispatched: 38,
    visitsQueued: 2,
    skillTitle: 'Example soil observation',
    skillBody: 'A soil test and local advice can help determine whether an amendment is appropriate.',
    channelPreview: {
      sms: 'Example: Ask a soil specialist about field conditions after rain.',
      whatsapp: 'Example: Share soil-test results with a local specialist.',
      telegram: 'Example: Soil conditions may need expert review.',
    },
  },
];

export type SandboxPreset = (typeof SANDBOX_PRESETS)[number];

/** The four steps the simulator walks through for a scenario. */
export function simulationSteps(preset: SandboxPreset) {
  return [
    { step: '1. Collect observations', detail: 'Example: gather symptoms and relevant local context.' },
    { step: '2. Review information', detail: `Example: review "${preset.skillTitle}" with an expert.` },
    {
      step: '3. Identify recipients',
      detail: `Illustrative ${preset.targetCrop} scenario in ${preset.targetRegion}; no farmers were identified.`,
    },
    { step: '4. Preview communication', detail: 'Example only: no advisories were dispatched and no visits were queued.' },
  ];
}
