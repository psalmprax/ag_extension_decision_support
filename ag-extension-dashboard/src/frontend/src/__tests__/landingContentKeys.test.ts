import { describe, expect, it } from 'vitest';
import en from '../../public/locales/en.json';
import { capabilities, operationalStandards, painPoints, SANDBOX_PRESETS, simulationSteps } from '@/pages/landing/sectionData';
import { personas, pipelineStages, STAGE_STORIES } from '@/pages/landing/pipelineStories';
import { faqItems, steps } from '@/pages/landing/data';
import { englishT } from '@/test/englishT';

/** Every string in a value that looks like a landing translation key. */
function keysIn(value: unknown): string[] {
  if (typeof value === 'string') return value.startsWith('landing_') ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(keysIn);
  if (value && typeof value === 'object') return Object.values(value).flatMap(keysIn);
  return [];
}

/**
 * The landing page's lists hold translation keys, not English, so every language can show them.
 * The source check only sees t('…') calls, so these keys are checked here.
 */
describe('landing content keys', () => {
  const keys = keysIn([painPoints, capabilities, operationalStandards, SANDBOX_PRESETS, personas, pipelineStages, STAGE_STORIES, steps, faqItems]);

  it('exist in the English locale', () => {
    expect(keys.length).toBeGreaterThan(150);
    const english = en as Record<string, string>;
    expect(keys.filter(key => !english[key])).toEqual([]);
  });

  it('fill the simulator steps with the scenario, in the reader’s language', () => {
    const details = simulationSteps(SANDBOX_PRESETS[1], (key, params) => englishT(key, undefined, params)).map(step => step.detail);
    expect(details[1]).toBe('Example: review "Example potato observation" with an expert.');
    expect(details[2]).toBe('Illustrative Irish potatoes scenario in Nyandarua County; no farmers were identified.');
  });
});
