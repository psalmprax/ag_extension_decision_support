// The config module is a singleton loaded from env at import time, so we mock it
// to test startup validation across provider configurations deterministically.
const mockConfig: {
    database: { url: string };
    jwt: { secret: string; expiresIn: string };
    redis: { url: string };
    openAI: { apiKey: string };
    azureOpenAI: { apiKey: string; endpoint: string; deploymentName: string };
    anthropic: { apiKey: string };
    groq: { apiKey: string };
    googleVertex: { projectId: string };
    freebuff: { authToken: string; apiBaseUrl: string };
    ollama: { host: string; model: string };
    stripeSecretKey: string;
    externalApis: { weather: { apiKey: string }; fao: { url: string } };
    ai: { primary: { provider: string; model: string; region: string }; fallback: { provider: string; model: string; region: string } };
} = {
    database: { url: 'postgresql://test' },
    jwt: { secret: 'test-secret', expiresIn: '7d' },
    redis: { url: 'redis://test' },
    openAI: { apiKey: '' },
    azureOpenAI: { apiKey: '', endpoint: '', deploymentName: 'gpt-4' },
    anthropic: { apiKey: '' },
    groq: { apiKey: '' },
    googleVertex: { projectId: '' },
    freebuff: { authToken: '', apiBaseUrl: '' },
    ollama: { host: 'http://localhost:11434', model: 'llama3' },
    stripeSecretKey: '',
    externalApis: { weather: { apiKey: '' }, fao: { url: '' } },
    ai: {
        primary: { provider: 'groq', model: 'llama-3.3-70b-versatile', region: '' },
        fallback: { provider: 'ollama', model: 'llama3', region: '' },
    },
};

jest.mock('@/config', () => ({ config: mockConfig }));

jest.mock('../utils/logger', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    },
}));

import {
    validateStartupConfiguration,
    logStartupWarnings,
} from '../utils/startupValidation';
import { logger } from '../utils/logger';

describe('startup AI provider validation', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
        process.env.NODE_ENV = originalNodeEnv;
        // Reset any state mutated between tests.
        mockConfig.ai.primary = { provider: 'groq', model: 'llama-3.3-70b-versatile', region: '' };
        mockConfig.groq.apiKey = '';
        mockConfig.openAI.apiKey = '';
        mockConfig.ollama.host = 'http://localhost:11434';
    });

    it('warns when the primary provider key is missing (dev)', () => {
        process.env.NODE_ENV = 'development';
        const warnings = validateStartupConfiguration();
        const aiWarnings = warnings.filter(w => w.key === 'GROQ_API_KEY');
        expect(aiWarnings).toHaveLength(1);
        expect(aiWarnings[0].severity).toBe('warning');
        expect(aiWarnings[0].message).toContain('groq');
    });

    it('treats a missing primary provider key as critical in production', () => {
        process.env.NODE_ENV = 'production';
        const warnings = validateStartupConfiguration();
        const aiWarnings = warnings.filter(w => w.key === 'GROQ_API_KEY');
        expect(aiWarnings).toHaveLength(1);
        expect(aiWarnings[0].severity).toBe('critical');
    });

    it('does not warn when the primary provider key is present', () => {
        process.env.NODE_ENV = 'production';
        mockConfig.groq.apiKey = 'test-groq-key';
        const warnings = validateStartupConfiguration();
        expect(warnings.some(w => w.key === 'GROQ_API_KEY')).toBe(false);
    });

    it('warns for an unknown primary provider', () => {
        process.env.NODE_ENV = 'production';
        mockConfig.ai.primary.provider = 'not-a-provider';
        const warnings = validateStartupConfiguration();
        const aiWarnings = warnings.filter(w => w.key === 'AI_PRIMARY_PROVIDER');
        expect(aiWarnings).toHaveLength(1);
        expect(aiWarnings[0].message).toContain('Unknown AI primary provider');
    });

    it('considers ollama primary configured when a host is set (no key needed)', () => {
        process.env.NODE_ENV = 'production';
        mockConfig.ai.primary.provider = 'ollama';
        const warnings = validateStartupConfiguration();
        expect(warnings.some(w => w.key === 'OLLAMA_HOST')).toBe(false);
    });

    it('logStartupWarnings emits the primary-provider warning through the logger', () => {
        process.env.NODE_ENV = 'production';
        const warnings = validateStartupConfiguration();
        logStartupWarnings(warnings);
        expect(logger.error).toHaveBeenCalled();
        const logged = (logger.error as jest.Mock).mock.calls.some((call: unknown[]) =>
            String(call[0]).includes('GROQ_API_KEY')
        );
        expect(logged).toBe(true);
    });
});
