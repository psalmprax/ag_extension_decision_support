import {
    findSharedAnswer,
    KNOWLEDGE_BASE_DAYS,
    knowledgeSourcesRevision,
    normalizeSharedQuestion,
    saveSharedAnswer,
    sharedAnswerDays,
    sharedAnswerKey,
    WEB_SOURCE_DAYS,
    type SharedAnswerCandidate,
} from '@/services/knowledge/sharedAnswerCache';
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import type { TypedQueryResult } from '@/services/db/query';
import type { FinalAnswer } from '@/services/knowledge/types';

jest.mock('@/services/databaseService', () => ({ query: jest.fn() }));
jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockQuery = jest.mocked(query);

/** A query result as the database helper returns it. */
function result<T>(rows: T[], rowCount = rows.length): TypedQueryResult<T> {
    return { rows, rowCount };
}
const ARTICLE = '3f1c2b4a-8d6e-4f7a-9b0c-1d2e3f4a5b6c';
const OTHER_ARTICLE = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const ANSWER = 'Scout 20 plants in a W pattern each week and record the share with fresh window-pane damage and live larvae [1]. '
    + 'Hand-pick egg masses where practical and keep field margins free of grassy weeds [1]. Ask your local extension office to confirm the action threshold for your maize growth stage.';

function source(id: string) {
    return { id, content: 'Extension guidance.', metadata: { title: 'Guide' }, score: 0.9 };
}

function answer(overrides: Partial<FinalAnswer> = {}): FinalAnswer {
    return {
        answer: ANSWER,
        reasoning: 'From the extension guide.',
        answerMode: 'generated',
        contextUsed: [source(ARTICLE)],
        advisoryQuality: {
            status: 'retrieved_not_independently_verified', sourceCount: 1, citedSourceNumbers: [1],
            invalidReferences: false, regulatoryAuthorization: 'not_established',
        },
        safety: { safe: true, violations: [], quarantineAlert: false, quarantineDiseases: [], hazardLevel: 'safe' },
        audio: 'base64-audio',
        cached: false,
        ...overrides,
    };
}

/** An answer as the cache stores it: no per-request cache flag, no audio. */
function storedForm(): Partial<FinalAnswer> {
    const stored: Partial<FinalAnswer> = answer();
    delete stored.cached;
    delete stored.audio;
    return stored;
}

function candidate(overrides: Partial<SharedAnswerCandidate> = {}): SharedAnswerCandidate {
    return { response: answer(), categories: ['pest_and_disease'], ...overrides };
}

describe('shared answer key', () => {
    const scope = { question: 'How do I control fall armyworm in maize?', country: 'Kenya', region: 'Nakuru', language: 'en' };
    const november = new Date('2026-11-24T12:00:00Z');

    it('treats capitals, spacing and end punctuation as the same question', () => {
        expect(normalizeSharedQuestion('  How do I control   Fall Armyworm in maize?? ')).toBe('how do i control fall armyworm in maize');
        expect(sharedAnswerKey({ ...scope, question: 'how do i control fall armyworm in MAIZE' }, november))
            .toBe(sharedAnswerKey(scope, november));
    });

    it('keeps answers for different places, languages, farm details and months apart', () => {
        const base = sharedAnswerKey(scope, november);
        expect(sharedAnswerKey({ ...scope, country: 'Ghana' }, november)).not.toBe(base);
        expect(sharedAnswerKey({ ...scope, region: 'Kisumu' }, november)).not.toBe(base);
        expect(sharedAnswerKey({ ...scope, language: 'sw' }, november)).not.toBe(base);
        expect(sharedAnswerKey({ ...scope, soil: 'sandy' }, november)).not.toBe(base);
        expect(sharedAnswerKey(scope, new Date('2026-12-01T00:00:00Z'))).not.toBe(base);
    });

    it('is a hash that does not contain the question', () => {
        const key = sharedAnswerKey(scope, november);
        expect(key).toMatch(/^[0-9a-f]{64}$/);
    });
});

describe('which answers may be shared', () => {
    it('keeps knowledge-base answers 30 days and answers that used web results 7', () => {
        expect(sharedAnswerDays(candidate())).toBe(KNOWLEDGE_BASE_DAYS);
        expect(sharedAnswerDays(candidate({ response: answer({ contextUsed: [source(ARTICLE), source('web-0-1732')] }) }))).toBe(WEB_SOURCE_DAYS);
    });

    it.each([
        ['live weather or prices went into it', { response: answer({ contextUsed: [source(ARTICLE), source('live-weather-1')] }) }],
        ['a source of unknown origin went into it', { response: answer({ contextUsed: [source('stealth-0-1')] }) }],
        ['a tool was used', { toolsUsed: ['get_weather_forecast'] }],
        ['a photo was attached', { attachments: [{ type: 'image' as const, data: 'x' }] }],
        ['it is about prices', { categories: ['market_prices'] }],
        ['it is about the weather', { categories: ['pest_and_disease', 'climate_and_weather'] }],
        ['it is a source excerpt, not a written answer', { response: answer({ answerMode: 'extractive' }) }],
        ['it cites nothing', { response: answer({ advisoryQuality: { ...answer().advisoryQuality!, citedSourceNumbers: [] } }) }],
        ['it cited a source it was not given', { response: answer({ advisoryQuality: { ...answer().advisoryQuality!, invalidReferences: true } }) }],
        ['the safety guard changed it', { response: answer({ safety: { ...answer().safety!, safe: false, violations: ['Pesticide rate held for review'] } }) }],
        ['it raised a quarantine alert', { response: answer({ safety: { ...answer().safety!, quarantineAlert: true } }) }],
        ['it is too short to be a real answer', { response: answer({ answer: 'Scout weekly [1].' }) }],
        ['no source was retrieved', { response: answer({ contextUsed: [] }) }],
    ])('does not share it when %s', (_reason, overrides) => {
        expect(sharedAnswerDays(candidate(overrides as Partial<SharedAnswerCandidate>))).toBeNull();
    });
});

