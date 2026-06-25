import { OllamaProvider } from '../services/aiProvider/providers/ollama';
import axios from 'axios';

// Auto-mock axios — turns all methods into jest.fn()
jest.mock('axios');

jest.mock('../config', () => ({
    config: {
        ollama: {
            host: 'http://localhost:11434',
            model: 'llama3.2:1b',
        },
    },
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
    return new OllamaProvider();
}

function mockOllamaChatResponse(content: string) {
    return {
        data: {
            message: { content },
            model: 'llama3.2:1b',
            prompt_eval_count: 50,
            eval_count: 30,
        },
    };
}

function mockOllamaEmbedding() {
    return {
        data: { embedding: Array.from({ length: 768 }, () => Math.random()) },
    };
}

const mockPost = axios.post as jest.Mock;
const mockGet = axios.get as jest.Mock;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('OllamaProvider — timeout configuration', () => {

    const origTimeout = process.env.OLLAMA_REQUEST_TIMEOUT_MS;

    afterAll(() => {
        if (origTimeout) process.env.OLLAMA_REQUEST_TIMEOUT_MS = origTimeout;
        else delete process.env.OLLAMA_REQUEST_TIMEOUT_MS;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.OLLAMA_REQUEST_TIMEOUT_MS;
    });

    // ── Provider properties ──────────────────────────────────────────────────

    it('has provider type set to ollama', () => {
        expect(makeProvider().provider).toBe('ollama');
    });

    it('has expected capabilities', () => {
        const provider = makeProvider();
        expect(provider.capabilities).toContain('text-generation');
        expect(provider.capabilities).toContain('reasoning');
        expect(provider.capabilities).toContain('classification');
        expect(provider.capabilities).toContain('embeddings');
    });

    it('isConfigured returns true when host is set', () => {
        expect(makeProvider().isConfigured()).toBe(true);
    });

    // ── generateText timeout ─────────────────────────────────────────────────

    it('uses default 300000ms timeout when env var is not set', async () => {
        mockPost.mockResolvedValue(mockOllamaChatResponse('Maize grows well in warm climates.'));

        await makeProvider().generateText('Tell me about maize');

        expect(mockPost).toHaveBeenCalledTimes(1);
        const axiosConfig = mockPost.mock.calls[0][2];
        expect(axiosConfig.timeout).toBe(300000);
    });

    it('uses OLLAMA_REQUEST_TIMEOUT_MS env var when set', async () => {
        process.env.OLLAMA_REQUEST_TIMEOUT_MS = '30000';
        mockPost.mockResolvedValue(mockOllamaChatResponse('Cassava is drought-tolerant.'));

        await makeProvider().generateText('Tell me about cassava');

        const axiosConfig = mockPost.mock.calls[0][2];
        expect(axiosConfig.timeout).toBe(30000);
    });

    it('accepts custom timeout via env var override (180s)', async () => {
        process.env.OLLAMA_REQUEST_TIMEOUT_MS = '180000';
        mockPost.mockResolvedValue(mockOllamaChatResponse('Beans fix nitrogen.'));

        await makeProvider().generateText('Tell me about beans');

        const axiosConfig = mockPost.mock.calls[0][2];
        expect(axiosConfig.timeout).toBe(180000);
    });

    it('wraps timeout errors with descriptive message', async () => {
        mockPost.mockRejectedValue(new Error('timeout of 300000ms exceeded'));

        await expect(
            makeProvider().generateText('Tell me about yams')
        ).rejects.toThrow('Ollama text generation failed');
    });

    // ── createEmbedding timeout (hardcoded 10s) ──────────────────────────────

    it('createEmbedding uses fixed 30000ms timeout', async () => {
        mockPost.mockResolvedValue(mockOllamaEmbedding());

        await makeProvider().createEmbedding('maize farming');

        const axiosConfig = mockPost.mock.calls[0][2];
        expect(axiosConfig.timeout).toBe(30000);
    });

    it('createEmbedding throws on timeout', async () => {
        mockPost.mockRejectedValue(new Error('timeout of 30000ms exceeded'));

        await expect(makeProvider().createEmbedding('test')).rejects.toThrow();
    });

    // ── healthCheck timeout (hardcoded 2s) ───────────────────────────────────

    it('healthCheck uses fixed 2000ms timeout', async () => {
        mockGet.mockResolvedValue({ status: 200, data: { models: [] } });

        await makeProvider().healthCheck();

        const axiosConfig = mockGet.mock.calls[0][1];
        expect(axiosConfig.timeout).toBe(2000);
    });

    it('healthCheck returns false on timeout', async () => {
        mockGet.mockRejectedValue(new Error('timeout of 2000ms exceeded'));

        expect(await makeProvider().healthCheck()).toBe(false);
    });

    it('healthCheck returns true on success', async () => {
        mockGet.mockResolvedValue({ status: 200, data: { models: [] } });

        expect(await makeProvider().healthCheck()).toBe(true);
    });

    // ── Request payload construction ─────────────────────────────────────────

    it('generateText constructs the correct request payload', async () => {
        mockPost.mockResolvedValue(mockOllamaChatResponse('OK'));

        await makeProvider().generateText('What crops grow in dry conditions?', {
            temperature: 0.5,
            maxTokens: 500,
            model: 'llama3.2:1b',
        });

        const [url, payload] = mockPost.mock.calls[0];
        expect(url).toBe('http://localhost:11434/api/chat');
        expect(payload.model).toBe('llama3.2:1b');
        expect(payload.stream).toBe(false);
        expect(payload.options.temperature).toBe(0.5);
        expect(payload.options.num_predict).toBe(500);
    });

    it('generateText returns parsed result on success', async () => {
        mockPost.mockResolvedValue(mockOllamaChatResponse('Recommended crops: sorghum, millet.'));

        const result = await makeProvider().generateText('Dry climate crops');

        expect(result.text).toBe('Recommended crops: sorghum, millet.');
        expect(result.model).toBe('llama3.2:1b');
        expect(result.usage).toEqual({ promptTokens: 50, completionTokens: 30, totalTokens: 80 });
        expect(result.finishReason).toBe('stop');
    });
});
