/**
 * Azure OpenAI provider: request routing and embedding dimensions.
 * Regression guard: a client-level `deployment` pinned every request (including
 * embeddings) to the chat deployment, and text-embedding-3 vectors came back at
 * their native size instead of the vector(768) column width.
 */
const mockCtor = jest.fn();
const mockEmbeddingsCreate = jest.fn();
const mockChatCreate = jest.fn();

jest.mock('openai', () => ({
    AzureOpenAI: jest.fn().mockImplementation((opts: unknown) => {
        mockCtor(opts);
        return { embeddings: { create: mockEmbeddingsCreate }, chat: { completions: { create: mockChatCreate } } };
    }),
}));

jest.mock('../utils/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const azureConfig = {
    apiKey: 'test-key', endpoint: 'https://example.openai.azure.com', deploymentName: 'gpt-chat',
    apiVersion: '2024-10-21', embeddingDeployment: 'embed-deploy',
};
const aiConfig = { primary: { model: 'primary-model' } };
jest.mock('../config', () => ({ config: { azureOpenAI: azureConfig, ai: aiConfig } }));
jest.mock('@/config', () => ({ config: { azureOpenAI: azureConfig, ai: aiConfig } }));

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

describe('AzureOpenAIProvider chat', () => {
    beforeEach(() => mockChatCreate.mockReset());

    it('sends chat to the chat deployment and maps usage and finish reason', async () => {
        mockChatCreate.mockResolvedValue({
            choices: [{ message: { content: 'Scout 20 plants per field.' }, finish_reason: 'stop' }],
            usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
        });
        const result = await new AzureOpenAIProvider().generateText('How do I scout for fall armyworm?');
        expect(mockChatCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'gpt-chat' }));
        expect(result).toMatchObject({
            text: 'Scout 20 plants per field.',
            finishReason: 'stop',
            usage: { promptTokens: 12, completionTokens: 7, totalTokens: 19 },
        });
    });

    it('leaves usage undefined when the API omits it, and zero-fills missing counts', async () => {
        mockChatCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] });
        expect((await new AzureOpenAIProvider().generateText('q')).usage).toBeUndefined();

        mockChatCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'ok' }, finish_reason: 'length' }], usage: { total_tokens: 4 } });
        expect((await new AzureOpenAIProvider().generateText('q')).usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 4 });
    });

    it('rethrows API failures with the original error as cause', async () => {
        const apiError = new Error('429 rate limited');
        mockChatCreate.mockRejectedValue(apiError);
        await expect(new AzureOpenAIProvider().generateText('q')).rejects.toMatchObject({
            message: 'Azure OpenAI text generation failed: 429 rate limited',
            cause: apiError,
        });
    });
});
