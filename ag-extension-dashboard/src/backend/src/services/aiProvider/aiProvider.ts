import { config } from '@/config';
import { logger } from '@/utils/logger';

// Provider types
export type AIProviderType = 'azure_openai' | 'google_vertex' | 'openai' | 'anthropic' | 'groq' | 'ollama';

// Capability interfaces
export interface TextGenerationOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
    stop?: string[];
    tools?: any[];
}

export interface TextGenerationResult {
    text: string | null;
    toolCalls?: any[];
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    finishReason?: string;
}

export interface EmbeddingOptions {
    model?: string;
    dimensions?: number;
}

export interface EmbeddingResult {
    embedding: number[];
    model: string;
    usage?: {
        tokens: number;
    };
}

export interface SpeechToTextOptions {
    language?: string;
    model?: string;
}

export interface SpeechToTextResult {
    text: string;
    language?: string;
    confidence?: number;
}

export interface TextToSpeechOptions {
    voice?: string;
    language?: string;
    speed?: number;
}

export interface TextToSpeechResult {
    audio: Buffer;
    format: string;
}

export interface ClassificationOptions {
    taxonomy: string;
    multiLabel?: boolean;
}

export interface ClassificationResult {
    labels: Array<{
        label: string;
        score: number;
    }>;
}

export interface ReasoningOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    attachments?: Array<{ type: 'image' | 'file' | 'audio'; data: string; mimeType?: string }>;
}

export interface ReasoningResult {
    reasoning: string;
    answer: string;
    confidence?: number;
    audio?: string; // Base64 or URL for TTS
    visuals?: {
        kpis?: Array<{ label: string; value: string; status: 'good' | 'warning' | 'critical' }>;
        charts?: Array<{
            type: 'bar' | 'line' | 'pie' | 'area';
            title: string;
            data: Array<{ label: string; value: number }>;
        }>;
        images?: Array<{ url: string; caption?: string }>;
        videos?: Array<{ url: string; caption?: string }>;
    };
}

export interface ImageAnalysisOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
}

export interface ImageAnalysisResult {
    analysis: string;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

export interface VideoAnalysisOptions {
    model?: string;
    maxTokens?: number;
    temperature?: number;
    frameInterval?: number; // Seconds between frames
    maxFrames?: number;
}

export interface VideoAnalysisResult {
    analysis: string;
    framesAnalyzed: number;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

// Base capability interface
export interface AICapability {
    readonly provider: AIProviderType;
    readonly capabilities: string[];

    // Configuration and Health
    isConfigured(): boolean;
    healthCheck(): Promise<boolean>;

    // Text generation - support both prompt string and message array
    generateText(prompt: string | any[], options?: TextGenerationOptions): Promise<TextGenerationResult>;
    streamText(prompt: string, options?: TextGenerationOptions): AsyncGenerator<string>;

    // Embeddings
    createEmbedding(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult>;
    createBatchEmbeddings(texts: string[], options?: EmbeddingOptions): Promise<EmbeddingResult[]>;

    // Speech
    speechToText(audio: Buffer, options?: SpeechToTextOptions): Promise<SpeechToTextResult>;
    textToSpeech(text: string, options?: TextToSpeechOptions): Promise<TextToSpeechResult>;

    // Reasoning
    analyzeWithReasoning(context: string, query: string, options?: ReasoningOptions): Promise<ReasoningResult>;

    // Classification
    classify(input: string, options: ClassificationOptions): Promise<ClassificationResult>;

    // Image analysis
    analyzeImage(imageData: string | Buffer, prompt?: string, options?: ImageAnalysisOptions): Promise<ImageAnalysisResult>;
    
    // Video analysis
    analyzeVideo(videoData: Buffer, prompt?: string, options?: VideoAnalysisOptions): Promise<VideoAnalysisResult>;

}

// Abstract base class for AI providers
export abstract class BaseAIProvider implements AICapability {
    abstract readonly provider: AIProviderType;
    abstract readonly capabilities: string[];

    isConfigured(): boolean {
        return false;
    }

    async generateText(_messages: any[], _options?: TextGenerationOptions): Promise<TextGenerationResult> {
        throw new Error('Method not implemented');
    }

    async *streamText(_prompt: string, _options?: TextGenerationOptions): AsyncGenerator<string> {
        throw new Error('Method not implemented');
    }

    async createEmbedding(_text: string, _options?: EmbeddingOptions): Promise<EmbeddingResult> {
        throw new Error('Method not implemented');
    }

    async createBatchEmbeddings(_texts: string[], _options?: EmbeddingOptions): Promise<EmbeddingResult[]> {
        throw new Error('Method not implemented');
    }

    async speechToText(_audio: Buffer, _options?: SpeechToTextOptions): Promise<SpeechToTextResult> {
        throw new Error('Method not implemented');
    }

    async textToSpeech(_text: string, _options?: TextToSpeechOptions): Promise<TextToSpeechResult> {
        throw new Error('Method not implemented');
    }

    async analyzeWithReasoning(_context: string, _query: string, _options?: ReasoningOptions): Promise<ReasoningResult> {
        throw new Error('Method not implemented');
    }

    async classify(_input: string, _options: ClassificationOptions): Promise<ClassificationResult> {
        throw new Error('Method not implemented');
    }

    async analyzeImage(_imageData: string | Buffer, _prompt?: string, _options?: ImageAnalysisOptions): Promise<ImageAnalysisResult> {
        throw new Error('Method not implemented');
    }

    async analyzeVideo(_videoData: Buffer, _prompt?: string, _options?: VideoAnalysisOptions): Promise<VideoAnalysisResult> {
        throw new Error('Method not implemented');
    }

    async healthCheck(): Promise<boolean> {
        return true;
    }
}

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
        operation: (provider: AICapability) => Promise<any>
    ): Promise<any> {
        // Define all available providers for cascading fallback
        const allProviders: AIProviderType[] = Array.from(new Set([
            this.primaryProvider,
            this.fallbackProvider,
            'openai',
            'anthropic',
            'groq',
            'ollama'
        ]));

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
            case 'azure_openai':
                const { AzureOpenAIProvider } = await import('./providers/azureOpenAI');
                return new AzureOpenAIProvider();
            case 'google_vertex':
                const { GoogleVertexProvider } = await import('./providers/googleVertex');
                return new GoogleVertexProvider();
            case 'openai':
                const { OpenAIProvider } = await import('./providers/openAI');
                return new OpenAIProvider();
            case 'anthropic':
                const { AnthropicProvider } = await import('./providers/anthropic');
                return new AnthropicProvider();
            case 'groq':
                const { GroqProvider } = await import('./providers/groq');
                return new GroqProvider();
            case 'ollama':
                const { OllamaProvider } = await import('./providers/ollama');
                return new OllamaProvider();
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
                case 'weather':
                    const { WeatherService } = await import('@/services/weatherService');
                    return WeatherService.getByLocation(params.location);
                case 'disease_alerts':
                    const { FAOService } = await import('@/services/faoService');
                    return FAOService.getDiseaseAlerts(params.region, params.crop);
                case 'vision':
                    return provider.analyzeImage(params.imageData, params.prompt, params.options);
                case 'video':
                    return provider.analyzeVideo(params.videoData, params.prompt, params.options);
                default:
                    throw new Error(`Unknown request type: ${requestType}`);
            }
        });
    }
}
