/**
 * Azure OpenAI provider: request routing and embedding dimensions.
 * Regression guard: a client-level `deployment` pinned every request (including
 * embeddings) to the chat deployment, and text-embedding-3 vectors came back at
 * their native size instead of the vector(768) column width.
 */
const mockCtor = jest.fn();
const mockEmbeddingsCreate = jest.fn();

jest.mock('openai', () => ({
    AzureOpenAI: jest.fn().mockImplementation((opts: unknown) => {
        mockCtor(opts);
        return { embeddings: { create: mockEmbeddingsCreate }, chat: { completions: { create: jest.fn() } } };
    }),
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const azureConfig = {
    apiKey: 'test-key', endpoint: 'https://example.openai.azure.com', deploymentName: 'gpt-chat',
    apiVersion: '2024-10-21', embeddingDeployment: 'embed-deploy',
};
jest.mock('../config', () => ({ config: { azureOpenAI: azureConfig } }));
jest.mock('@/config', () => ({ config: { azureOpenAI: azureConfig } }));

import { AzureOpenAIProvider } from '../services/aiProvider/providers/azureOpenAI';
import { EMBEDDING_DIMENSIONS } from '../services/embeddingDimensions';

describe('AzureOpenAIProvider', () => {
    beforeEach(() => {
        mockCtor.mockClear();
        mockEmbeddingsCreate.mockReset().mockResolvedValue({
            data: [{ embedding: new Array(EMBEDDING_DIMENSIONS).fill(0) }],
            usage: { total_tokens: 3 },
        });
    });

    it('does not pin the client to the chat deployment', async () => {
        await new AzureOpenAIProvider().createEmbedding('x');
        const opts = mockCtor.mock.calls[0][0] as Record<string, unknown>;
        expect(opts).not.toHaveProperty('deployment');
        expect(opts).toMatchObject({ endpoint: azureConfig.endpoint, apiVersion: azureConfig.apiVersion });
    });

    it('routes embeddings to the embedding deployment with pinned dimensions', async () => {
        await new AzureOpenAIProvider().createEmbedding('maize lethal necrosis');
        expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
            model: 'embed-deploy', input: 'maize lethal necrosis', dimensions: EMBEDDING_DIMENSIONS,
        });
    });

    it('pins dimensions for batch embeddings too', async () => {
        mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: [1] }, { embedding: [2] }], usage: { total_tokens: 2 } });
        await new AzureOpenAIProvider().createBatchEmbeddings(['a', 'b']);
        expect(mockEmbeddingsCreate).toHaveBeenCalledWith(expect.objectContaining({
            model: 'embed-deploy', dimensions: EMBEDDING_DIMENSIONS,
        }));
    });
});
