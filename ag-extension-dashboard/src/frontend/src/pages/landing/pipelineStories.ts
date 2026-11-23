import { Briefcase, Landmark, Layers, MapPin, Radio, Satellite, UserCheck } from 'lucide-react';

// The satellite-to-soil pipeline: the same four stages told for each audience. Every visible
// string is a translation key (English in public/locales/en.json).

export type AudiencePersona = 'officers' | 'agribusiness' | 'donors';

export const personas = [
  { id: 'officers' as const, icon: UserCheck },
  { id: 'agribusiness' as const, icon: Briefcase },
  { id: 'donors' as const, icon: Landmark },
].map(item => ({ ...item, label: `landing_persona_${item.id}` }));

/** The four stages, whoever the story is for. */
export const pipelineStages = [
  { id: 'satellite', icon: Satellite },
  { id: 'topography', icon: MapPin },
  { id: 'soilgrids', icon: Layers },
  { id: 'dispatch', icon: Radio },
].map(item => ({ ...item, name: `landing_stage_${item.id}_name`, subtitle: `landing_stage_${item.id}_subtitle` }));

export interface StageStory {
  num: string;
  title: string;
  category: string;
  bullets: string[];
  tag: string;
}

function stories(persona: AudiencePersona): StageStory[] {
  return [1, 2, 3, 4].map(n => {
    const key = `landing_story_${persona}_${n}`;
    return {
      num: `0${n}`,
      title: `${key}_title`,
      category: `${key}_category`,
      bullets: [1, 2, 3].map(point => `${key}_point_${point}`),
      tag: `${key}_tag`,
    };
  });
}

export const STAGE_STORIES: Record<AudiencePersona, StageStory[]> = {
  officers: stories('officers'),
  agribusiness: stories('agribusiness'),
  donors: stories('donors'),
};
