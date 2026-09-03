import { Building2, GraduationCap, Heart } from 'lucide-react';

// Data moved verbatim from pages/LandingPage.tsx (pure move).

export const painPoints = [
  {
    problem: 'Paper-based field visit records lost or delayed by weeks',
    solution: 'Digital visit logs synced in real time, even offline',
  },
  {
    problem: 'Guesswork recommendations with no soil or weather data',
    solution: 'NASA POWER weather + SoilGrids soil data in every decision',
  },
  {
    problem: 'No visibility into officer performance or farmer outcomes',
    solution: 'Live analytics dashboard with per-officer metrics',
  },
  {
    problem: 'Crop diseases identified too late, after spread',
    solution: 'AI disease diagnosis from photos, treatment in minutes',
  },
];

export const steps = [
  {
    num: '01',
    title: 'Register Farmers',
    desc: 'Add farmers with GPS coordinates, crop data, soil info, and contact details. Bulk import supported.',
  },
  {
    num: '02',
    title: 'Track & Visit',
    desc: 'Schedule field visits, record observations, capture photos, and log follow-up actions from any device.',
  },
  {
    num: '03',
    title: 'Analyze & Act',
    desc: 'AI surfaces insights, predicts risks, recommends actions, and generates reports for stakeholders.',
  },
];

export const audiences = [
  {
    icon: Building2,
    title: 'Government Agencies',
    desc: 'National and regional agricultural ministries scaling extension services across districts.',
  },
  {
    icon: GraduationCap,
    title: 'NGOs & Development Orgs',
    desc: 'World Bank, FAO, AGRA, and field partners running agricultural improvement programs.',
  },
  {
    icon: Heart,
    title: 'Cooperatives & Agribusiness',
    desc: 'Farmer cooperatives and agribusiness companies managing contract farming at scale.',
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
    question: 'How does offline-first sync work in remote rural areas without cellular coverage?',
    answer:
      'GPExts is built with a resilient offline-first architecture. Extension officers can register farmers, record visit observations, capture diagnostic photos, and query locally cached agronomic guidelines without an active internet connection. When returning to cellular range or Wi-Fi, all pending records synchronize seamlessly with conflict-free reconciliation and cryptographic timestamps.',
  },
  {
    question: 'Where is our organizational and farmer data hosted, and who owns it?',
    answer:
      'Your organization retains 100% legal data sovereignty and ownership. GPExts enforces strict tenant database isolation, encrypted storage at rest (AES-256) and in transit (TLS 1.3), and role-based access control (RBAC). We fully support jurisdictional data residency requirements and built-in Data Rights tools for automated export and audited record erasure.',
  },
  {
    question: 'How are AI recommendations validated to ensure agronomic reliability?',
    answer:
      'Our AI Advisory Engine uses Retrieval-Augmented Generation (RAG) anchored strictly in verified institutional knowledge bases—including FAOSTAT agronomy manuals, localized SoilGrids ISRIC soil profiles, and NASA POWER weather telemetry. Every recommendation includes transparent source citations, confidence scores, and an optional human-in-the-loop supervisor review queue.',
  },
  {
    question: 'What devices and hardware are supported for extension officers in the field?',
    answer:
      'The platform is built as a lightweight, battery-efficient Progressive Web App (PWA) and responsive mobile application. It runs smoothly on budget Android smartphones and tablets (Android 8.0+), iOS devices, and desktop browsers, requiring no costly proprietary field hardware.',
  },
  {
    question: 'Can GPExts be customized for regional crop varieties, languages, and local units?',
    answer:
      'Yes. GPExts is globally configurable. Administrators can define custom crop catalogs, local soil nutrient thresholds, regional measurement units (hectares vs. acres, kg vs. lbs, metric vs. imperial), and localized interfaces across more than 10 languages (including Swahili, French, Hausa, Hindi, Portuguese, and Spanish).',
  },
  {
    question: 'How can an agricultural ministry, NGO, or cooperative start a pilot deployment?',
    answer:
      'Organizations can launch an instant self-service trial or test drive the interactive demo immediately. For large-scale multi-district deployments, our team provides assisted data onboarding, bulk farmer registry import, custom GIS layer indexing, and dedicated agronomic training workshops.',
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
