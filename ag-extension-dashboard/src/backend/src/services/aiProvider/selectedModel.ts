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

/** Providers that serve Google's Gemini model ids. */
const GEMINI_PROVIDERS = new Set<AIProviderType>(['aihubmix', 'google_vertex']);

/**
 * Default image-analysis model on a Gemini-serving primary provider: Google's
 * current GA Flash model, which accepts image input. Disease diagnosis is a
 * paid, metered feature, so it gets a stronger model than general chat
 * (AI_PRIMARY_MODEL, a Flash-Lite model by default) without raising the cost
 * of every chat message.
 */
export const DEFAULT_GEMINI_VISION_MODEL = 'gemini-3.5-flash';

/**
 * The model to use for image analysis (disease diagnosis, photo checks) on
 * `provider`, or undefined to fall back to that provider's usual model.
 *
 * AI_VISION_MODEL names a model for the primary provider only, for the same
 * reason AI_PRIMARY_MODEL does (see selectedModelFor). Set it to `primary` to
 * use AI_PRIMARY_MODEL for images too. Unset, a Gemini-serving primary uses
 * DEFAULT_GEMINI_VISION_MODEL and any other provider keeps its own default.
 */
export function visionModelFor(provider: AIProviderType): string | undefined {
    const env = process.env;
    const primaryProvider = env.AI_PRIMARY_PROVIDER ?? config.ai.primary.provider;
    if (provider !== primaryProvider) return undefined;
    const configured = env.AI_VISION_MODEL?.trim();
    if (configured === 'primary') return undefined;
    if (configured) return configured;
    return GEMINI_PROVIDERS.has(provider) ? DEFAULT_GEMINI_VISION_MODEL : undefined;
}
