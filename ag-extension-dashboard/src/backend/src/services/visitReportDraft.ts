import { AIRouter } from '@/services/aiProvider/aiProvider';
import { logger } from '@/utils/logger';

/**
 * Drafts a visit report from what the officer said during or after the visit.
 *
 * The model never writes report text. It is shown the officer's sentences, numbered,
 * and answers only with which numbers are findings and which are actions or advice
 * given, plus the time on the farm and the follow-up if the officer said them. The
 * report is then put together from the officer's own sentences, so it cannot contain
 * a pest, a product or a rate that was not said. The officer checks it before saving.
 */
export interface VisitReportDraft {
  /** What the officer saw, in their own words. */
  findings: string;
  /** What was done or advised, in their own words. */
  actions: string;
  /** Only when the officer said how long they were on the farm. */
  minutesOnFarm: number | null;
  /** Only when the officer said whether a follow-up is needed. */
  followUpRequired: boolean | null;
  /** Only when the officer said when to come back. */
  followUpInDays: number | null;
  /** False when the sentences could not be sorted and are all under findings. */
  organised: boolean;
}

const MAX_SENTENCES = 120;

/** Splits a transcript into sentences, keeping each sentence's own words and punctuation. */
export function splitSentences(transcript: string): string[] {
  const parts = transcript
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。؟።])\s+|\n+/u)
    .map(part => part.trim())
    .filter(Boolean);
  if (parts.length <= MAX_SENTENCES) return parts;
  // A very long recording: keep the tail together so nothing said is dropped.
  return [...parts.slice(0, MAX_SENTENCES - 1), parts.slice(MAX_SENTENCES - 1).join(' ')];
}

interface Sorting {
  findings?: unknown;
  actions?: unknown;
  minutesOnFarm?: unknown;
  followUpRequired?: unknown;
  followUpInDays?: unknown;
}

function sentenceNumbers(value: unknown, count: number): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= count);
}

function wholeNumberIn(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function parseSorting(raw: string): Sorting | null {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try {
    const parsed: unknown = JSON.parse(json);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Sorting) : null;
  } catch (err) {
    logger.warn('Visit report sorting was not valid JSON:', err);
    return null;
  }
}

/** Builds the draft from the officer's sentences; anything the model did not place goes to findings. */
export function assembleDraft(sentences: string[], sorting: Sorting | null): VisitReportDraft {
  if (!sorting) {
    return { findings: sentences.join(' '), actions: '', minutesOnFarm: null, followUpRequired: null, followUpInDays: null, organised: false };
  }
  const actionNumbers = new Set(sentenceNumbers(sorting.actions, sentences.length));
  const findings = sentences.filter((_, i) => !actionNumbers.has(i + 1));
  const actions = sentences.filter((_, i) => actionNumbers.has(i + 1));
  const followUpInDays = wholeNumberIn(sorting.followUpInDays, 1, 365);
  const followUpRequired = typeof sorting.followUpRequired === 'boolean' ? sorting.followUpRequired : followUpInDays ? true : null;
  return {
    findings: findings.join(' '),
    actions: actions.join(' '),
    minutesOnFarm: wholeNumberIn(sorting.minutesOnFarm, 1, 720),
    followUpRequired,
    followUpInDays: followUpRequired === false ? null : followUpInDays,
    organised: true,
  };
}

function sortingPrompt(sentences: string[]): string {
  const numbered = sentences.map((sentence, i) => `${i + 1}. ${sentence}`).join('\n');
  return `An agricultural extension officer recorded these sentences about a farm visit. They may be in any language.

${numbered}

Sort them. Answer with ONLY this JSON object and nothing else:
{"findings": [numbers of sentences about what was seen on the farm], "actions": [numbers of sentences about what the officer did, showed or advised], "minutesOnFarm": number or null, "followUpRequired": true, false or null, "followUpInDays": number or null}

Rules: use sentence numbers only, never write any words. Give minutesOnFarm only if the officer said how long the visit took, converted to minutes. Give followUpRequired and followUpInDays only if the officer said them; otherwise null.`;
}

export async function draftVisitReport(transcript: string): Promise<VisitReportDraft> {
  const sentences = splitSentences(transcript);
  if (sentences.length === 0) return assembleDraft([], null);
  try {
    const result = await AIRouter.routeRequest('generate', { prompt: sortingPrompt(sentences), options: { temperature: 0 } });
    return assembleDraft(sentences, parseSorting(result.text || ''));
  } catch (err) {
    logger.warn('Visit report sorting unavailable; keeping the whole recording under findings:', err);
    return assembleDraft(sentences, null);
  }
}
