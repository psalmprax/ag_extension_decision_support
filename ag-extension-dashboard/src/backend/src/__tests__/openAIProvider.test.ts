/* eslint-disable @typescript-eslint/no-explicit-any */
// Load provider config from env BEFORE importing the config singleton so
// dotenv (which never overrides existing process.env) keeps these values.
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.AI_PRIMARY_PROVIDER = 'openai';
process.env.AI_PRIMARY_MODEL = 'gpt-4o';

import { OpenAIProvider } from '../services/aiProvider/providers/openAI';

// Mock the openai SDK so healthCheck never touches the network.
const mockChatCompletionsCreate = jest.fn();
const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockChatCompletionsCreate } },
}));

jest.mock('openai', () => ({
    __esModule: true,
    default: MockOpenAI,
}));

jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

function makeProvider() {
    return new OpenAIProvider();
}

describe('OpenAIProvider healthCheck diagnostics', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('is configured when an API key is present', () => {
        expect(makeProvider().isConfigured()).toBe(true);
    });

    it('records no health error before the first probe', () => {
        expect(makeProvider().getLastHealthError()).toBeUndefined();
    });

    it('healthCheck returns true and clears the recorded error on success', async () => {
        mockChatCompletionsCreate.mockResolvedValueOnce({
            choices: [{ message: { content: 'ok' } }],
        });
        const provider = makeProvider();

        // Simulate a prior failure so we can assert it is cleared on success.
        (provider as any).recordHealthError('401 Invalid API key');

        expect(await provider.healthCheck()).toBe(true);
        expect(provider.getLastHealthError()).toBeUndefined();
        expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);
        // Resolves the configured primary model (gpt-4o) for the probe.
        expect(mockChatCompletionsCreate.mock.calls[0][0].model).toBe('gpt-4o');
    });

    it('healthCheck returns false and records the failure reason', async () => {
        mockChatCompletionsCreate.mockRejectedValueOnce(new Error('401 Invalid API key'));
        const provider = makeProvider();

        expect(await provider.healthCheck()).toBe(false);
        expect(provider.getLastHealthError()).toBe('401 Invalid API key');
    });

    it('healthCheck records the raw reason for non-Error rejections', async () => {
        mockChatCompletionsCreate.mockRejectedValueOnce('429 rate limited');
        const provider = makeProvider();

        expect(await provider.healthCheck()).toBe(false);
        expect(provider.getLastHealthError()).toBe('429 rate limited');
    });
});
