import { runAskQuestion } from '@/services/knowledge/askPipeline';
import { checkExactCachesOnly } from '@/services/knowledge/cacheLookup';
import { callReasoningAgentic } from '@/services/knowledge/reasoning';
import { logSearch } from '@/services/knowledge/searchLog';
import { VectorService } from '@/services/vectorService';
import { findSharedAnswer, knowledgeSourcesRevision, saveSharedAnswer, KNOWLEDGE_BASE_DAYS } from '@/services/knowledge/sharedAnswerCache';
import type { SearchResult } from '@/services/vectorService';
import type { ReasoningResult } from '@/services/aiProvider/aiProvider';
import type { FinalAnswer } from '@/services/knowledge/types';

const ARTICLE = '3f1c2b4a-8d6e-4f7a-9b0c-1d2e3f4a5b6c';
const ANSWER = 'Scout 20 plants in a W pattern each week and record the share with fresh window-pane damage and live larvae [1]. '
    + 'Hand-pick egg masses where practical and keep field margins free of grassy weeds [1]. Ask your local extension office to confirm the action threshold for your maize growth stage.';

jest.mock('@/services/cacheService', () => ({ cacheSet: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/services/knowledge/cacheLookup', () => ({ checkExactCachesOnly: jest.fn().mockResolvedValue(null) }));
jest.mock('@/services/knowledge/sharedAnswerCache', () => ({
    ...jest.requireActual('@/services/knowledge/sharedAnswerCache'),
    findSharedAnswer: jest.fn().mockResolvedValue(null),
    saveSharedAnswer: jest.fn().mockResolvedValue(undefined),
    knowledgeSourcesRevision: jest.fn(),
}));
jest.mock('@/services/knowledge/userContext', () => ({
    resolveUserContext: jest.fn(async () => ({ crop: 'maize', country: 'Kenya', region: 'Nakuru' })),
}));
jest.mock('@/services/knowledge/reasoning', () => ({
    callReasoningAgentic: jest.fn(),
    callReasoningWithTimeout: jest.fn(),
}));
jest.mock('@/services/aiProvider/aiProvider', () => ({
    AIRouter: { routeRequest: jest.fn().mockResolvedValue({ labels: [{ label: 'pest_and_disease', score: 0.9 }] }) },
}));
jest.mock('@/services/vectorService', () => ({ VectorService: { hybridSearch: jest.fn() } }));
jest.mock('@/services/knowledge/webEnrichment', () => ({
    enrichContextWithWebFallbacks: jest.fn(async (_query: string, _categories: string[], _isAgri: boolean, sources: SearchResult[]) => sources),
}));
jest.mock('@/services/knowledge/liveAgriContext', () => ({ fetchLiveAgriContext: jest.fn().mockResolvedValue([]) }));
jest.mock('@/services/knowledge/visuals', () => ({
    postProcessResponse: jest.fn(async (result: ReasoningResult) => ({ visuals: result.visuals, audio: 'spoken-answer' })),
}));
jest.mock('@/services/knowledge/searchLog', () => ({ logSearch: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const QUESTION = 'How do I control fall armyworm in maize?';
const REVISION = { articleIds: [ARTICLE], fingerprint: 'as-retrieved' };

describe('answers shared between users', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(VectorService.hybridSearch).mockResolvedValue([{
            id: ARTICLE,
            content: 'Scout maize weekly for fall armyworm; record fresh damage and live larvae before deciding on control.',
            metadata: { retrieval: { vectorSimilarity: 0.8 }, title: 'Fall armyworm scouting guide', country: 'Kenya' },
            score: 0.9,
        }]);
        jest.mocked(callReasoningAgentic).mockResolvedValue({ answer: ANSWER, reasoning: 'From the scouting guide.' });
        jest.mocked(knowledgeSourcesRevision).mockResolvedValue(REVISION);
    });

    it('keeps an answer written from knowledge-base sources for 30 days, under a key without the user', async () => {
        await runAskQuestion('user-1', QUESTION, undefined, { language: 'en' });
        await runAskQuestion('user-2', QUESTION, undefined, { language: 'en' });

        expect(saveSharedAnswer).toHaveBeenCalledTimes(2);
        const [firstKey, response, days, revision] = jest.mocked(saveSharedAnswer).mock.calls[0]!;
        expect(jest.mocked(saveSharedAnswer).mock.calls[1]![0]).toBe(firstKey);
        expect(days).toBe(KNOWLEDGE_BASE_DAYS);
        expect(revision).toBe(REVISION);
        expect(jest.mocked(knowledgeSourcesRevision).mock.calls[0]![0].map(item => item.id)).toEqual([ARTICLE]);
        expect(response.answer).toContain('Scout 20 plants');
        expect(jest.mocked(findSharedAnswer).mock.calls[0]![0]).toBe(firstKey);
    });

    it('answers from the shared cache without searching or calling the AI, and records the question once', async () => {
        const stored: FinalAnswer = {
            answer: ANSWER, reasoning: 'From the scouting guide.', answerMode: 'generated',
            contextUsed: [{ id: ARTICLE, content: 'Guide', metadata: { title: 'Guide' }, score: 0.9 }], cached: true,
        };
        jest.mocked(findSharedAnswer).mockResolvedValueOnce(stored);

        const result = await runAskQuestion('user-2', QUESTION, undefined, { language: 'en' });

        expect(result).toBe(stored);
        expect(VectorService.hybridSearch).not.toHaveBeenCalled();
        expect(callReasoningAgentic).not.toHaveBeenCalled();
        expect(logSearch).toHaveBeenCalledTimes(1);
    });

    it("prefers the user's own cached answer over a shared one", async () => {
        jest.mocked(checkExactCachesOnly).mockResolvedValueOnce({ answer: ANSWER, reasoning: '', contextUsed: [], cached: true });

        await runAskQuestion('user-1', QUESTION);

        expect(findSharedAnswer).not.toHaveBeenCalled();
    });

    it('skips the shared cache when a new answer is asked for, but keeps the new answer', async () => {
        await runAskQuestion('user-1', QUESTION, undefined, { bypassCache: true, language: 'en' });

        expect(findSharedAnswer).not.toHaveBeenCalled();
        expect(callReasoningAgentic).toHaveBeenCalledTimes(1);
        expect(saveSharedAnswer).toHaveBeenCalledTimes(1);
    });

    it('does not share an answer written from tool output such as a weather forecast', async () => {
        jest.mocked(callReasoningAgentic).mockResolvedValueOnce({ answer: ANSWER, reasoning: '', toolsUsed: ['get_weather_forecast'] });

        const result = await runAskQuestion('user-1', QUESTION, undefined, { language: 'en' });

        expect(saveSharedAnswer).not.toHaveBeenCalled();
        expect(result.toolsUsed).toBeUndefined();
    });

    it('does not share the answer when its sources could not be fingerprinted when retrieved', async () => {
        jest.mocked(knowledgeSourcesRevision).mockResolvedValueOnce(null);

        await runAskQuestion('user-1', QUESTION, undefined, { language: 'en' });

        expect(saveSharedAnswer).not.toHaveBeenCalled();
    });

    it('does not fingerprint sources for questions that are never shared', async () => {
        await runAskQuestion('user-1', QUESTION, [{ type: 'image', data: 'photo' }]);

        expect(knowledgeSourcesRevision).not.toHaveBeenCalled();
        expect(saveSharedAnswer).not.toHaveBeenCalled();
    });

    it('never shares an answer when the asker did not say which language they read', async () => {
        await runAskQuestion('user-1', QUESTION);

        expect(knowledgeSourcesRevision).not.toHaveBeenCalled();
        expect(saveSharedAnswer).not.toHaveBeenCalled();
    });

    it('uses a different shared answer for another country or language', async () => {
        await runAskQuestion('user-1', QUESTION, undefined, { language: 'en' });
        await runAskQuestion('user-1', QUESTION, undefined, { language: 'sw' });
        await runAskQuestion('user-1', QUESTION, undefined, { language: 'en', country: 'Ghana' });

        const keys = jest.mocked(findSharedAnswer).mock.calls.map(call => call[0]);
        expect(new Set(keys).size).toBe(3);
    });
});
