import { Brain, CloudSun, Layers, Wifi } from 'lucide-react';

// The "why farmers choose", community, ecosystem and simulator sections. Every visible string is
// a translation key (English in public/locales/en.json); ids stay stable whatever the language.

export const painPoints = ['waiting', 'sprays', 'rain', 'jargon'].map(id => ({
  id,
  problem: `landing_pain_${id}_problem`,
  solution: `landing_pain_${id}_solution`,
}));

export const capabilities = [
  { id: 'weather', icon: CloudSun },
  { id: 'soil', icon: Layers },
  { id: 'advisory', icon: Brain },
  { id: 'offline', icon: Wifi },
].map(item => ({
  ...item,
  title: `landing_capability_${item.id}_title`,
  badge: `landing_capability_${item.id}_badge`,
  desc: `landing_capability_${item.id}_desc`,
}));

export const operationalStandards = [
  { id: 'faostat', target: '#capabilities' },
  { id: 'voice', target: '#features' },
  { id: 'districts', target: '#agent-os' },
  { id: 'records', target: '#faq' },
].map(item => ({ ...item, title: `landing_standard_${item.id}_title`, sub: `landing_standard_${item.id}_sub` }));

export type ChannelTab = 'sms' | 'whatsapp' | 'telegram';

/** Translation keys of one fictional simulator scenario. */
function scenarioKeys(id: string) {
  const key = `landing_sim_${id.replace(/-/g, '_')}`;
  return {
    title: `${key}_title`,
    goalPrompt: `${key}_goal`,
    targetCrop: `${key}_crop`,
    skillTitle: `${key}_skill_title`,
    skillBody: `${key}_skill_body`,
    channelPreview: { sms: `${key}_sms`, whatsapp: `${key}_whatsapp`, telegram: `${key}_telegram` } as Record<ChannelTab, string>,
  };
}

/**
 * Fictional scenarios for the advisory simulator: nothing is sent and no farmer is real. Regions
 * are place names; the example counts are part of the illustration.
 */
export const SANDBOX_PRESETS = [
  { id: 'armyworm', targetRegion: 'Nakuru County', affectedFarmers: 45, alertsDispatched: 45, visitsQueued: 3 },
  { id: 'potato-blight', targetRegion: 'Nyandarua County', affectedFarmers: 62, alertsDispatched: 62, visitsQueued: 5 },
  { id: 'nutrient-recovery', targetRegion: 'Uasin Gishu County', affectedFarmers: 38, alertsDispatched: 38, visitsQueued: 2 },
].map(preset => ({ ...preset, ...scenarioKeys(preset.id) }));

export type SandboxPreset = (typeof SANDBOX_PRESETS)[number];

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** The four steps the simulator walks through for a scenario, in the reader's language. */
export function simulationSteps(preset: SandboxPreset, t: Translate) {
  const params = { skillTitle: t(preset.skillTitle), crop: t(preset.targetCrop), region: preset.targetRegion };
  return [1, 2, 3, 4].map(n => ({
    step: t(`landing_sim_step_${n}_title`),
    detail: t(`landing_sim_step_${n}_detail`, params),
  }));
}
