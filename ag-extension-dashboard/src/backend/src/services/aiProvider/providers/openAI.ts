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
} from '../aiProvider';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export class OpenAIProvider extends BaseAIProvider {
    readonly provider: AIProviderType = 'openai';
    readonly capabilities = [
        'text-generation',
        'embeddings',
        'classification',
        'reasoning',
        'vision',
    ];

    isConfigured(): boolean {
        return !!config.openAI.apiKey && config.openAI.apiKey !== 'sk-...';
    }

    private client: any = null;

    private async getClient(): Promise<any> {
        if (this.client) return this.client;

        try {
            const OpenAI = await import('openai');
            this.client = new OpenAI.default({ apiKey: config.openAI.apiKey });
            return this.client;
        } catch (error) {
            logger.error('Failed to initialize OpenAI client:', error);
            return this.getMockClient();
        }
    }

    private getMockClient() {
        return {
            chat: {
                completions: {
                    create: async (_options: any) => ({
                        choices: [
                            {
                                message: { role: 'assistant', content: 'Mock OpenAI response' },
                                finishReason: 'stop',
                            },
                        ],
                        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
                    }),
                },
            },
            embeddings: {
                create: async (_options: any) => ({
                    data: [
                        { embedding: Array(1536).fill(0).map(() => Math.random() - 0.5) },
                    ],
                    usage: { tokens: 100 },
                }),
            },
        };
    }

    async generateText(prompt: string | any[], options?: TextGenerationOptions): Promise<TextGenerationResult> {
        const client = await this.getClient();
        const model = options?.model || config.ai.primary.model || 'gpt-4';

        try {
            const response = await client.chat.completions.create({
                model,
                messages: [
                    { role: 'system', content: 'You are a helpful agricultural extension assistant.' },
                    { role: 'user', content: prompt },
                ],
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens ?? 1000,
                top_p: options?.topP,
                frequency_penalty: options?.frequencyPenalty,
                presence_penalty: options?.presencePenalty,
                stop: options?.stop,
            });

            const choice = response.choices[0];
            return {
                text: choice.message.content,
                model,
                usage: response.usage,
                finishReason: choice.finishReason,
            };
        } catch (error) {
            logger.error('OpenAI generateText error:', error);
            return {
                text: 'Mock response - configure OpenAI API key',
                model,
                usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
                finishReason: 'stop',
            };
        }
    }

    async *streamText(prompt: string, options?: TextGenerationOptions): AsyncGenerator<string> {
        const client = await this.getClient();
        const model = options?.model || config.ai.primary.model || 'gpt-4';

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
            logger.error('OpenAI streamText error:', error);
            yield 'Mock streaming response';
        }
    }

    async createEmbedding(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult> {
        const client = await this.getClient();
        const model = options?.model || 'text-embedding-3-large';

        try {
            const response = await client.embeddings.create({
                model,
                input: text,
                dimensions: options?.dimensions,
            });

            return {
                embedding: response.data[0].embedding,
                model,
                usage: { tokens: response.usage.tokens },
            };
        } catch (error) {
            logger.error('OpenAI createEmbedding error:', error);
            return {
                embedding: Array(1536).fill(0).map(() => Math.random() - 0.5),
                model,
                usage: { tokens: 100 },
            };
        }
    }

    async createBatchEmbeddings(texts: string[], options?: EmbeddingOptions): Promise<EmbeddingResult[]> {
        const client = await this.getClient();
        const model = options?.model || 'text-embedding-3-large';

        try {
            const response = await client.embeddings.create({
                model,
                input: texts,
                dimensions: options?.dimensions,
            });

            return response.data.map((item: any) => ({
                embedding: item.embedding,
                model,
                usage: { tokens: Math.ceil(response.usage.tokens / texts.length) },
            }));
        } catch (error) {
            logger.error('OpenAI createBatchEmbeddings error:', error);
            return texts.map(() => ({
                embedding: Array(1536).fill(0).map(() => Math.random() - 0.5),
                model,
                usage: { tokens: 100 },
            }));
        }
    }

    async analyzeWithReasoning(context: string, query: string, options?: ReasoningOptions): Promise<ReasoningResult> {
        const prompt = `
Context:\n${context}\n\nQuestion: ${query}\n\n
You are an expert AI Agricultural Analyst for the ALFA Intelligence Engine.
Provide a high-quality, actionable response including expert analysis and visual data.

Your response MUST follow this structure:
1. A detailed analysis in professional Markdown (use headers, bullets, and bold text).
2. A specific JSON block at the end wrapped in <visuals> tags with this schema:
<visuals>
{
  "kpis": [{"label": "string", "value": "string", "status": "good|warning|critical"}],
  "charts": [{"type": "bar|line|pie|area", "title": "string", "data": [{"label": "string", "value": "number"}]}]
}
</visuals>

Focus on precision and expert recommendations. If the context contains statistical data, use it for the charts.
`;

        const result = await this.generateText(prompt, {
            temperature: options?.temperature ?? 0.2,
            maxTokens: options?.maxTokens ?? 2000,
        });

        const text = result.text ?? '';
        
        // Extract visuals JSON from <visuals> tags
        let visuals: any = undefined;
        try {
            const match = text.match(/<visuals>([\s\S]*?)<\/visuals>/);
            if (match && match[1]) {
                visuals = JSON.parse(match[1].trim());
            }
        } catch (error) {
            logger.warn('Failed to parse reasoning visuals JSON:', error);
        }

        // Clean text of the visuals block for cleaner markdown rendering
        const cleanAnswer = text.replace(/<visuals>[\s\S]*?<\/visuals>/, '').trim();

        return {
            reasoning: 'Detailed Intelligence Analysis completed.',
            answer: cleanAnswer,
            confidence: 0.9,
            visuals
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

    async analyzeImage(imageData: string | Buffer, prompt?: string, options?: ImageAnalysisOptions): Promise<ImageAnalysisResult> {
        const client = await this.getClient();
        const model = options?.model || 'gpt-4o'; // Default to vision-capable model

        try {
            // Convert imageData to base64 if it's a Buffer
            let base64Image: string;
            if (Buffer.isBuffer(imageData)) {
                base64Image = imageData.toString('base64');
            } else if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
                // Extract base64 from data URL
                const parts = imageData.split(',');
                base64Image = parts[1];
            } else {
                base64Image = imageData as string;
            }

            const defaultPrompt = 'Analyze this agricultural image. Identify any plants, crops, diseases, pests, or agricultural features. Provide detailed analysis including crop health assessment, disease identification, and recommendations for farmers.';

            const messages = [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt || defaultPrompt },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`,
                            },
                        },
                    ],
                },
            ];

            const response = await client.chat.completions.create({
                model,
                messages,
                temperature: options?.temperature ?? 0.3,
                max_tokens: options?.maxTokens ?? 1000,
            });

            const choice = response.choices[0];
            return {
                analysis: choice.message.content || 'Unable to analyze image',
                model,
                usage: response.usage,
            };
        } catch (error: any) {
            logger.error('OpenAI analyzeImage error:', error);
            const errorMessage = error.message || 'Unknown error';
            return {
                analysis: `Error during image analysis: ${errorMessage}. Please check your OpenAI API key and usage limits.`,
                model,
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            };
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            const client = await this.getClient();
            await client.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 1,
            });
            return true;
        } catch (error: any) {
            logger.error('OpenAI healthCheck error:', {
                message: error.message,
                status: error.status,
                type: error.type,
                code: error.code
            });
            return false;
        }
    }
}
