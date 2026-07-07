import type { AIProviderType } from './types';

/**
 * Cascade order used by `checkAIProvider()` (in src/app.ts) when both the
 * primary and fallback providers are unhealthy.
 *
 * Order rationale:
 *   1. groq    — fast paid free tier, kept first
 *   2. ollama  — local LLM (free, private, no rate-limit); preferred over freebuff
 *   3. freebuff — community proxy (best-effort, no SLA); only tried when ollama is down
 *   4. openai  — paid provider, kept later to minimize cost
 *   5. anthropic — paid provider, last resort
 *
 * `Object.freeze()` makes the array immutable at runtime so route code can't
 * accidentally mutate it; the `readonly` type prevents mutation at compile time.
 * Tested in src/__tests__/cascade.test.ts.
 */
export const AI_CASCADE_FALLBACK: readonly AIProviderType[] = Object.freeze([
    'groq',
    'ollama',
    'freebuff',
    'openai',
    'anthropic',
]);
