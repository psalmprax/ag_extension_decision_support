/* eslint-disable @typescript-eslint/no-explicit-any */
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { agentTelemetry } from '@/services/agentTelemetry';
import { getRequestContext } from '@/services/requestContext';
import { buildGroundedReasoningPrompt, extractVisuals } from './assetLibrary';

// Re-export types from the isolated types module (no circular deps)
export type {
    AIProviderType,
    AICapability,
    TextGenerationOptions,
    TextGenerationResult,
    EmbeddingOptions,
    EmbeddingResult,
    SpeechToTextOptions,
    SpeechToTextResult,
    TextToSpeechOptions,
    TextToSpeechResult,
    ClassificationOptions,
    ClassificationResult,
    ReasoningOptions,
    ReasoningResult,
    ImageAnalysisOptions,
    ImageAnalysisResult,
    VideoAnalysisOptions,
    VideoAnalysisResult,
} from './types';

export { BaseAIProvider } from './types';

import type { AIProviderType, AICapability } from './types';

// Factory for creating AI providers
export class AIProviderFactory {
    private static providers: Map<AIProviderType, AICapability> = new Map();
    private static primaryProvider: AIProviderType;
    private static fallbackProvider: AIProviderType;

    static initialize(): void {
        this.primaryProvider = config.ai.primary.provider as AIProviderType;
        this.fallbackProvider = config.ai.fallback.provider as AIProviderType;
        logger.info(`AI Provider Factory initialized with primary: ${this.primaryProvider}, fallback: ${this.fallbackProvider}`);
    }

    static async getProvider(providerType?: AIProviderType): Promise<AICapability> {
        const type = providerType || this.primaryProvider;

        if (this.providers.has(type)) {
            return this.providers.get(type)!;
        }

        const provider = await this.createProvider(type);
        this.providers.set(type, provider);
        return provider;
    }

    static async getPrimaryProvider(): Promise<AICapability> {
        return this.getProvider(this.primaryProvider);
    }

    static async getFallbackProvider(): Promise<AICapability> {
        return this.getProvider(this.fallbackProvider);
    }

    static async getWithFallback(
        operation: (provider: AICapability) => Promise<any>,
        preferredProvider?: AIProviderType,
        telemetryContext?: { correlationId?: string; userId?: string; operation?: string; promptText?: string }
    ): Promise<any> {
        // Define all available providers for cascading fallback
        let allProviders: AIProviderType[] = Array.from(new Set([
            this.primaryProvider,
            this.fallbackProvider,
            'aihubmix',
            'openrouter',
            'groq',
            'openai',
            'anthropic',
            'freebuff',
            'ollama',
            'nvidia',
            'huggingface'
        ]));

        // If a caller (e.g. free-tier routing) prefers a specific provider,
        // put it at the front of the chain so it's tried first.
        if (preferredProvider) {
            allProviders = Array.from(new Set([preferredProvider, ...allProviders]));
        }

        // Prioritize configured providers before unconfigured ones so requests are serviced promptly
        const configuredProviders: AIProviderType[] = [];
        const unconfiguredProviders: AIProviderType[] = [];
        for (const pType of allProviders) {
            try {
                const p = await this.getProvider(pType);
                if (p.isConfigured()) {
                    configuredProviders.push(pType);
                } else {
                    unconfiguredProviders.push(pType);
                }
            } catch {
                unconfiguredProviders.push(pType);
            }
        }
        allProviders = [...configuredProviders, ...unconfiguredProviders];

        let lastError: Error | null = null;
        const requestContext = getRequestContext();
        const context = {
            correlationId: telemetryContext?.correlationId || requestContext?.correlationId,
            userId: telemetryContext?.userId || requestContext?.userId,
            operation: telemetryContext?.operation || 'ai_provider_request',
        };

        for (const [attempt, providerType] of allProviders.entries()) {
            const startedAt = Date.now();
            try {
                const provider = await this.getProvider(providerType);

                if (!provider.isConfigured()) {
                    logger.debug(`AI provider ${providerType} not configured, skipping...`);
                    continue;
                }

                const isHealthy = await provider.healthCheck();
                if (!isHealthy) {
                    await this.recordProviderAttempt(providerType, attempt, startedAt, context, 'error', 'provider_unhealthy');
                    logger.warn(`AI provider ${providerType} unhealthy, trying next...`);
                    continue;
                }

                logger.info(`Using AI provider: ${providerType}`);
                const result = await operation(provider);
                await this.recordProviderAttempt(providerType, attempt, startedAt, context, 'success', undefined, result);
                return result;
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                await this.recordProviderAttempt(providerType, attempt, startedAt, context, 'error', lastError.message);
                logger.warn(`AI provider ${providerType} failed:`, error);
            }
        }

        // ── Final safety net: free LLM cascade via OmniRoute ──
        const promptText = telemetryContext?.promptText;
        if (promptText) {
            try {
                const { OmniRouteService } = await import('@/services/omniRouteService');
                const fallback = await OmniRouteService.executeWithFailover([
                    { role: 'user', content: promptText }
                ]);
                logger.info(
                    `OmniRoute free-model fallback succeeded: ${fallback.providerUsed}/${fallback.modelUsed}`
                );
                return { text: fallback.text, providerUsed: fallback.providerUsed, modelUsed: fallback.modelUsed, isFreeModel: true };
            } catch (omniError) {
                logger.warn('OmniRoute free-model fallback also failed:', omniError);
            }
        }

        logger.error('All AI providers failed (including OmniRoute free tier)');
        throw lastError || new Error('All AI providers failed — no provider is configured or healthy');
    }

