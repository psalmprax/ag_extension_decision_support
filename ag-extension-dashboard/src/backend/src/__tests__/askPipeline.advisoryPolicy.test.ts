import { runAskQuestion } from '@/services/knowledge/askPipeline';
import { checkExactCachesOnly } from '@/services/knowledge/cacheLookup';
import { resolveUserContext } from '@/services/knowledge/userContext';
import { callReasoningAgentic } from '@/services/knowledge/reasoning';
import { logSearch } from '@/services/knowledge/searchLog';
import type { SearchResult } from '@/services/vectorService';
import type { ReasoningResult } from '@/services/aiProvider/aiProvider';

jest.mock('@/services/cacheService', () => ({ cacheSet: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/services/knowledge/cacheLookup', () => ({ checkExactCachesOnly: jest.fn().mockResolvedValue(null) }));
jest.mock('@/services/knowledge/userContext', () => ({
    resolveUserContext: jest.fn(async () => ({ crop: 'maize', country: 'Kenya', region: 'Nakuru' })),
}));
jest.mock('@/services/knowledge/reasoning', () => ({
    callReasoningAgentic: jest.fn().mockResolvedValue({
        answer: 'Apply neem oil at 3 ml/L.', reasoning: 'Use 3 ml/L of neem oil.',
        confidence: 0.99, visuals: { kpis: [{ label: 'Dose', value: '3 ml/L', status: 'good' }] },
    }),
    callReasoningWithTimeout: jest.fn(),
}));
jest.mock('@/services/aiProvider/aiProvider', () => ({
    AIRouter: { routeRequest: jest.fn().mockResolvedValue({ labels: [{ label: 'pest_and_disease', score: 0.9 }] }) },
}));
jest.mock('@/services/vectorService', () => ({
    VectorService: { hybridSearch: jest.fn().mockResolvedValue([
        { id: 'source-1', content: 'Scout before selecting a treatment.', metadata: { title: 'Extension guidance' }, score: 0.9 },
    ]) },
}));
jest.mock('@/services/knowledge/webEnrichment', () => ({
    enrichContextWithWebFallbacks: jest.fn(async (_query: string, _categories: string[], _isAgri: boolean, sources: SearchResult[]) => sources),
}));
jest.mock('@/services/knowledge/liveAgriContext', () => ({
    fetchLiveAgriContext: jest.fn().mockResolvedValue([]),
}));
jest.mock('@/services/knowledge/visuals', () => ({
    postProcessResponse: jest.fn(async (result: ReasoningResult) => ({ visuals: result.visuals })),
}));
jest.mock('@/services/knowledge/searchLog', () => ({
    logSearch: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

describe('Knowledge advisory policy integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.KNOWLEDGE_AGENTIC_LOOP = 'true';
    });

    it('guards answer, reasoning and visuals before logging or returning them', async () => {
        const result = await runAskQuestion('user-1', 'How do I treat maize damage?');
        expect(result.answer).toContain('cannot verify');
        expect(result.reasoning).not.toContain('3 ml/L');
        expect(result.confidence).toBeUndefined();
        expect(result.visuals).toBeUndefined();
        expect(result.safety?.safe).toBe(false);
        expect(result.advisoryQuality?.regulatoryAuthorization).toBe('not_established');
        expect(logSearch).toHaveBeenCalledWith(
            'user-1', expect.any(String), expect.any(String), undefined,
            result.answer, result.reasoning, undefined
        );
    });

    it('never shares exact answer cache keys across users or countries', async () => {
        await runAskQuestion('user-1', 'How do I treat maize damage?');
        await runAskQuestion('user-2', 'How do I treat maize damage?');
        await runAskQuestion('user-1', 'How do I treat maize damage?', undefined, { country: 'India' });
        const keys = jest.mocked(checkExactCachesOnly).mock.calls.map(call => call[1]);
        expect(new Set(keys).size).toBe(3);
        expect(keys.every(key => key.startsWith('rag:advisory-v3:'))).toBe(true);
        expect(jest.mocked(checkExactCachesOnly).mock.calls.every(call => call[2] === true)).toBe(true);
    });

    it('passes explicit country and language to the reasoning policy', async () => {
        await runAskQuestion('user-1', 'Maize advice in India', undefined, {
            language: 'hi', preferredProvider: 'aihubmix', allowTools: false,
        });
        expect(resolveUserContext).toHaveBeenCalledWith('user-1', expect.any(String));
        expect(callReasoningAgentic).toHaveBeenCalledWith(
            expect.any(String), expect.any(String), undefined,
            expect.objectContaining({ country: 'India', language: 'hi', allowTools: false }),
            expect.any(Array)
        );
    });
});
