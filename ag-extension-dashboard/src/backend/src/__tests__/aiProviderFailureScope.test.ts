jest.mock('@/utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/services/agentTelemetry', () => ({ agentTelemetry: { record: jest.fn() } }));
jest.mock('@/services/omniRouteService', () => ({
    OmniRouteService: { executeWithFailover: jest.fn().mockRejectedValue(new Error('no free tier in tests')) },
}));

import { AIProviderFactory, AIRouter } from '@/services/aiProvider/aiProvider';
import type { AICapability } from '@/services/aiProvider/types';

/**
 * The retrieval evaluation found a failing chat model (a retired model id)
 * marking the whole provider unhealthy, which then refused that provider's
 * embeddings and emptied retrieval. Failures are now scoped per kind of model.
 */
describe('AI provider failure scope', () => {
    it('keeps embeddings available after the same provider\'s chat model fails', async () => {
        const provider = {
            capabilities: ['text', 'embeddings'],
            isConfigured: () => true,
            healthCheck: jest.fn().mockResolvedValue(true),
            generateText: jest.fn().mockRejectedValue(Object.assign(new Error('model retired'), { response: { status: 404 } })),
            createEmbedding: jest.fn().mockResolvedValue([0.1, 0.2]),
        } as unknown as AICapability;
        const unconfigured = { capabilities: [], isConfigured: () => false } as unknown as AICapability;
        const getProvider = jest.spyOn(AIProviderFactory, 'getProvider')
            .mockImplementation(async type => (type === 'aihubmix' ? provider : unconfigured));

        await expect(AIRouter.routeRequest('generate', { prompt: 'ping', options: { preferredProvider: 'aihubmix' } })).rejects.toThrow();
        const embedding = await AIRouter.routeRequest('embed', { text: 'maize', options: { preferredProvider: 'aihubmix' } });
        expect(Array.from(embedding as number[])).toEqual([0.1, 0.2]);
        // The chat failure still keeps chat away from this provider for a while.
        await expect(AIRouter.routeRequest('generate', { prompt: 'ping', options: { preferredProvider: 'aihubmix' } })).rejects.toThrow();
        expect(jest.mocked(provider.generateText)).toHaveBeenCalledTimes(1);
        getProvider.mockRestore();
    });
});
