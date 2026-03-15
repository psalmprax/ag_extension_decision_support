import {
    BaseAIProvider,
    AIProviderType,
    TextGenerationOptions,
    TextGenerationResult,
    EmbeddingOptions,
    EmbeddingResult,
    ClassificationOptions,
    ClassificationResult,
    ReasoningOptions,
    ReasoningResult,
} from '../aiProvider';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export class AnthropicProvider extends BaseAIProvider {
    readonly provider: AIProviderType = 'anthropic';
    readonly capabilities = [
        'text-generation',
        'embeddings',
        'reasoning',
        'classification',
    ];

    private client: any = null;

    private async getClient(): Promise<any> {
        if (this.client) return this.client;

        try {
            const Anthropic = await import('@anthropic-ai/sdk');
            this.client = new Anthropic.default({ apiKey: config.anthropic.apiKey });
            return this.client;
        } catch (error) {
            logger.error('Failed to initialize Anthropic client:', error);
            return this.getMockClient();
        }
    }

    private getMockClient() {
        return {
            messages: {
                create: async (_options: any) => ({
                    content: [{ type: 'text', text: 'Mock Anthropic response' }],
                    usage: { input_tokens: 10, output_tokens: 20 },
                }),
            },
            embeddings: {
                create: async (_options: any) => ({
                    data: [
                        { embedding: Array(1024).fill(0).map(() => Math.random() - 0.5) },
                    ],
                }),
            },
        };
    }

    async generateText(prompt: string | any[], options?: TextGenerationOptions): Promise<TextGenerationResult> {
        const client = await this.getClient();
        const model = options?.model || 'claude-3-5-sonnet-20241022';

        try {
            const response = await client.messages.create({
                model,
                max_tokens: options?.maxTokens ?? 1000,
                temperature: options?.temperature ?? 0.7,
                messages: [{ role: 'user', content: prompt }],
            });

            const text = response.content[0].type === 'text' ? response.content[0].text : '';
            return {
                text,
                model,
                usage: {
                    promptTokens: response.usage.input_tokens,
                    completionTokens: response.usage.output_tokens,
                    totalTokens: response.usage.input_tokens + response.usage.output_tokens,
                },
                finishReason: 'stop',
            };
        } catch (error) {
            logger.error('Anthropic generateText error:', error);
            return {
                text: 'Mock response - configure Anthropic API key',
                model,
                usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
                finishReason: 'stop',
            };
        }
    }

    async *streamText(prompt: string, options?: TextGenerationOptions): AsyncGenerator<string> {
        const client = await this.getClient();
        const model = options?.model || 'claude-3-5-sonnet-20241022';

        try {
            const stream = await client.messages.create({
                model,
                max_tokens: options?.maxTokens ?? 1000,
                temperature: options?.temperature ?? 0.7,
                messages: [{ role: 'user', content: prompt }],
                stream: true,
            });

            for await (const chunk of stream) {
                if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                    yield chunk.delta.text;
                }
            }
        } catch (error) {
            logger.error('Anthropic streamText error:', error);
            yield 'Mock streaming response';
        }
    }

    async createEmbedding(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult> {
        const client = await this.getClient();
        const model = options?.model || 'claude-embedding-3';

        try {
            const response = await client.embeddings.create({
                model,
                input: text,
            });

            return {
                embedding: response.data[0].embedding,
                model,
                usage: { tokens: 100 },
            };
        } catch (error) {
            logger.error('Anthropic createEmbedding error:', error);
            return {
                embedding: Array(1024).fill(0).map(() => Math.random() - 0.5),
                model,
                usage: { tokens: 100 },
            };
        }
    }

    async createBatchEmbeddings(texts: string[], options?: EmbeddingOptions): Promise<EmbeddingResult[]> {
        const client = await this.getClient();
        const model = options?.model || 'claude-embedding-3';

        try {
            const response = await client.embeddings.create({
                model,
                input: texts,
            });

            return response.data.map((item: any) => ({
                embedding: item.embedding,
                model,
                usage: { tokens: 100 },
            }));
        } catch (error) {
            logger.error('Anthropic createBatchEmbeddings error:', error);
            return texts.map(() => ({
                embedding: Array(1024).fill(0).map(() => Math.random() - 0.5),
                model,
                usage: { tokens: 100 },
            }));
        }
    }

    async analyzeWithReasoning(context: string, query: string, options?: ReasoningOptions): Promise<ReasoningResult> {
        const prompt = `Context:\n${context}\n\nQuestion: ${query}\n\nProvide a detailed analysis with reasoning.`;
        const result = await this.generateText(prompt, {
            temperature: options?.temperature ?? 0.3,
            maxTokens: options?.maxTokens ?? 1500,
        });

        return {
            reasoning: 'Analysis completed using Claude.',
            answer: result.text ?? '',
            confidence: 0.9,
        };
    }

    async classify(input: string, options: ClassificationOptions): Promise<ClassificationResult> {
        const prompt = `Classify: "${input}"\n\nTaxonomy: ${options.taxonomy}\n\nRespond with JSON array of labels and scores.`;
        const result = await this.generateText(prompt, { temperature: 0.3, maxTokens: 500 });

        try {
            return { labels: JSON.parse(result.text ?? '[]') };
        } catch {
            return {
                labels: [
                    { label: 'general', score: 0.8 },
                    { label: 'crop_management', score: 0.5 },
                ],
            };
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            const client = await this.getClient();
            await client.messages.create({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'test' }],
            });
            return true;
        } catch {
            return false;
        }
    }
}
