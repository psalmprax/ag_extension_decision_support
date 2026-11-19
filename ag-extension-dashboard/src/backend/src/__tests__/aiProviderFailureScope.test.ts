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
});
