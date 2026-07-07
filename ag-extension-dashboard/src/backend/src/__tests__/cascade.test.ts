import { AI_CASCADE_FALLBACK } from '../services/aiProvider/cascade';

describe('AI_CASCADE_FALLBACK (cascade order for AI provider fallback in app.ts)', () => {
    it('orders free tiers (groq, ollama, freebuff) before paid tiers (openai, anthropic)', () => {
        expect(AI_CASCADE_FALLBACK).toEqual([
            'groq',
            'ollama',
            'freebuff',
            'openai',
            'anthropic',
        ]);
    });

    it('contains exactly 5 unique providers (no duplicates, no missing entries)', () => {
        expect(AI_CASCADE_FALLBACK).toHaveLength(5);
        expect(new Set(AI_CASCADE_FALLBACK).size).toBe(5);
    });

    it('is frozen at runtime so route code cannot accidentally mutate it', () => {
        expect(Object.isFrozen(AI_CASCADE_FALLBACK)).toBe(true);
    });
});
