/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    BaseAIProvider,
    AIProviderType,
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
} from '../types';
import { logger } from '@/utils/logger';
import { config } from '@/config';

/**
 * FreebuffProvider — best-effort free LLM access via the community Freebuff2API proxy.
 *
 * WARNING: Freebuff2API is a community-maintained proxy, not an official API.
 * No SLA, may rate-limit or go offline without notice. This provider is wired into
 * the fallback chain as a last-resort before the local Ollama provider, never as
 * the primary. It exposes text-generation + streaming only.
 *
 * Configuration is read from `config.freebuff.*` (canonical schema in
 * src/config/index.ts) with a `process.env.FREEBUFF_*` fallback so tests can
 * override the values per-test via `process.env` without having to remock
 * the config module.
 */
export class FreebuffProvider extends BaseAIProvider {
    readonly provider: AIProviderType = 'freebuff';
    readonly capabilities = ['text-generation', 'reasoning'];

    private client: any = null;

    /**
     * Resolved freebuff config snapshot.
     *
     * Precedence: process.env > config.freebuff.* > literal default.
     * Env wins because docker-compose / .env files are the canonical
     * deployment surface; the typed config block exists as a fallback
     * for in-process overrides (tests, runtime config mutation).
     */
    getResolvedConfig() {
        return {
            authToken: process.env.FREEBUFF_AUTH_TOKEN || config.freebuff.authToken || '',
            apiBaseUrl: process.env.FREEBUFF_API_BASE_URL || config.freebuff.apiBaseUrl || '',
            defaultModel: process.env.FREEBUFF_DEFAULT_MODEL || config.freebuff.defaultModel || 'deepseek-chat',
        };
    }

    isConfigured(): boolean {
        const { authToken, apiBaseUrl } = this.getResolvedConfig();
        return !!authToken && !!apiBaseUrl;
    }

    private async getClient(): Promise<any> {
        if (this.client) return this.client;
        try {
            const { authToken, apiBaseUrl } = this.getResolvedConfig();
            const OpenAI = await import('openai');
            this.client = new OpenAI.default({
                apiKey: authToken,
                baseURL: apiBaseUrl,
                timeout: 30_000,
                maxRetries: 1,
            });
            return this.client;
        } catch (error) {
            logger.error('Failed to initialize Freebuff client:', error);
            throw new Error('Freebuff client initialization failed — openai package missing?');
        }
    }

    async generateText(
        prompt: string | any[],
        options?: TextGenerationOptions
    ): Promise<TextGenerationResult> {
        const client = await this.getClient();
        const model = options?.model || this.getResolvedConfig().defaultModel;

        let messages: any[];
        if (Array.isArray(prompt) && prompt.length > 0 && typeof prompt[0] === 'object' && 'role' in prompt[0]) {
            messages = prompt;
        } else {
            messages = [
                {
                    role: 'system',
                    content: 'You are a helpful agricultural extension assistant.',
                },
                { role: 'user', content: prompt },
            ];
        }

        try {
            const response = await client.chat.completions.create({
                model,
                messages,
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens ?? 1000,
            });

            const choice = response.choices[0];
            return {
                text: choice.message.content,
                model,
                usage: response.usage,
                finishReason: choice.finishReason,
            };
        } catch (error) {
            logger.error('Freebuff generateText error:', error);
            throw new Error(
                `Freebuff text generation failed: ${(error as Error).message}`
            );
        }
    }

    async *streamText(
        prompt: string,
        options?: TextGenerationOptions
    ): AsyncGenerator<string> {
        const client = await this.getClient();
        const model = options?.model || this.getResolvedConfig().defaultModel;

        try {
            const stream = await client.chat.completions.create({
                model,
                messages: [{ role: 'user', content: prompt }],
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens ?? 1000,
                stream: true,
            });

            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content;
                if (content) yield content;
            }
        } catch (error) {
            logger.error('Freebuff streamText error:', error);
            throw new Error(`Freebuff streaming failed: ${(error as Error).message}`);
        }
    }

    /**
     * Lightweight health check — hits /v1/models (no tokens spent, validates auth + URL).
     */
    async healthCheck(): Promise<boolean> {
        try {
            const client = await this.getClient();
            await client.models.list();
            this.recordHealthError();
            return true;
        } catch (error) {
            logger.warn('Freebuff healthCheck failed (community proxy may be down):', error);
            this.recordHealthError(error instanceof Error ? error.message : String(error));
            return false;
        }
    }

    // Not supported by the free proxy — these methods fall through to BaseAIProvider.

    async createEmbedding(_text: string, _options?: EmbeddingOptions): Promise<EmbeddingResult> {
        throw new Error('Freebuff does not support embeddings');
    }

    async createBatchEmbeddings(
        _texts: string[],
        _options?: EmbeddingOptions
    ): Promise<EmbeddingResult[]> {
        throw new Error('Freebuff does not support embeddings');
    }

    async speechToText(_audio: Buffer, _options?: SpeechToTextOptions): Promise<SpeechToTextResult> {
        throw new Error('Freebuff does not support speech-to-text');
    }

    async textToSpeech(_text: string, _options?: TextToSpeechOptions): Promise<TextToSpeechResult> {
        throw new Error('Freebuff does not support text-to-speech');
    }

    async analyzeWithReasoning(
        context: string,
        query: string,
        options?: ReasoningOptions
    ): Promise<ReasoningResult> {
        const groundedPrompt = `Use the context below as the authoritative source for this answer. If the context is incomplete, say what is missing before adding general agricultural guidance. Cite source titles or URLs when available.\n\nContext:\n${context || 'No specific context found in knowledge base.'}\n\nQuestion: ${query}`;
        const result = await this.generateText(groundedPrompt, {
            temperature: options?.temperature ?? 0.3,
            maxTokens: options?.maxTokens ?? 2000,
        });
        return {
            reasoning: 'Freebuff best-effort answer (community proxy).',
            answer: result.text ?? '',
            confidence: 0.7,
            visuals: undefined,
        };
    }

    async classify(_input: string, _options: ClassificationOptions): Promise<ClassificationResult> {
        throw new Error('Freebuff does not support classification');
    }

    async analyzeImage(
        _imageData: string | Buffer,
        _prompt?: string,
        _options?: ImageAnalysisOptions
    ): Promise<ImageAnalysisResult> {
        throw new Error('Freebuff does not support image analysis');
    }

}
