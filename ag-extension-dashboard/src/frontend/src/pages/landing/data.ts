import { Building2, GraduationCap, Heart } from 'lucide-react';

// Data moved verbatim from pages/LandingPage.tsx (pure move).

export const painPoints = [
  {
    problem: 'Watching your crops wither while waiting days for an agronomist to visit',
    solution: 'Instant leaf photo scan identifying pests & diseases in 3 seconds directly on your phone',
  },
  {
    problem: 'Wasting hard-earned money on expensive chemical sprays that do not work',
    solution: 'Targeted organic and affordable remedies with step-by-step application instructions',
  },
  {
    problem: 'Losing seeds and fertilizer because rain came late or washed soil away',
    solution: 'Hyperlocal 7-day rain forecasts so you know the exact right day to sow, spray, and harvest',
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
    title: 'Get 3-Second Diagnosis',
    desc: 'Our AI Crop Doctor spots the exact disease, pest, or nutrient deficiency with 98%+ accuracy.',
  },
  {
    num: '03',
    title: 'Apply the Cure',
    desc: 'Follow step-by-step treatment instructions using low-cost local supplies, biocontrol, and organic remedies.',
  },
];

export const audiences = [
  {
    icon: Heart,
    title: 'Smallholder Farmers',
    desc: 'Get instant pocket crop doctor advice, rain predictions, and localized treatment plans on any device.',
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
      'Yes, 100%! GPExts is designed from the ground up to run offline. The leaf scanner runs on-device neural vision models directly inside your phone. You can diagnose crops, check treatment guides, and record farm notes deep in the field with zero cellular signal. Everything syncs automatically whenever you return to connectivity.',
  },
  {
    question: 'Do I need an expensive smartphone to use GPExts?',
    answer:
      'No. The application is ultra-lightweight and runs smoothly on low-cost Android phones (including Android Go), iPhones, or basic mobile browsers. Furthermore, farmers without smartphones can receive automated SMS and USSD voice advisories directly on simple feature phones.',
  },
  {
    question: 'Is GPExts free for individual smallholder farmers?',
    answer:
      'Yes! Crop disease diagnosis, rain forecasts, and basic agronomic remedies are completely free for individual smallholder farmers. Institutional features (such as bulk district management, multi-officer synchronization, and regional GIS exports) are funded by sponsoring cooperatives, NGOs, and government ministries.',
  },
  {
    question: 'Which crops and plant diseases are currently supported?',
    answer:
      'GPExts recognizes over 120 common agricultural pests, fungal infections, bacterial blights, and soil nutrient deficiencies across 30+ staple crops — including maize, cassava, tomatoes, beans, potatoes, rice, wheat, bananas, peppers, onions, coffee, and cocoa.',
  },
  {
    question: 'Can I listen to advice in my local native language?',
    answer:
      'Yes. You can listen to voice readouts and read instructions in your local dialect — including Swahili, Luganda, Hindi, Hausa, French, Spanish, Portuguese, and English. Simply tap the audio speaker icon on any diagnosis result card.',
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
    goalPrompt: 'Identify Nakuru maize farmers at risk of Armyworm post-rainfall, inject local bio-control skill card, dispatch Swahili advisory, and schedule scouting for vital score < 60.',
    targetRegion: 'Nakuru County',
    targetCrop: 'Maize',
    affectedFarmers: 45,
    alertsDispatched: 45,
    visitsQueued: 3,
    confidence: '96%',
    skillTitle: 'Nakuru Bio-Control Protocol (2026)',
    skillBody: 'Apply Neem extract + Pyrethrum at dusk (18:00-19:30). Alternate with Bacillus thuringiensis. Avoid mid-day application to protect pollinators.',
    channelPreview: {
      sms: 'Hello Amina Okafor,\n🌾 GP-Ext Alert: Early Fall Armyworm detected in Rongai. Inspect leaf whorls at sunset. Spray Neem extract today to prevent spread.',
      whatsapp: '🌿 *GP-Ext Regional Advisory (Nakuru)*\n\nHello Amina,\nFollowing recent rain and 78% humidity, scouting reveals early Armyworm instar in maize.\n\n✅ *Action:* Apply Neem/Pyrethrum at sunset.\n📍 *Extension Officer:* J. Mwangi visiting Thursday.',
      telegram: '🚨 *Automated Campaign Alert*\nRegion: Nakuru | Crop: Maize\nAction: Spray bio-control at dusk. Officer visit queued.',
    },
  },
  {
    id: 'potato-blight',
    badge: 'PATHOLOGY SHIELD',
    title: '🥔 Potato Late Blight Prevention',
    goalPrompt: 'Detect 3-day continuous damp cloud cover in Nyandarua, broadcast preventive copper fungicide timing to potato growers, and alert zonal officers.',
    targetRegion: 'Nyandarua County',
    targetCrop: 'Irish Potatoes',
    affectedFarmers: 62,
    alertsDispatched: 62,
    visitsQueued: 5,
    confidence: '94%',
    skillTitle: 'Kinangop Late Blight Spray Calendar',
    skillBody: 'Apply preventive Mancozeb or Copper oxychloride before rain onset. Ensure full under-leaf canopy coverage. Re-apply if rainfall exceeds 25mm.',
    channelPreview: {
      sms: 'Hello Joseph Mensah,\n🥔 GP-Ext Alert: Damp overcast week forecast in Nyandarua. Apply preventive copper spray before Thursday rains.',
      whatsapp: '🥔 *GP-Ext Disease Warning*\n\nHello Joseph,\nHigh humidity (>85%) increases late blight risk.\n\n✅ *Action:* Apply copper fungicide to Irish potatoes today.',
      telegram: '🚨 *Pathology Alert:* Nyandarua Late Blight fungicide window active.',
    },
  },
  {
    id: 'nutrient-recovery',
    badge: 'SOIL & WEATHER',
    title: '🌧️ Heavy Rain Nutrient Recovery',
    goalPrompt: 'Evaluate nitrogen leaching in Eldoret cereal plots after 80mm rainfall anomaly, dispatch split top-dressing guidance, and queue soil check.',
    targetRegion: 'Uasin Gishu County',
    targetCrop: 'Maize & Wheat',
    affectedFarmers: 38,
    alertsDispatched: 38,
    visitsQueued: 2,
    confidence: '98%',
    skillTitle: 'Eldoret Post-Storm Leaching Recovery',
    skillBody: 'Wait 24h for topsoil drainage before top dressing. Apply CAN at 50kg/acre in split dose to prevent secondary root burn.',
    channelPreview: {
      sms: 'Hello Ngozi Kalu,\n🌾 GP-Ext Alert: Heavy rain caused nitrogen leaching. Apply split CAN top-dressing once field drains.',
      whatsapp: '🌾 *Soil Fertility Alert*\n\nHello Ngozi,\n80mm rain anomaly recorded in Eldoret.\n\n✅ *Action:* Apply CAN fertilizer 50kg/acre once topsoil drains.',
      telegram: '🚨 *Agronomy Alert:* Eldoret Post-Storm top-dressing guide dispatched.',
    },
  },
];

export type SandboxPreset = (typeof SANDBOX_PRESETS)[number];