    private static async recordProviderAttempt(
        provider: AIProviderType,
        attempt: number,
        startedAt: number,
        context: { correlationId?: string; userId?: string; operation: string },
        status: 'success' | 'error',
        error?: string,
        result?: any
    ): Promise<void> {
        try {
            await agentTelemetry.record({
                eventType: status === 'success' ? 'agent_request' : 'error',
                agentId: provider,
                userId: context.userId,
                durationMs: Date.now() - startedAt,
                tokensUsed: result?.usage?.totalTokens,
                costUsd: 0,
                status,
                correlationId: context.correlationId,
                metadata: {
                    operation: context.operation,
                    provider,
                    attempt: attempt + 1,
                    fallbackUsed: attempt > 0,
                    ...(error ? { error } : {}),
                },
            });
        } catch (telemetryError) {
            logger.warn('Failed to record AI provider telemetry:', telemetryError);
        }
    }

    private static async createProvider(type: AIProviderType): Promise<AICapability> {
        switch (type) {
            case 'aihubmix': {
                const { AIHubMixProvider } = await import('./providers/aihubmix');
                return new AIHubMixProvider();
            }
            case 'openrouter': {
                const { OpenRouterProvider } = await import('./providers/openRouter');
                return new OpenRouterProvider();
            }
            case 'azure_openai': {
                const { AzureOpenAIProvider } = await import('./providers/azureOpenAI');
                return new AzureOpenAIProvider();
            }
            case 'google_vertex': {
                const { GoogleVertexProvider } = await import('./providers/googleVertex');
                return new GoogleVertexProvider();
            }
            case 'openai': {
                const { OpenAIProvider } = await import('./providers/openAI');
                return new OpenAIProvider();
            }
            case 'anthropic': {
                const { AnthropicProvider } = await import('./providers/anthropic');
                return new AnthropicProvider();
            }
            case 'groq': {
                const { GroqProvider } = await import('./providers/groq');
                return new GroqProvider();
            }
            case 'freebuff': {
                const { FreebuffProvider } = await import('./providers/freebuff');
                return new FreebuffProvider();
            }
            case 'ollama': {
                const { OllamaProvider } = await import('./providers/ollama');
                return new OllamaProvider();
            }
            case 'nvidia': {
                const { NVIDIAProvider } = await import('./providers/nvidia');
                return new NVIDIAProvider();
            }
            case 'huggingface': {
                const { HuggingFaceProvider } = await import('./providers/huggingface');
                return new HuggingFaceProvider();
            }
            default:
                throw new Error(`Unknown AI provider type: ${type}`);
        }
    }
}

// Router for intelligent request routing
export class AIRouter {
    private static providerWeights: Map<AIProviderType, number> = new Map();

    static setProviderWeight(provider: AIProviderType, weight: number): void {
        this.providerWeights.set(provider, weight);
    }

    static async routeRequest(
        requestType: 'generate' | 'embed' | 'speech' | 'classify' | 'reason' | 'weather' | 'disease_alerts' | 'vision' | 'video',
        params: any
    ): Promise<any> {
        const result = await AIProviderFactory.getWithFallback(async (provider) => {
            switch (requestType) {
                case 'generate':
                    return provider.generateText(params.prompt, params.options);
                case 'embed':
                    return await provider.createEmbedding(params.text, params.options);
                case 'speech':
                    if (params.text) {
                        return provider.textToSpeech(params.text, params.options);
                    }
                    return provider.speechToText(params.audio, params.options);
                case 'classify':
                    return provider.classify(params.input, params.options);
                case 'reason':
                    return provider.analyzeWithReasoning(params.context, params.query, params.options);
                case 'weather': {
                    const { WeatherService } = await import('@/services/weatherService');
                    return WeatherService.getByLocation(params.location);
                }
                case 'disease_alerts': {
                    const { FAOService } = await import('@/services/faoService');
                    return FAOService.getDiseaseAlerts(params.region, params.crop);
                }
                case 'vision':
                    return provider.analyzeImage(params.imageData, params.prompt, params.options);
                case 'video':
                    return provider.analyzeVideo(params.videoData, params.prompt, params.options);
                default:
                    throw new Error(`Unknown request type: ${requestType}`);
            }
        }, params.options?.preferredProvider, {
            promptText: requestType === 'generate'
                ? params.prompt
                : requestType === 'reason'
                    ? buildGroundedReasoningPrompt(params.context || '', params.query || '')
                    : undefined,
        });

        // Normalize OmniRoute free-model fallback result into the standard shape callers expect.
        if (result?.providerUsed && result?.text !== undefined) {
            if (requestType === 'reason') {
                const text = result.text ?? '';
                const visuals = extractVisuals(text);
                const cleanAnswer = text
                    .replace(/<visuals>[\s\S]*?<\/visuals>/gi, '')
                    .replace(/```json[\s\S]*?```/gi, '')
                    .trim();
                return {
                    reasoning: `Synthesized via live AI reasoning (${result.providerUsed}/${result.modelUsed}).`,
                    answer: cleanAnswer,
                    confidence: 0.88,
                    visuals: visuals || { kpis: [], charts: [], images: [], videos: [] },
                    providerUsed: result.providerUsed,
                    modelUsed: result.modelUsed,
                    isFreeModel: result.isFreeModel,
                };
            }
            return { text: result.text, providerUsed: result.providerUsed, modelUsed: result.modelUsed, isFreeModel: result.isFreeModel };
        }
        return result;
    }
}
