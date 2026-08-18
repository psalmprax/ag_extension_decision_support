/* eslint-disable @typescript-eslint/no-explicit-any */
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
    ImageAnalysisOptions,
    ImageAnalysisResult,
    VideoAnalysisOptions,
    VideoAnalysisResult,
} from '../types';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { extractVisuals } from '../assetLibrary';

export class AnthropicProvider extends BaseAIProvider {
    readonly provider: AIProviderType = 'anthropic';
    readonly capabilities = [
        'text-generation',
        'embeddings',
        'reasoning',
        'classification',
        'vision',
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
            throw new Error('Anthropic client initialization failed — API key not configured');
        }
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
            throw new Error(`Anthropic text generation failed: ${(error as Error).message}`);
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
            throw new Error(`Anthropic streaming failed: ${(error as Error).message}`);
        }
    }

    async createEmbedding(_text: string, _options?: EmbeddingOptions): Promise<EmbeddingResult> {
        // Anthropic does not offer an embedding API — fail explicitly so fallback chain skips this provider
        throw new Error('Anthropic does not support embeddings. Use OpenAI, Ollama, or Google Vertex instead.');
    }

    async createBatchEmbeddings(_texts: string[], _options?: EmbeddingOptions): Promise<EmbeddingResult[]> {
        throw new Error('Anthropic does not support embeddings. Use OpenAI, Ollama, or Google Vertex instead.');
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

    private buildUserContent(context: string, query: string, attachments?: ReasoningOptions['attachments']): any[] {
        const userContent: any[] = [
            { type: 'text', text: `Context: ${context}\n\nQuestion: ${query}` }
        ];

        if (attachments && attachments.length > 0) {
            for (const attachment of attachments) {
                if (attachment.type === 'image') {
                    let base64Image = attachment.data;
                    if (attachment.data.includes('base64,')) {
                        base64Image = attachment.data.split('base64,')[1];
                    }

                    userContent.push({
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: attachment.mimeType || 'image/jpeg',
                            data: base64Image
                        }
                    });
                }
            }
        }

        return userContent;
    }

    async analyzeWithReasoning(context: string, query: string, options?: ReasoningOptions): Promise<ReasoningResult> {
        const client = await this.getClient();
        const model = options?.model || 'claude-3-5-sonnet-20241022';

        const userContent = this.buildUserContent(context, query, options?.attachments);

        const response = await client.messages.create({
            model,
            max_tokens: options?.maxTokens ?? 2000,
            temperature: options?.temperature ?? 0.3,
            messages: [{ role: 'user', content: userContent }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        const visuals = extractVisuals(text);

        const cleanAnswer = text
            .replace(/<visuals>[\s\S]*?<\/visuals>/gi, '')
            .replace(/```json[\s\S]*?```/gi, '')
            .trim();

        return {
            reasoning: 'Analysis completed using Claude.',
            answer: cleanAnswer,
            confidence: 0.9,
            visuals,
        };
    }

    async analyzeImage(imageData: string | Buffer, prompt?: string, options?: ImageAnalysisOptions): Promise<ImageAnalysisResult> {
        const client = await this.getClient();
        const model = options?.model || 'claude-3-5-sonnet-20241022';

        try {
            let base64Image: string;
            if (Buffer.isBuffer(imageData)) {
                base64Image = imageData.toString('base64');
            } else if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
                base64Image = imageData.split(',')[1];
            } else {
                base64Image = imageData as string;
            }

            const response = await client.messages.create({
                model,
                max_tokens: options?.maxTokens ?? 1000,
                temperature: options?.temperature ?? 0.3,
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt || 'Analyze this agricultural image.' },
                            {
                                type: 'image',
                                source: {
                                    type: 'base64',
                                    media_type: 'image/jpeg',
                                    data: base64Image
                                }
                            }
                        ]
                    }
                ],
            });

            const text = response.content[0].type === 'text' ? response.content[0].text : '';
            
            return {
                analysis: text || 'Unable to analyze image',
                model,
                usage: {
                    promptTokens: response.usage.input_tokens,
                    completionTokens: response.usage.output_tokens,
                    totalTokens: response.usage.input_tokens + response.usage.output_tokens,
                },
            };
        } catch (error) {
            logger.error('Anthropic analyzeImage error:', error);
            return {
                analysis: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
                model,
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            };
        }
    }

    async analyzeVideo(_videoData: Buffer, _prompt?: string, _options?: VideoAnalysisOptions): Promise<VideoAnalysisResult> {
        throw new Error('Video analysis not implemented for Anthropic provider');
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
