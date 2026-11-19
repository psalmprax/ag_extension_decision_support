import { DEFAULT_GEMINI_VISION_MODEL, selectedModelFor, visionModelFor } from '../services/aiProvider/selectedModel';

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

describe('visionModelFor', () => {
    const VISION_KEYS = ['AI_PRIMARY_PROVIDER', 'AI_VISION_MODEL'] as const;
    const saved: Record<string, string | undefined> = {};
    beforeEach(() => {
        for (const k of VISION_KEYS) saved[k] = process.env[k];
        process.env.AI_PRIMARY_PROVIDER = 'aihubmix';
        delete process.env.AI_VISION_MODEL;
    });
    afterEach(() => {
        for (const k of VISION_KEYS) {
            if (saved[k] === undefined) delete process.env[k];
            else process.env[k] = saved[k];
        }
    });

    it('defaults a Gemini-serving primary to the current Flash model for images', () => {
        expect(visionModelFor('aihubmix')).toBe(DEFAULT_GEMINI_VISION_MODEL);
        process.env.AI_PRIMARY_PROVIDER = 'google_vertex';
        expect(visionModelFor('google_vertex')).toBe(DEFAULT_GEMINI_VISION_MODEL);
    });

    it('uses AI_VISION_MODEL on the primary provider only', () => {
        process.env.AI_VISION_MODEL = 'gemini-3.8-flash';
        expect(visionModelFor('aihubmix')).toBe('gemini-3.8-flash');
        expect(visionModelFor('google_vertex')).toBeUndefined();
        expect(visionModelFor('openai')).toBeUndefined();
    });

    it('gives a non-Gemini primary no default, so it keeps its own vision model', () => {
        process.env.AI_PRIMARY_PROVIDER = 'groq';
        expect(visionModelFor('groq')).toBeUndefined();
    });

    it('falls back to the primary model when AI_VISION_MODEL is "primary"', () => {
        process.env.AI_VISION_MODEL = 'primary';
        expect(visionModelFor('aihubmix')).toBeUndefined();
    });
});
