/* eslint-disable @typescript-eslint/no-explicit-any */
import { config } from '@/config';
import { logger } from '@/utils/logger';

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
        preferredProvider?: AIProviderType
    ): Promise<any> {
        // Define all available providers for cascading fallback
        let allProviders: AIProviderType[] = Array.from(new Set([
            this.primaryProvider,
            this.fallbackProvider,
            'openai',
            'anthropic',
            'groq',
            'freebuff',
            'ollama'
        ]));

        // If a caller (e.g. free-tier routing) prefers a specific provider,
        // put it at the front of the chain so it's tried first.
        if (preferredProvider) {
            allProviders = Array.from(new Set([preferredProvider, ...allProviders]));
        }

        let lastError: Error | null = null;

        for (const providerType of allProviders) {
            try {
                const provider = await this.getProvider(providerType);
                
                // First check if configured, then check health
                if (!provider.isConfigured()) {
                    logger.debug(`AI provider ${providerType} not configured, skipping...`);
                    continue;
                }

                const isHealthy = await provider.healthCheck();

                if (isHealthy) {
                    logger.info(`Using AI provider: ${providerType}`);
                    return await operation(provider);
                }

                logger.warn(`AI provider ${providerType} unhealthy, trying next...`);
            } catch (error) {
                lastError = error as Error;
                logger.warn(`AI provider ${providerType} failed:`, error);
            }
        }

        logger.error('All AI providers failed');
        throw lastError || new Error('All AI providers failed — no provider is configured or healthy');
    }

    private static async createProvider(type: AIProviderType): Promise<AICapability> {
        switch (type) {
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
        return AIProviderFactory.getWithFallback(async (provider) => {
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
        }, params.options?.preferredProvider);
    }
}
