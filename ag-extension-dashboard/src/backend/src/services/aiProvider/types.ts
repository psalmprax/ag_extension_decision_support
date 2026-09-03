/* eslint-disable @typescript-eslint/no-explicit-any */

import { extractVideoFrames } from './videoFrameService';

// ── Provider type identifier ──────────────────────────────────────────────

export type AIProviderType =
  | 'azure_openai'
  | 'google_vertex'
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'freebuff'
  | 'ollama'
  | 'aihubmix'
  | 'openrouter'
  | 'nvidia'
  | 'huggingface';

// ── Capability interfaces ─────────────────────────────────────────────────

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
    preferredProvider?: AIProviderType | string;
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
    preferredProvider?: AIProviderType | string;
}

export interface ReasoningResult {
    reasoning: string;
    answer: string;
    confidence?: number;
    audio?: string;
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
    frameInterval?: number;
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

// ── Base capability interface ─────────────────────────────────────────────

export interface AICapability {
    readonly provider: AIProviderType;
    readonly capabilities: string[];

    isConfigured(): boolean;
    healthCheck(): Promise<boolean>;
    /**
     * Optional human-readable reason for the most recent failed healthCheck.
     * Returns undefined when the provider is healthy or has never been probed.
     * Used by the /api/health endpoint to surface *why* a provider is degraded
     * (e.g. "401 invalid api key" vs "404 model not found" vs "429 rate limit").
     */
    getLastHealthError?(): string | undefined;

    generateText(prompt: string | any[], options?: TextGenerationOptions): Promise<TextGenerationResult>;
    streamText(prompt: string, options?: TextGenerationOptions): AsyncGenerator<string>;

    createEmbedding(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult>;
    createBatchEmbeddings(texts: string[], options?: EmbeddingOptions): Promise<EmbeddingResult[]>;

    speechToText(audio: Buffer, options?: SpeechToTextOptions): Promise<SpeechToTextResult>;
    textToSpeech(text: string, options?: TextToSpeechOptions): Promise<TextToSpeechResult>;

    analyzeWithReasoning(context: string, query: string, options?: ReasoningOptions): Promise<ReasoningResult>;
    classify(input: string, options: ClassificationOptions): Promise<ClassificationResult>;

    analyzeImage(imageData: string | Buffer, prompt?: string, options?: ImageAnalysisOptions): Promise<ImageAnalysisResult>;
    analyzeVideo(videoData: Buffer, prompt?: string, options?: VideoAnalysisOptions): Promise<VideoAnalysisResult>;
}

// ── Abstract base class ───────────────────────────────────────────────────


export abstract class BaseAIProvider implements AICapability {
    abstract readonly provider: AIProviderType;
    abstract readonly capabilities: string[];

    isConfigured(): boolean {
        return false;
    }

    /**
     * Base default: throw so the provider fallback chain (`getWithFallback`)
     * can try the next provider. Returning an empty result here would look
     * like success and silently corrupt downstream answers.
     * Providers that support text generation must override this method.
     */
    async generateText(_messages: any[], _options?: TextGenerationOptions): Promise<TextGenerationResult> {
        throw new Error(`${this.provider} does not support text generation. Use a provider that lists it in capabilities.`);
    }

    /**
     * Base default: throw so callers fail loudly instead of streaming nothing.
     * Providers that support streaming must override this method.
     */
    // eslint-disable-next-line require-yield
    async *streamText(_prompt: string, _options?: TextGenerationOptions): AsyncGenerator<string> {
        throw new Error(`${this.provider} does not support streaming. Use a provider that lists it in capabilities.`);
        // eslint-disable-next-line @typescript-eslint/no-unreachable
        yield '';
    }

    /**
     * Base default: throw — an empty/zero vector would poison similarity
     * search. Providers that support embeddings must override this method.
     */
    async createEmbedding(_text: string, _options?: EmbeddingOptions): Promise<EmbeddingResult> {
        throw new Error(`${this.provider} does not support embeddings. Use OpenAI, Ollama, or Google Vertex instead.`);
    }

