import { Building2, GraduationCap, Heart } from 'lucide-react';

// Data moved verbatim from pages/LandingPage.tsx (pure move).

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

export const steps = [
  {
    num: '01',
    title: 'Snap a Leaf Photo',
    desc: 'Point your camera at any yellowing leaf, spotted fruit, stem rot, or insect pest on your farm.',
  },
  {
    num: '02',
    title: 'Review Possible Causes',
    desc: 'The assessment suggests possible causes; it is not a confirmed diagnosis.',
  },
  {
    num: '03',
    title: 'Consult a Local Expert',
    desc: 'Confirm the cause and locally authorized options with an extension officer before treatment.',
  },
];

export const audiences = [
  {
    icon: Heart,
    title: 'Smallholder Farmers',
    desc: 'Explore crop observations and available weather information, then consult a local expert.',
  },
  {
    icon: GraduationCap,
    title: 'Field Extension Officers',
    desc: 'Equipped with offline mobile tools to visit more farms, map parcels, and halt outbreaks rapidly.',
  },
  {
    icon: Building2,
    title: 'Ag Cooperatives & Ministries',
    desc: 'Track regional pest radars, monitor aggregate district health, and coordinate input distribution.',
  },
];

export const globalTelemetryNodes = [
  { x: 51, y: 48, label: 'Nairobi, Kenya', region: 'East Africa' },
  { x: 44, y: 45, label: 'Lagos, Nigeria', region: 'West Africa' },
  { x: 48, y: 43, label: 'Kampala, Uganda', region: 'East Africa' },
  { x: 38, y: 44, label: 'Accra, Ghana', region: 'West Africa' },
  { x: 67, y: 36, label: 'New Delhi, India', region: 'South Asia' },
  { x: 76, y: 42, label: 'Hanoi, Vietnam', region: 'Southeast Asia' },
  { x: 29, y: 64, label: 'São Paulo, Brazil', region: 'Latin America' },
  { x: 23, y: 26, label: 'Saskatoon, Canada', region: 'North America' },
  { x: 53, y: 32, label: 'Cairo, Egypt', region: 'North Africa' },
  { x: 54, y: 55, label: 'Lusaka, Zambia', region: 'Southern Africa' },
];

export const faqItems = [
  {
    question: 'Does this app work without an active internet connection in rural fields?',
    answer:
      'Some field workflows support offline use and synchronization when connectivity returns. Cloud analysis and current external data require a connection; availability depends on the device and deployment.',
  },
  {
    question: 'Do I need an expensive smartphone to use GPExts?',
    answer:
      'The web application supports mobile browsers. SMS and USSD availability depends on provider and carrier configuration; contact your organization for supported channels.',
  },
  {
    question: 'Is GPExts free for individual smallholder farmers?',
    answer:
      'Availability and pricing depend on your organization and deployment. Check the current plan details before signing up.',
  },
  {
    question: 'Which crops and plant diseases are currently supported?',
    answer:
      'The disease reference includes multiple crops and conditions, but coverage and accuracy vary. Results are suggestions, not confirmed diagnoses; consult a local expert.',
  },
  {
    question: 'Can I listen to advice in my local native language?',
    answer:
      'Language and speech support vary by feature, browser and configured provider. Check the available language and audio options in your deployment.',
  },
  {
    question: 'How do Agricultural Extension Officers and Ministries use GPExts?',
    answer:
      'Extension officers use GPExts on motorbikes and field visits to register farmers, track GPS parcels, log observation histories, and coordinate outbreak containment. Ministries and cooperatives access a specialized web portal to view district outbreak heatmaps and optimize supply chain delivery.',
  },
];

export const SANDBOX_PRESETS = [
  {
    id: 'armyworm',
    badge: 'PEST INTERVENTION',
    title: '🌽 Fall Armyworm Containment',
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
    badge: 'PATHOLOGY SHIELD',
    title: '🥔 Potato Late Blight Prevention',
    goalPrompt: 'Illustrate a possible workflow for reviewing potato symptoms and local weather.',
    targetRegion: 'Nyandarua County',
    targetCrop: 'Irish Potatoes',
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
    badge: 'SOIL & WEATHER',
    title: '🌧️ Heavy Rain Nutrient Recovery',
    goalPrompt: 'Illustrate a possible workflow for reviewing soil conditions after rain.',
    targetRegion: 'Uasin Gishu County',
    targetCrop: 'Maize & Wheat',
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
