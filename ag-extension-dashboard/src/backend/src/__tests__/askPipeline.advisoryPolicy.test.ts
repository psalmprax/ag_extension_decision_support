import { runAskQuestion } from '@/services/knowledge/askPipeline';
import { checkExactCachesOnly } from '@/services/knowledge/cacheLookup';
import { resolveUserContext } from '@/services/knowledge/userContext';
import { callReasoningAgentic } from '@/services/knowledge/reasoning';
import { logSearch } from '@/services/knowledge/searchLog';
import { VectorService } from '@/services/vectorService';
import { enrichContextWithWebFallbacks } from '@/services/knowledge/webEnrichment';
import { cacheSet } from '@/services/cacheService';
import { logger } from '@/utils/logger';
import type { SearchResult } from '@/services/vectorService';
import type { ReasoningResult } from '@/services/aiProvider/aiProvider';

const HISTORY_WRITE_TIMEOUT_MS = 2000;

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
        expect(logSearch).toHaveBeenCalledTimes(1);
    });

    it('never shares exact answer cache keys across users or countries', async () => {
        await runAskQuestion('user-1', 'How do I treat maize damage?');
        await runAskQuestion('user-2', 'How do I treat maize damage?');
        await runAskQuestion('user-1', 'How do I treat maize damage?', undefined, { country: 'India' });
        const keys = jest.mocked(checkExactCachesOnly).mock.calls.map(call => call[1]);
        expect(new Set(keys).size).toBe(3);
        expect(keys.every(key => key.startsWith('rag:advisory-v4:'))).toBe(true);
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

    it('continues with explicit location when profile lookup fails', async () => {
        jest.mocked(resolveUserContext).mockRejectedValueOnce(new Error('Database unavailable'));

        await runAskQuestion('user-1', 'Maize advice', undefined, { country: 'India', language: 'hi' });

        expect(logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('without profile location'), expect.any(Error)
        );
        expect(callReasoningAgentic).toHaveBeenCalledWith(
            expect.any(String), expect.any(String), undefined,
            expect.objectContaining({ country: 'India', language: 'hi' }), expect.any(Array)
        );
    });

    it('bounds a stalled profile lookup and proceeds without inventing a location', async () => {
        jest.useFakeTimers();
        try {
            jest.mocked(resolveUserContext).mockReturnValueOnce(new Promise(() => {}));
            const pending = runAskQuestion('user-1', 'Maize advice');
            await jest.advanceTimersByTimeAsync(5000);
            await pending;

            expect(logger.warn).toHaveBeenCalledWith(
                expect.stringContaining('without profile location'), expect.any(Error)
            );
            expect(callReasoningAgentic).toHaveBeenCalledWith(
                expect.any(String), expect.any(String), undefined,
                expect.objectContaining({ country: undefined, region: undefined }), expect.any(Array)
            );
        } finally {
            jest.useRealTimers();
        }
    });

    it('returns explicitly labelled source excerpts when synthesis fails', async () => {
        jest.mocked(callReasoningAgentic).mockRejectedValueOnce(new Error('Provider unavailable'));
        const result = await runAskQuestion('user-1', 'Maize advice');

        expect(result.answerMode).toBe('extractive');
        expect(result.contextUsed.map(source => source.id)).toEqual(['source-1']);
        expect(cacheSet).not.toHaveBeenCalled();
        expect(logSearch).toHaveBeenCalledTimes(1);
    });

    it('falls back to source excerpts when the provider returns only whitespace', async () => {
        jest.mocked(callReasoningAgentic).mockResolvedValueOnce({ answer: '   ', reasoning: '' });
        const result = await runAskQuestion('user-1', 'Maize advice');

        expect(result.answerMode).toBe('extractive');
        expect(result.answer.trim()).not.toBe('');
        expect(logger.error).toHaveBeenCalledWith('RAG analysis failed:', expect.any(Error));
    });

    it('reports unavailability when retrieval, enrichment and synthesis all fail', async () => {
        jest.mocked(VectorService.hybridSearch).mockRejectedValueOnce(new Error('Retrieval unavailable'));
        jest.mocked(enrichContextWithWebFallbacks).mockRejectedValueOnce(new Error('Web unavailable'));
        jest.mocked(callReasoningAgentic).mockRejectedValueOnce(new Error('Provider unavailable'));
        const result = await runAskQuestion('user-1', 'Maize advice');

        expect(result.answerMode).toBe('unavailable');
        expect(result.contextUsed).toEqual([]);
        expect(result.advisoryQuality?.sourceCount).toBe(0);
        expect(cacheSet).not.toHaveBeenCalled();
        expect(logSearch).not.toHaveBeenCalled();
    });

    it('does not use quarantined or foreign-country sources for fallback', async () => {
        jest.mocked(VectorService.hybridSearch).mockResolvedValueOnce([
            {
                id: 'quarantined', content: 'Unreviewed source content.',
                metadata: { quarantine: true }, score: 0.99,
            },
            {
                id: 'foreign', content: 'Foreign-country source content.',
                metadata: { country: 'India' }, score: 0.99,
            },
        ]);
        jest.mocked(callReasoningAgentic).mockRejectedValueOnce(new Error('Provider unavailable'));
        const result = await runAskQuestion('user-1', 'Maize advice in Kenya');

        expect(result.answerMode).toBe('unavailable');
        expect(result.contextUsed).toEqual([]);
        expect(result.answer).not.toContain('source content');
        expect(logSearch).not.toHaveBeenCalled();
    });

    it('records a cached answer once for history and daily quota accounting', async () => {
        jest.mocked(checkExactCachesOnly).mockResolvedValueOnce({
            answer: 'Cached guidance.', reasoning: '', contextUsed: [], cached: true, answerMode: 'generated',
        });

        const result = await runAskQuestion('user-1', 'Maize advice');

        expect(result.cached).toBe(true);
        expect(callReasoningAgentic).not.toHaveBeenCalled();
        expect(logSearch).toHaveBeenCalledTimes(1);
        expect(logSearch).toHaveBeenCalledWith(
            'user-1', 'Maize advice', undefined, undefined, 'Cached guidance.', '', undefined
        );
    });

    it.each(['generated', 'cached', 'extractive'] as const)(
        'returns the %s answer when history persistence stalls',
        async path => {
            jest.useFakeTimers();
            try {
                if (path === 'cached') {
                    jest.mocked(checkExactCachesOnly).mockResolvedValueOnce({
                        answer: 'Cached guidance.', reasoning: '', contextUsed: [], cached: true, answerMode: 'generated',
                    });
                } else if (path === 'extractive') {
                    jest.mocked(callReasoningAgentic).mockRejectedValueOnce(new Error('Provider unavailable'));
                } else {
                    jest.mocked(resolveUserContext).mockReturnValueOnce(new Promise(() => {}));
                }
                let rejectWrite: (error: Error) => void = () => { throw new Error('Write not started'); };
                jest.mocked(logSearch).mockReturnValueOnce(new Promise((_resolve, reject) => {
                    rejectWrite = reject;
                }));

                let settled = false;
                const pending = runAskQuestion('user-1', 'Maize advice').then(result => {
                    settled = true;
                    return result;
                });
                await jest.advanceTimersByTimeAsync(path === 'generated' ? 5000 : 0);
                expect(settled).toBe(true);
                expect(logSearch).toHaveBeenCalledTimes(1);
                const result = await pending;
                await jest.advanceTimersByTimeAsync(HISTORY_WRITE_TIMEOUT_MS - 1);
                expect(logger.warn).not.toHaveBeenCalledWith(
                    expect.stringContaining('history persistence timed out'), expect.any(Error)
                );
                await jest.advanceTimersByTimeAsync(1);

                expect(result.answerMode).toBe(path === 'extractive' ? 'extractive' : 'generated');
                expect(result.cached).toBe(path === 'cached');
                expect(logger.warn).toHaveBeenCalledWith(
                    expect.stringContaining('history persistence timed out'), expect.any(Error)
                );
                rejectWrite(new Error('Late database failure'));
                await Promise.resolve();
                expect(logger.error).toHaveBeenCalledWith(
                    'Knowledge history persistence failed:', expect.any(Error)
                );
            } finally {
                jest.useRealTimers();
            }
        }
    );

    it('returns the answer and reports a history persistence failure', async () => {
        jest.mocked(logSearch).mockRejectedValueOnce(new Error('Database failure'));

        const result = await runAskQuestion('user-1', 'Maize advice');

        expect(result.answerMode).toBe('generated');
        expect(logger.error).toHaveBeenCalledWith('Knowledge history persistence failed:', expect.any(Error));
    });
});
