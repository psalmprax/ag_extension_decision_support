/* eslint-disable @typescript-eslint/no-explicit-any */
import { FreebuffProvider } from '../services/aiProvider/providers/freebuff';

// FreebuffProvider lazily constructs an OpenAI client pointing at FREEBUFF_API_BASE_URL.
// We mock the openai SDK so the test never touches the network.
const mockChatCompletionsCreate = jest.fn();
const mockModelsList = jest.fn();
const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockChatCompletionsCreate } },
    models: { list: mockModelsList },
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProvider() {
    return new FreebuffProvider();
}

function mockChatResponse(
    content: string,
    opts: { usage?: any; finishReason?: string } = {}
) {
    return {
        choices: [
            {
                message: { content },
                finishReason: opts.finishReason ?? 'stop',
            },
        ],
        usage: opts.usage ?? { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        model: 'deepseek-chat',
    };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('FreebuffProvider', () => {
    const origToken = process.env.FREEBUFF_AUTH_TOKEN;
    const origUrl = process.env.FREEBUFF_API_BASE_URL;
    const origModel = process.env.FREEBUFF_DEFAULT_MODEL;

    afterAll(() => {
        if (origToken !== undefined) process.env.FREEBUFF_AUTH_TOKEN = origToken;
        else delete process.env.FREEBUFF_AUTH_TOKEN;
        if (origUrl !== undefined) process.env.FREEBUFF_API_BASE_URL = origUrl;
        else delete process.env.FREEBUFF_API_BASE_URL;
        if (origModel !== undefined) process.env.FREEBUFF_DEFAULT_MODEL = origModel;
        else delete process.env.FREEBUFF_DEFAULT_MODEL;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.FREEBUFF_AUTH_TOKEN = 'test-token-abc123';
        process.env.FREEBUFF_API_BASE_URL = 'https://api.freebuff.example/v1';
        delete process.env.FREEBUFF_DEFAULT_MODEL;
    });

    // ── Provider properties ──────────────────────────────────────────────────

    it('has provider type set to freebuff', () => {
        expect(makeProvider().provider).toBe('freebuff');
    });

    it('has expected capabilities (text-generation, reasoning)', () => {
        const provider = makeProvider();
        expect(provider.capabilities).toContain('text-generation');
        expect(provider.capabilities).toContain('reasoning');
        // Explicitly NOT supported
        expect(provider.capabilities).not.toContain('embeddings');
        expect(provider.capabilities).not.toContain('vision');
    });

    // ── isConfigured ─────────────────────────────────────────────────────────

    it('isConfigured returns true when both FREEBUFF_AUTH_TOKEN and FREEBUFF_API_BASE_URL are set', () => {
        expect(makeProvider().isConfigured()).toBe(true);
    });

    it('isConfigured returns false when FREEBUFF_AUTH_TOKEN is missing', () => {
        delete process.env.FREEBUFF_AUTH_TOKEN;
        expect(makeProvider().isConfigured()).toBe(false);
    });

    it('isConfigured returns false when FREEBUFF_API_BASE_URL is missing', () => {
        delete process.env.FREEBUFF_API_BASE_URL;
        expect(makeProvider().isConfigured()).toBe(false);
    });

    // ── generateText ─────────────────────────────────────────────────────────

    it('generateText calls chat.completions.create with default deepseek-chat model + system+user messages', async () => {
        mockChatCompletionsCreate.mockResolvedValueOnce(
            mockChatResponse('Maize grows well in warm climates.')
        );

        const result = await makeProvider().generateText('Tell me about maize');

        expect(mockChatCompletionsCreate).toHaveBeenCalledTimes(1);
        const callArgs = mockChatCompletionsCreate.mock.calls[0][0];
        expect(callArgs.model).toBe('deepseek-chat');
        expect(callArgs.messages).toHaveLength(2);
        expect(callArgs.messages[0].role).toBe('system');
        expect(callArgs.messages[0].content).toBe(
            'You are a helpful agricultural extension assistant.'
        );
        expect(callArgs.messages[1].role).toBe('user');
        expect(callArgs.messages[1].content).toBe('Tell me about maize');
        expect(result.text).toBe('Maize grows well in warm climates.');
        expect(result.model).toBe('deepseek-chat');
    });

    it('generateText honors options.model override', async () => {
        mockChatCompletionsCreate.mockResolvedValueOnce(mockChatResponse('OK'));

        await makeProvider().generateText('test', { model: 'custom-model-7b' });

        expect(mockChatCompletionsCreate.mock.calls[0][0].model).toBe('custom-model-7b');
    });

    it('generateText honors FREEBUFF_DEFAULT_MODEL env var when no model option is provided', async () => {
        process.env.FREEBUFF_DEFAULT_MODEL = 'qwen-coder';
        mockChatCompletionsCreate.mockResolvedValueOnce(mockChatResponse('OK'));

        await makeProvider().generateText('test');

        expect(mockChatCompletionsCreate.mock.calls[0][0].model).toBe('qwen-coder');
    });

    // The two tests below verify the env > config > default precedence in
    // getResolvedConfig(). The authToken/apiBaseUrl fallback-to-config path
    // is provable only by mocking @/config with a sentinel value, which is
    // out of scope for these in-process tests (the provider uses
    // `await import('openai')` which jest.doMock doesn't reliably intercept).

    it('getResolvedConfig() env-wins precedence (all 3 fields come from process.env when set)', () => {
        process.env.FREEBUFF_DEFAULT_MODEL = 'qwen-coder';
        process.env.FREEBUFF_AUTH_TOKEN = 'env-token';
        process.env.FREEBUFF_API_BASE_URL = 'https://env.freebuff.example/v1';
        const cfg = makeProvider().getResolvedConfig();
        expect(cfg.defaultModel).toBe('qwen-coder');
        expect(cfg.authToken).toBe('env-token');
        expect(cfg.apiBaseUrl).toBe('https://env.freebuff.example/v1');
    });

    it('getResolvedConfig() falls back to literal defaults when env is unset', () => {
        // config.freebuff.* is '' / 'deepseek-chat' at import time (env was
        // unset when config was loaded), so the `||` chain's last-falsy
        // fallback — the literal default in getResolvedConfig — wins.
        delete process.env.FREEBUFF_DEFAULT_MODEL;
        delete process.env.FREEBUFF_AUTH_TOKEN;
        delete process.env.FREEBUFF_API_BASE_URL;
        const cfg = makeProvider().getResolvedConfig();
        expect(cfg.defaultModel).toBe('deepseek-chat');
        expect(cfg.authToken).toBe('');
        expect(cfg.apiBaseUrl).toBe('');
    });

    it('generateText passes temperature and maxTokens from options', async () => {
        mockChatCompletionsCreate.mockResolvedValueOnce(mockChatResponse('OK'));

        await makeProvider().generateText('test', { temperature: 0.3, maxTokens: 500 });

        const callArgs = mockChatCompletionsCreate.mock.calls[0][0];
        expect(callArgs.temperature).toBe(0.3);
        expect(callArgs.max_tokens).toBe(500);
    });

    it('generateText uses default temperature 0.7 and maxTokens 1000 when not specified', async () => {
        mockChatCompletionsCreate.mockResolvedValueOnce(mockChatResponse('OK'));

        await makeProvider().generateText('test');

        const callArgs = mockChatCompletionsCreate.mock.calls[0][0];
        expect(callArgs.temperature).toBe(0.7);
        expect(callArgs.max_tokens).toBe(1000);
    });

    it('generateText accepts a messages-array prompt and passes it through unchanged', async () => {
        const messages = [
            { role: 'system', content: 'You are X.' },
            { role: 'user', content: 'Q?' },
        ];
        mockChatCompletionsCreate.mockResolvedValueOnce(mockChatResponse('A'));

        await makeProvider().generateText(messages);

        expect(mockChatCompletionsCreate.mock.calls[0][0].messages).toEqual(messages);
    });

    it('generateText wraps errors with descriptive message', async () => {
        mockChatCompletionsCreate.mockRejectedValueOnce(new Error('rate limit exceeded'));

        await expect(makeProvider().generateText('test')).rejects.toThrow(
            'Freebuff text generation failed'
        );
    });

    it('generateText returns the choice finishReason', async () => {
        mockChatCompletionsCreate.mockResolvedValueOnce(
            mockChatResponse('OK', { finishReason: 'length' })
        );

        const result = await makeProvider().generateText('test');

        expect(result.finishReason).toBe('length');
    });

    // ── streamText ───────────────────────────────────────────────────────────

    it('streamText sets stream:true and yields delta content', async () => {
        async function* mockStream() {
            yield { choices: [{ delta: { content: 'Hello ' } }] };
            yield { choices: [{ delta: { content: 'world' } }] };
        }
        mockChatCompletionsCreate.mockResolvedValueOnce(mockStream());

        const chunks: string[] = [];
        for await (const chunk of makeProvider().streamText('greet me')) {
            chunks.push(chunk);
        }

        expect(chunks).toEqual(['Hello ', 'world']);
        expect(mockChatCompletionsCreate.mock.calls[0][0].stream).toBe(true);
    });

    it('streamText skips chunks whose delta has no content', async () => {
        async function* mockStream() {
            yield { choices: [{ delta: { content: 'A' } }] };
            yield { choices: [{ delta: {} }] };
            yield { choices: [{ delta: { content: 'B' } }] };
        }
        mockChatCompletionsCreate.mockResolvedValueOnce(mockStream());

        const chunks: string[] = [];
        for await (const chunk of makeProvider().streamText('test')) {
            chunks.push(chunk);
        }

        expect(chunks).toEqual(['A', 'B']);
    });

    it('streamText wraps errors with descriptive message', async () => {
        mockChatCompletionsCreate.mockRejectedValueOnce(new Error('connection reset'));

        const iterator = makeProvider().streamText('test');
        await expect(iterator.next()).rejects.toThrow('Freebuff streaming failed');
    });

    // ── healthCheck ──────────────────────────────────────────────────────────

    it('healthCheck calls models.list and returns true on success', async () => {
        mockModelsList.mockResolvedValueOnce({ data: [] });

        expect(await makeProvider().healthCheck()).toBe(true);
        expect(mockModelsList).toHaveBeenCalledTimes(1);
    });

    it('healthCheck returns false on error (community proxy may be down)', async () => {
        mockModelsList.mockRejectedValueOnce(new Error('community proxy down'));

        expect(await makeProvider().healthCheck()).toBe(false);
    });

    // ── analyzeWithReasoning ─────────────────────────────────────────────────

    it('analyzeWithReasoning wraps generateText with a grounded prompt containing context + question', async () => {
        mockChatCompletionsCreate.mockResolvedValueOnce(
            mockChatResponse('Based on CABI, apply fungicide.')
        );

        const result = await makeProvider().analyzeWithReasoning(
            'CABI: Northern Leaf Blight is a fungal disease treated with fungicide.',
            'How do I treat Northern Leaf Blight?'
        );

        expect(result.answer).toBe('Based on CABI, apply fungicide.');
        expect(result.reasoning).toContain('Freebuff best-effort answer');
        expect(result.confidence).toBe(0.7);

        const callArgs = mockChatCompletionsCreate.mock.calls[0][0];
        const userContent = callArgs.messages[1].content as string;
        expect(userContent).toContain('CABI: Northern Leaf Blight');
        expect(userContent).toContain('How do I treat Northern Leaf Blight?');
    });

    it('analyzeWithReasoning uses the "no specific context" fallback when context is empty', async () => {
        mockChatCompletionsCreate.mockResolvedValueOnce(mockChatResponse('General advice.'));

        await makeProvider().analyzeWithReasoning('', 'How to grow maize?');

        const callArgs = mockChatCompletionsCreate.mock.calls[0][0];
        expect(callArgs.messages[1].content).toContain(
            'No specific context found in knowledge base.'
        );
    });

    it('analyzeWithReasoning uses lower temperature (0.3) and higher maxTokens (2000) for grounded answers', async () => {
        mockChatCompletionsCreate.mockResolvedValueOnce(mockChatResponse('OK'));

        await makeProvider().analyzeWithReasoning('ctx', 'q');

        const callArgs = mockChatCompletionsCreate.mock.calls[0][0];
        expect(callArgs.model).toBe('deepseek-chat');
        expect(callArgs.temperature).toBe(0.3);
        expect(callArgs.max_tokens).toBe(2000);
    });

    // ── Unsupported capabilities (parameterized) ─────────────────────────────

    it.each([
        ['createEmbedding', () => makeProvider().createEmbedding('test')],
        ['createBatchEmbeddings', () => makeProvider().createBatchEmbeddings(['a', 'b'])],
        ['speechToText', () => makeProvider().speechToText(Buffer.from('x'))],
        ['textToSpeech', () => makeProvider().textToSpeech('test')],
        ['classify', () => makeProvider().classify('test', { taxonomy: 'x' })],
        ['analyzeImage', () => makeProvider().analyzeImage('data:image/png;base64,xxx', 'desc')],
        ['analyzeVideo', () => makeProvider().analyzeVideo(Buffer.from('x'), 'desc')],
    ])('%s rejects unsupported capabilities explicitly', async (_name, fn) => {
        await expect((fn as () => Promise<unknown>)()).rejects.toThrow(/does not support/);
    });
});