describe('saving and finding shared answers', () => {
    const REVISION = { articleIds: [ARTICLE, OTHER_ARTICLE], fingerprint: 'fingerprint-at-retrieval' };

    beforeEach(() => jest.clearAllMocks());

    it('fingerprints the knowledge-base sources when they are retrieved', async () => {
        mockQuery.mockResolvedValueOnce(result([{ fingerprint: 'f1' }]));

        const revision = await knowledgeSourcesRevision([source(ARTICLE), source('web-0-1'), source(ARTICLE)]);

        expect(revision).toEqual({ articleIds: [ARTICLE], fingerprint: 'f1' });
        expect(mockQuery).toHaveBeenCalledWith('SELECT knowledge_sources_fingerprint($1::uuid[]) AS fingerprint', [[ARTICLE]]);
    });

    it('gives no revision (so nothing is shared) when the fingerprint cannot be read', async () => {
        mockQuery.mockRejectedValueOnce(new Error('database down'));
        await expect(knowledgeSourcesRevision([source(ARTICLE)])).resolves.toBeNull();
    });

    it('stores the answer without its audio, with its knowledge-base sources, then clears expired answers', async () => {
        mockQuery.mockResolvedValue(result([], 1));
        const response = answer({ contextUsed: [source(ARTICLE), source(ARTICLE), source(OTHER_ARTICLE), source('web-1-9')] });

        await saveSharedAnswer('key-1', response, KNOWLEDGE_BASE_DAYS, REVISION);

        const [sql, params] = mockQuery.mock.calls[0]!;
        expect(sql).toContain('knowledge_sources_fingerprint($3::uuid[])');
        expect(params![0]).toBe('key-1');
        const stored = JSON.parse(params![1] as string);
        expect(stored.answer).toBe(ANSWER);
        expect(stored).not.toHaveProperty('audio');
        expect(stored).not.toHaveProperty('cached');
        expect(params![2]).toEqual([ARTICLE, OTHER_ARTICLE]);
        expect(params![3]).toBe(KNOWLEDGE_BASE_DAYS);
        expect(mockQuery.mock.calls[1]![0]).toContain('DELETE FROM shared_answer_cache WHERE expires_at <= NOW()');
    });

    it('writes only while the sources still match how they were retrieved', async () => {
        mockQuery.mockResolvedValue(result([], 0));

        await saveSharedAnswer('key-1', answer(), KNOWLEDGE_BASE_DAYS, REVISION);

        const [sql, params] = mockQuery.mock.calls[0]!;
        expect(sql).toContain('WHERE knowledge_sources_fingerprint($5::uuid[]) = $6');
        expect(params!.slice(4)).toEqual([REVISION.articleIds, REVISION.fingerprint]);
        expect(logger.info).toHaveBeenCalledWith('Not saving the answer for reuse: a source article changed while it was being written.');
    });

    it('never fails the answer when the cache cannot be written', async () => {
        mockQuery.mockRejectedValueOnce(new Error('database down'));
        await expect(saveSharedAnswer('key-1', answer(), 30, REVISION)).resolves.toBeUndefined();
        expect(logger.warn).toHaveBeenCalled();
    });

    it('returns a stored answer whose sources are unchanged, marked as cached, and counts the reuse', async () => {
        mockQuery
            .mockResolvedValueOnce(result([{ answer: storedForm(), sources_unchanged: true }]))
            .mockResolvedValueOnce(result([], 1));

        const hit = await findSharedAnswer('key-1');

        expect(hit?.answer).toBe(ANSWER);
        expect(hit?.cached).toBe(true);
        expect(mockQuery.mock.calls[1]![0]).toContain('hit_count = hit_count + 1');
    });

    it('drops an answer whose knowledge-base sources were edited, re-tagged or deleted', async () => {
        mockQuery
            .mockResolvedValueOnce(result([{ answer: storedForm(), sources_unchanged: false }]))
            .mockResolvedValueOnce(result([], 1));

        await expect(findSharedAnswer('key-1')).resolves.toBeNull();
        expect(mockQuery.mock.calls[1]).toEqual(['DELETE FROM shared_answer_cache WHERE scope_key = $1', ['key-1']]);
    });

    it('finds nothing when there is no stored answer or the database fails', async () => {
        mockQuery.mockResolvedValueOnce(result([]));
        await expect(findSharedAnswer('key-1')).resolves.toBeNull();
        mockQuery.mockRejectedValueOnce(new Error('database down'));
        await expect(findSharedAnswer('key-1')).resolves.toBeNull();
    });
});
