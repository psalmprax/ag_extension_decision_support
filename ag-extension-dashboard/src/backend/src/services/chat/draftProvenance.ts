/**
 * An officer's reply that began as the copilot's AI draft. The message records
 * only that it did (and whether the officer changed it); the draft text itself
 * is never stored on the message, which the farmer can read. An edited draft is
 * sent to the agronomic review queue with both versions, so the people who keep
 * the knowledge base see where the AI needed correcting.
 */
import { enqueueAdvisoryReview } from '@/services/knowledge/reviewQueue';
import { logger } from '@/utils/logger';

const MAX_DRAFT_LENGTH = 4000;
/** Below this word overlap the officer wrote their own reply; the draft is not credited. */
const MIN_SHARED_WORDS = 0.3;

const words = (text: string) => new Set(text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
const normalise = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

/** Share of words the draft and the sent reply have in common (Jaccard). */
export function sharedWordRatio(a: string, b: string): number {
  const left = words(a);
  const right = words(b);
  if (!left.size && !right.size) return 1;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / (left.size + right.size - shared);
}

export interface DraftProvenance {
  draft: string;
  edited: boolean;
}

/** null when there was no draft, or the reply has too little in common with it to be called a draft. */
export function draftProvenance(draft: unknown, sent: string): DraftProvenance | null {
  if (typeof draft !== 'string') return null;
  const text = draft.trim().slice(0, MAX_DRAFT_LENGTH);
  if (!text || sharedWordRatio(text, sent) < MIN_SHARED_WORDS) return null;
  return { draft: text, edited: normalise(text) !== normalise(sent) };
}

/** Queue an officer's correction of an AI draft for review. Never throws or delays the message. */
export function scheduleDraftCorrectionReview(params: { conversationId: string; officerId: string; draft: string; sent: string }): void {
  setImmediate(() => {
    enqueueAdvisoryReview({
      conversationId: params.conversationId,
      createdBy: params.officerId,
      recommendation: `AI draft:\n${params.draft}\n\nThe officer sent instead:\n${params.sent}`,
      trigger: 'officer_edit',
    }).catch(error => logger.warn('Could not queue an officer correction for review:', error));
  });
}
