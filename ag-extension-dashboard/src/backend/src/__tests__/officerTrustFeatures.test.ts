jest.mock('@/services/knowledge/reviewQueue', () => ({ enqueueAdvisoryReview: jest.fn().mockResolvedValue('review-1') }));
jest.mock('@/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { answerSourceMetadata } from '@/services/chat/answerSources';
import { draftProvenance, scheduleDraftCorrectionReview, sharedWordRatio } from '@/services/chat/draftProvenance';
import { checkVisitLocation } from '@/services/visitLocationCheck';
import { enqueueAdvisoryReview } from '@/services/knowledge/reviewQueue';
import type { AdvisoryCitation } from '@/services/knowledge/advisoryPolicy';

const citation = (title: string, sourceUrl?: string): AdvisoryCitation => ({
  sourceId: title, title, category: 'manual', excerpt: '', score: 0.8, ...(sourceUrl ? { sourceUrl } : {}),
});

describe('AI answer sources saved with the message', () => {
  it('numbers the sources as the answer cites them and calls a grounded answer sourced', () => {
    const meta = answerSourceMetadata(
      [citation('KALRO maize guide', 'https://www.kalro.org/maize'), citation('Ministry pest manual')],
      { status: 'retrieved_not_independently_verified', invalidReferences: false },
      null,
    );
    expect(meta).toEqual({
      sources: [
        { n: 1, title: 'KALRO maize guide', url: 'https://www.kalro.org/maize' },
        { n: 2, title: 'Ministry pest manual', url: null },
      ],
      evidence: 'sourced',
      review: null,
    });
  });

  it('calls unsourced or mis-cited advice general guidance, with why it was queued', () => {
    expect(answerSourceMetadata([], { status: 'general_guidance_only', invalidReferences: false }, 'no_sources'))
      .toMatchObject({ sources: [], evidence: 'general', review: 'no_sources' });
    expect(answerSourceMetadata([citation('A')], { status: 'retrieved_not_independently_verified', invalidReferences: true }, 'invalid_references'))
      .toMatchObject({ evidence: 'general', review: 'invalid_references' });
  });
});

describe('officer replies drafted by the AI', () => {
  const draft = 'Thanks Mary. When did the yellowing start, and is it on the lower leaves first?';

  it('marks a reply sent as drafted, and one the officer edited', () => {
    expect(draftProvenance(draft, draft)).toEqual({ draft, edited: false });
    expect(draftProvenance(draft, `  ${draft.toUpperCase()}  `)).toEqual({ draft, edited: false });
    expect(draftProvenance(draft, 'Thanks Mary. When did the yellowing start? I will visit on Thursday.')).toEqual({ draft, edited: true });
  });

  it('does not credit the AI when the officer wrote their own reply, or sent no draft', () => {
    expect(draftProvenance(draft, 'I will come on Thursday with the soil kit.')).toBeNull();
    expect(draftProvenance(undefined, draft)).toBeNull();
    expect(draftProvenance('   ', draft)).toBeNull();
    expect(sharedWordRatio('a b c', 'a b c')).toBe(1);
  });

  it('queues an edited draft for review with both versions, without holding the message', async () => {
    scheduleDraftCorrectionReview({ conversationId: 'thread-1', officerId: 'officer-1', draft, sent: 'Edited reply' });
    expect(enqueueAdvisoryReview).not.toHaveBeenCalled();
    await new Promise(resolve => setImmediate(resolve));
    expect(enqueueAdvisoryReview).toHaveBeenCalledWith({
      conversationId: 'thread-1',
      createdBy: 'officer-1',
      recommendation: `AI draft:\n${draft}\n\nThe officer sent instead:\nEdited reply`,
      trigger: 'officer_edit',
    });
  });
});

describe('verified visits', () => {
  // Farm near Nakuru; 0.001 degrees of latitude is about 111 m.
  const farm = { lat: '-0.30310000', lng: '36.08000000' };

  it('confirms a report filed on the farm, with the distance', () => {
    const check = checkVisitLocation({ latitude: -0.3022, longitude: 36.08, accuracy: 15 }, farm);
    expect(check.status).toBe('on_farm');
    expect(check.distanceM).toBeGreaterThan(90);
    expect(check.distanceM).toBeLessThan(110);
    expect(check.accuracyM).toBe(15);
  });

  it('flags a report filed away from the farm', () => {
    expect(checkVisitLocation({ latitude: -0.2831, longitude: 36.08, accuracy: 10 }, farm)).toMatchObject({ status: 'away' });
  });

  it('cannot confirm with a vague fix, an unknown farm location, or no location', () => {
    expect(checkVisitLocation({ latitude: -0.3031, longitude: 36.08, accuracy: 850 }, farm).status).toBe('imprecise');
    expect(checkVisitLocation({ latitude: -0.3031, longitude: 36.08, accuracy: 10 }, { lat: null, lng: null }).status).toBe('farm_location_unknown');
    expect(checkVisitLocation(null, farm)).toEqual({ status: 'not_shared', distanceM: null, accuracyM: null });
  });
});
