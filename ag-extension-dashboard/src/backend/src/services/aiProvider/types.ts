/* eslint-disable @typescript-eslint/no-explicit-any */

// ── Provider type identifier ──────────────────────────────────────────────

export type AIProviderType = 'azure_openai' | 'google_vertex' | 'openai' | 'anthropic' | 'groq' | 'ollama';

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

    async generateText(_messages: any[], _options?: TextGenerationOptions): Promise<TextGenerationResult> {
        throw new Error('Method not implemented');
    }

    // eslint-disable-next-line require-yield
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
