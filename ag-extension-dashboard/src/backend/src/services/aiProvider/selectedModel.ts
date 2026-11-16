import { config } from '@/config';
import type { AIProviderType } from './types';

/**
 * The model the operator chose for `provider`, or undefined when `provider` is
 * neither the selected primary nor the selected fallback.
 *
 * AI_PRIMARY_MODEL and AI_FALLBACK_MODEL name a model for the provider set next
 * to them (AI_PRIMARY_PROVIDER / AI_FALLBACK_PROVIDER), not for every provider.
 * Any other provider the fallback chain reaches must use its own default, or it
 * is sent a model id it does not serve: an Ollama tag sent to OpenRouter fails
 * with "not a valid model ID", a Gemini name sent to OpenAI with a 404.
 *
 * Read from process.env at call time (falling back to the config defaults for
 * the provider names) so it always matches the running environment.
 */
export function selectedModelFor(provider: AIProviderType): string | undefined {
    const env = process.env;
    const primaryProvider = env.AI_PRIMARY_PROVIDER ?? config.ai.primary.provider;
    const fallbackProvider = env.AI_FALLBACK_PROVIDER ?? config.ai.fallback.provider;
    if (primaryProvider === provider && env.AI_PRIMARY_MODEL) return env.AI_PRIMARY_MODEL;
    if (fallbackProvider === provider && env.AI_FALLBACK_MODEL) return env.AI_FALLBACK_MODEL;
    return undefined;
}
