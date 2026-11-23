jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/services/agentTelemetry', () => ({ agentTelemetry: { record: jest.fn() } }));
jest.mock('@/services/omniRouteService', () => ({
    OmniRouteService: { executeWithFailover: jest.fn().mockRejectedValue(new Error('no free tier in tests')) },
}));

import { AIProviderFactory, AIRouter } from '@/services/aiProvider/aiProvider';
import type { AICapability, AIProviderType } from '@/services/aiProvider/types';

function unsupported(operation: string) {
    return jest.fn(async () => { throw new Error(`${operation} is not supported by this fixture`); });
}

/** A complete AICapability: every operation the test does not exercise rejects. */
function fakeProvider(provider: AIProviderType, configured: boolean, overrides: Partial<AICapability> = {}): AICapability {
    return {
        provider,
        capabilities: configured ? ['text', 'embeddings'] : [],
        isConfigured: () => configured,
        healthCheck: jest.fn(async () => configured),
        generateText: unsupported('generateText'),
        // eslint-disable-next-line require-yield
        streamText: async function* () { throw new Error('streamText is not supported by this fixture'); },
        createEmbedding: unsupported('createEmbedding'),
        createBatchEmbeddings: unsupported('createBatchEmbeddings'),
        speechToText: unsupported('speechToText'),
        textToSpeech: unsupported('textToSpeech'),
        analyzeWithReasoning: unsupported('analyzeWithReasoning'),
        classify: unsupported('classify'),
        analyzeImage: unsupported('analyzeImage'),
        analyzeVideo: unsupported('analyzeVideo'),
        ...overrides,
    };
}

/**
 * The retrieval evaluation found a failing chat model (a retired model id)
 * marking the whole provider unhealthy, which then refused that provider's
 * embeddings and emptied retrieval. Failures are now scoped per kind of model.
 */
describe('AI provider failure scope', () => {
    it('keeps embeddings available after the same provider\'s chat model fails', async () => {
        const generateText = jest.fn<ReturnType<AICapability['generateText']>, Parameters<AICapability['generateText']>>()
            .mockRejectedValue(Object.assign(new Error('model retired'), { response: { status: 404 } }));
        const createEmbedding = jest.fn<ReturnType<AICapability['createEmbedding']>, Parameters<AICapability['createEmbedding']>>()
            .mockResolvedValue({ embedding: [0.1, 0.2], model: 'test-embedding' });
        const provider = fakeProvider('aihubmix', true, { generateText, createEmbedding });
        const getProvider = jest.spyOn(AIProviderFactory, 'getProvider')
            .mockImplementation(async type => (type === 'aihubmix' ? provider : fakeProvider(type ?? 'openai', false)));

        await expect(AIRouter.routeRequest('generate', { prompt: 'ping', options: { preferredProvider: 'aihubmix' } })).rejects.toThrow();
        const embedding = await AIRouter.routeRequest('embed', { text: 'maize', options: { preferredProvider: 'aihubmix' } });
        expect(embedding).toMatchObject({ embedding: [0.1, 0.2] });
        // The chat failure still keeps chat away from this provider for a while.
        await expect(AIRouter.routeRequest('generate', { prompt: 'ping', options: { preferredProvider: 'aihubmix' } })).rejects.toThrow();
        expect(generateText).toHaveBeenCalledTimes(1);
        getProvider.mockRestore();
    });

    it('does not return an empty OmniRoute fallback as a successful answer', async () => {
        const getProvider = jest.spyOn(AIProviderFactory, 'getProvider')
          .mockImplementation(async type => fakeProvider(type ?? 'openai', false));
        const { OmniRouteService } = await import('@/services/omniRouteService');
        const executeWithFailover = jest.spyOn(OmniRouteService, 'executeWithFailover')
          .mockResolvedValue({ text: '  ', providerUsed: 'groq', modelUsed: 'empty-model', isFreeModel: true });

        await expect(AIRouter.routeRequest('generate', { prompt: 'Question' })).rejects.toThrow('All AI providers failed');

        executeWithFailover.mockRestore();
        getProvider.mockRestore();
    });

    it('moves to the next provider when one answers with nothing', async () => {
        const blank = jest.fn<ReturnType<AICapability['generateText']>, Parameters<AICapability['generateText']>>()
            .mockResolvedValue({ text: '  ', model: 'reasoning-model', finishReason: 'length' });
        const answer = jest.fn<ReturnType<AICapability['generateText']>, Parameters<AICapability['generateText']>>()
            .mockResolvedValue({ text: 'Top-dress at knee height.', model: 'llama3.2:3b' });
        const getProvider = jest.spyOn(AIProviderFactory, 'getProvider').mockImplementation(async type => {
            if (type === 'nvidia') return fakeProvider('nvidia', true, { generateText: blank });
            if (type === 'ollama') return fakeProvider('ollama', true, { generateText: answer });
            return fakeProvider(type ?? 'openai', false);
        });

        const result = await AIRouter.routeRequest('generate', { prompt: 'When to top-dress maize?', options: { preferredProvider: 'nvidia' } });

        expect(result).toMatchObject({ text: 'Top-dress at knee height.' });
        expect(blank).toHaveBeenCalledTimes(1);
        getProvider.mockRestore();
    });
});

describe('empty transcripts', () => {
    it('returns an empty transcript as it is, without trying other providers', async () => {
        const speechToText = jest.fn<ReturnType<AICapability['speechToText']>, Parameters<AICapability['speechToText']>>()
            .mockResolvedValue({ text: '', language: 'en' });
        const getProvider = jest.spyOn(AIProviderFactory, 'getProvider')
            .mockImplementation(async type => (type === 'openai' ? fakeProvider('openai', true, { speechToText }) : fakeProvider(type ?? 'aihubmix', false)));

        const result = await AIRouter.routeRequest('speech', { audio: Buffer.from('silence'), options: { preferredProvider: 'openai' } });

        expect(result).toMatchObject({ text: '' });
        expect(speechToText).toHaveBeenCalledTimes(1);
        getProvider.mockRestore();
    });
});

describe('isEmptyAnswer', () => {
    it('counts blank or null text without tool calls, and a blank reasoning answer, as empty', async () => {
        const { isEmptyAnswer } = await import('@/services/aiProvider/aiProvider');
        expect(isEmptyAnswer({ text: '' })).toBe(true);
        expect(isEmptyAnswer({ text: null })).toBe(true);
        expect(isEmptyAnswer({})).toBe(false);
        expect(isEmptyAnswer({ text: '', toolCalls: [{ name: 'weather' }] })).toBe(false);
        expect(isEmptyAnswer({ text: null, toolCalls: [{ name: 'weather' }] })).toBe(false);
        expect(isEmptyAnswer({ reasoning: 'thinking', answer: ' ' })).toBe(true);
        expect(isEmptyAnswer({ reasoning: 'thinking', answer: '', toolCalls: [{ name: 'weather' }] })).toBe(false);
        expect(isEmptyAnswer({ embedding: [0.1] })).toBe(false);
        expect(isEmptyAnswer(null)).toBe(false);
    });
});
