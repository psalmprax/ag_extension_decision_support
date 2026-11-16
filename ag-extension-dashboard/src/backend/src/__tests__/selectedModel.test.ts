import { selectedModelFor } from '../services/aiProvider/selectedModel';

const KEYS = ['AI_PRIMARY_PROVIDER', 'AI_PRIMARY_MODEL', 'AI_FALLBACK_PROVIDER', 'AI_FALLBACK_MODEL'] as const;

describe('selectedModelFor', () => {
    const saved: Record<string, string | undefined> = {};
    beforeEach(() => {
        for (const k of KEYS) saved[k] = process.env[k];
        process.env.AI_PRIMARY_PROVIDER = 'aihubmix';
        process.env.AI_PRIMARY_MODEL = 'gemini-3.1-flash-lite';
        process.env.AI_FALLBACK_PROVIDER = 'ollama';
        process.env.AI_FALLBACK_MODEL = 'llama3.2:3b';
    });
    afterEach(() => {
        for (const k of KEYS) {
            if (saved[k] === undefined) delete process.env[k];
            else process.env[k] = saved[k];
        }
    });

    it('gives the primary model only to the primary provider', () => {
        expect(selectedModelFor('aihubmix')).toBe('gemini-3.1-flash-lite');
    });

    it('gives the fallback model only to the fallback provider', () => {
        expect(selectedModelFor('ollama')).toBe('llama3.2:3b');
    });

    it('gives no model to a provider the chain merely passes through', () => {
        // The stage bug: OpenRouter was sent the Ollama tag "llama3.2:3b".
        expect(selectedModelFor('openrouter')).toBeUndefined();
        expect(selectedModelFor('openai')).toBeUndefined();
        expect(selectedModelFor('google_vertex')).toBeUndefined();
    });

    it('lets the provider use its own default when the selected model is unset', () => {
        delete process.env.AI_PRIMARY_MODEL;
        expect(selectedModelFor('aihubmix')).toBeUndefined();
    });

    it('follows a changed selection at call time', () => {
        process.env.AI_FALLBACK_PROVIDER = 'openrouter';
        process.env.AI_FALLBACK_MODEL = 'minimax/minimax-m3:free';
        expect(selectedModelFor('openrouter')).toBe('minimax/minimax-m3:free');
        expect(selectedModelFor('ollama')).toBeUndefined();
    });
});