    /**
     * Base default: throw (see createEmbedding).
     * Providers that support embeddings must override this method.
     */
    async createBatchEmbeddings(_texts: string[], _options?: EmbeddingOptions): Promise<EmbeddingResult[]> {
        throw new Error(`${this.provider} does not support embeddings. Use OpenAI, Ollama, or Google Vertex instead.`);
    }

    /**
     * Base default: throw — an empty transcription would corrupt agronomic
     * advice. Providers that support speech recognition must override this.
     */
    async speechToText(_audio: Buffer, _options?: SpeechToTextOptions): Promise<SpeechToTextResult> {
        throw new Error(`${this.provider} does not support speech-to-text. Use a provider that lists it in capabilities.`);
    }

    /**
     * Base default: throw — empty audio would present as a successful
     * synthesis. Providers that support speech synthesis must override this.
     */
    async textToSpeech(_text: string, _options?: TextToSpeechOptions): Promise<TextToSpeechResult> {
        throw new Error(`${this.provider} does not support text-to-speech. Use a provider that lists it in capabilities.`);
    }

    /**
     * Base default: throw instead of returning a canned "no answer".
     * Providers that support reasoning must override this method.
     */
    async analyzeWithReasoning(_context: string, _query: string, _options?: ReasoningOptions): Promise<ReasoningResult> {
        throw new Error(`${this.provider} does not support reasoning analysis. Use a provider that lists it in capabilities.`);
    }

    /**
     * Base default: throw — an empty label set would look like a successful
     * classification. Providers that support classification must override this.
     */
    async classify(_input: string, _options: ClassificationOptions): Promise<ClassificationResult> {
        throw new Error(`${this.provider} does not support classification. Use a provider that lists it in capabilities.`);
    }

    /**
     * Base default: throw — a canned "not implemented" string would flow into
     * diagnosis parsing as if it were a model answer. Providers that support
     * vision must override this method.
     */
    async analyzeImage(_imageData: string | Buffer, _prompt?: string, _options?: ImageAnalysisOptions): Promise<ImageAnalysisResult> {
        throw new Error(`${this.provider} does not support image analysis. Use a provider that lists vision in capabilities.`);
    }

    async analyzeVideo(videoData: Buffer, prompt?: string, options?: VideoAnalysisOptions): Promise<VideoAnalysisResult> {
        if (!this.capabilities.includes('vision')) {
            throw new Error(`${this.provider} does not support video analysis because it has no vision capability`);
        }

        const frames = await extractVideoFrames(videoData, options);
        const frameAnalyses = await Promise.all(
            frames.map((frame, index) => this.analyzeImage(
                frame,
                `${prompt || 'Analyze this agricultural video frame.'} This is frame ${index + 1} of ${frames.length}. Describe only visible evidence and distinguish observations from uncertainty.`,
                options,
            )),
        );
        const analysis = frameAnalyses
            .map((result, index) => `Frame ${index + 1}: ${result.analysis}`)
            .join('\n\n');
        const usage = frameAnalyses.reduce(
            (total, result) => ({
                promptTokens: total.promptTokens + (result.usage?.promptTokens ?? 0),
                completionTokens: total.completionTokens + (result.usage?.completionTokens ?? 0),
                totalTokens: total.totalTokens + (result.usage?.totalTokens ?? 0),
            }),
            { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        );

        return {
            analysis,
            framesAnalyzed: frames.length,
            model: options?.model || frameAnalyses[0]?.model || this.provider,
            usage,
        };
    }

    private lastHealthError: string | undefined;

    /**
     * Records the reason a healthCheck failed so diagnostics can surface it.
     * Call with a reason inside the catch block of a provider healthCheck, or
     * with no argument to clear the error on a successful probe.
     */
    protected recordHealthError(reason?: string): void {
        this.lastHealthError = reason || undefined;
    }

    getLastHealthError(): string | undefined {
        return this.lastHealthError;
    }

    async healthCheck(): Promise<boolean> {
        return true;
    }
}
