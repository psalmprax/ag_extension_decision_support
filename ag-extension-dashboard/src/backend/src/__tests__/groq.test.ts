/* eslint-disable @typescript-eslint/no-explicit-any */
import { GroqProvider } from '../services/aiProvider/providers/groq';

// The provider statically imports groq-sdk, so the mock factory must define
// everything it needs internally (no out-of-scope references) to avoid a
// temporal-dead-zone error when the module is loaded. The create mock is exposed
// on the mocked module so tests can configure it via jest.requireMock.
jest.mock('groq-sdk', () => {
    const mockCreate = jest.fn();
    const MockGroq = jest.fn().mockImplementation(() => ({
        chat: { completions: { create: mockCreate } },
    }));
    return { __esModule: true, default: MockGroq, mockChatCompletionsCreate: mockCreate };
});

jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

const { mockChatCompletionsCreate } = jest.requireMock('groq-sdk') as {
    mockChatCompletionsCreate: jest.Mock;
};

function makeProvider() {
    return new GroqProvider();
}

function mockCompletion(content: string) {
    mockChatCompletionsCreate.mockResolvedValueOnce({
        choices: [{ message: { content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
    });
}

describe('GroqProvider reasoning & classification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('analyzeWithReasoning sends system+user messages and strips the visuals block', async () => {
        mockCompletion('Here is the advice <visuals>{"kpis":[{"label":"pH","value":"6.5","status":"good"}]}</visuals>');
        const provider = makeProvider();

        const result = await provider.analyzeWithReasoning('some context', 'How do I grow maize?');

        expect(result.answer).toBe('Here is the advice');
        expect(result.visuals).toEqual({ kpis: [{ label: 'pH', value: '6.5', status: 'good' }] });
        expect(result.confidence).toBe(0.9);

        expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);
        const args = mockChatCompletionsCreate.mock.calls[0][0];
        expect(args.messages[0].role).toBe('system');
        expect(args.messages[1].role).toBe('user');
        expect(args.messages[1].content).toContain('How do I grow maize?');
        expect(args.messages[1].content).toContain('some context');
    });

    it('analyzeWithReasoning uses the no-context fallback when context is empty', async () => {
        mockCompletion('General guidance');
        const provider = makeProvider();

        await provider.analyzeWithReasoning('', 'Question?');

        const args = mockChatCompletionsCreate.mock.calls[0][0];
        expect(args.messages[1].content).toContain('No specific context found in knowledge base.');
    });

    it('classify parses the JSON labels array', async () => {
        mockCompletion('[{"label":"pest","score":0.9},{"label":"disease","score":0.4}]');
        const provider = makeProvider();

        const result = await provider.classify('My crop has yellow spots', { taxonomy: 'pest|disease|weather' });

        expect(result.labels).toEqual([
            { label: 'pest', score: 0.9 },
            { label: 'disease', score: 0.4 },
        ]);
    });

    it('classify falls back to a general label when the response is not JSON', async () => {
        mockCompletion('I am not sure how to categorize this.');
        const provider = makeProvider();

        const result = await provider.classify('ambiguous input', { taxonomy: 'a|b' });

        expect(result.labels).toEqual([{ label: 'general', score: 1.0 }]);
    });
});
