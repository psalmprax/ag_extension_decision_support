/**
 * What an AI answer rests on, saved with the message so the farmer and the
 * officer see it whenever the thread is opened, not only when it was asked.
 */
import type { AdvisoryCitation } from '@/services/knowledge/advisoryPolicy';
import type { ReviewTrigger } from '@/services/knowledge/reviewQueue';

/** One retrieved source; `n` matches the answer's [n] markers. */
export interface AnswerSource {
  n: number;
  title: string;
  url: string | null;
}

export interface AnswerSourceMetadata {
  sources: AnswerSource[];
  /** sourced: grounded in retrieved sources with valid references; general: the model's own guidance. */
  evidence: 'sourced' | 'general';
  /** Why the answer was queued for agronomic review, if it was. */
  review: ReviewTrigger | null;
}

export function answerSourceMetadata(
  citations: AdvisoryCitation[],
  evidence: { status: string; invalidReferences: boolean },
  review: ReviewTrigger | null,
): AnswerSourceMetadata {
  return {
    sources: citations.map((citation, index) => ({
      n: index + 1,
      title: citation.title.slice(0, 200),
      url: citation.sourceUrl ?? null,
    })),
    evidence: evidence.status !== 'general_guidance_only' && !evidence.invalidReferences ? 'sourced' : 'general',
    review,
  };
}
