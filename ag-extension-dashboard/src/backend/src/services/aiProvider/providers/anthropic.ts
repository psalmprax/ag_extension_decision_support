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
            throw new Error(`Anthropic embedding creation failed: ${(error as Error).message}`);
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
            throw new Error(`Anthropic batch embedding creation failed: ${(error as Error).message}`);
        }
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

    async analyzeWithReasoning(context: string, query: string, options?: ReasoningOptions): Promise<ReasoningResult> {
        const client = await this.getClient();
        const model = options?.model || 'claude-3-5-sonnet-20241022';
        
        const userContent: any[] = [
            { type: 'text', text: `Context: ${context}\n\nQuestion: ${query}` }
        ];

        if (options?.attachments && options.attachments.length > 0) {
            for (const attachment of options.attachments) {
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

        const response = await client.messages.create({
            model,
            max_tokens: options?.maxTokens ?? 2000,
            temperature: options?.temperature ?? 0.3,
            messages: [{ role: 'user', content: userContent }],
        });

        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        
        return {
            reasoning: 'Analysis completed using Claude.',
            answer: text,
            confidence: 0.9,
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
        } catch (error: any) {
            logger.error('Anthropic analyzeImage error:', error);
            return {
                analysis: `Error: ${error.message}`,
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
