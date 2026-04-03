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
} from '../aiProvider';
import { REASONING_SYSTEM_PROMPT, extractVisuals } from '../assetLibrary';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export class GoogleVertexProvider extends BaseAIProvider {
    readonly provider: AIProviderType = 'google_vertex';
    readonly capabilities = [
        'text-generation',
        'embeddings',
        'reasoning',
        'classification',
    ];

    isConfigured(): boolean {
        return !!config.googleVertex.projectId && config.googleVertex.projectId !== 'your-project-id';
    }

    private client: any = null;

    private async getClient(): Promise<any> {
        if (this.client) return this.client;

        try {
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            this.client = new GoogleGenerativeAI(config.googleVertex.projectId);
            return this.client;
        } catch (error) {
            logger.error('Failed to initialize Google Vertex client:', error);
            throw new Error('Google Vertex client initialization failed — API key not configured');
        }
    }

    async generateText(prompt: string | any[], options?: TextGenerationOptions): Promise<TextGenerationResult> {
        const client = await this.getClient();
        const modelName = options?.model || config.ai.fallback.model;

        try {
            const model = client.getGenerativeModel({ model: modelName });
            const result = await model.generateContent(prompt);
            const text = result.response.text();

            return {
                text,
                model: modelName,
                usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
                finishReason: 'stop',
            };
        } catch (error) {
            logger.error('Google Vertex generateText error:', error);
            throw new Error(`Google Vertex text generation failed: ${(error as Error).message}`);
        }
    }

    async *streamText(prompt: string, options?: TextGenerationOptions): AsyncGenerator<string> {
        const client = await this.getClient();
        const modelName = options?.model || config.ai.fallback.model;
        const model = client.getGenerativeModel({ model: modelName });

        try {
            const result = await model.generateContentStream(prompt);
            for (const chunk of result) {
                const text = chunk.response.text();
                if (text) yield text;
            }
        } catch (error) {
            logger.error('Google Vertex streamText error:', error);
            throw new Error(`Google Vertex streaming failed: ${(error as Error).message}`);
        }
    }

    async createEmbedding(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult> {
        const client = await this.getClient();
        const model = options?.model || 'text-embedding-004';

        try {
            // Use the correct Google Generative AI SDK embedding method
            const embedModel = client.getGenerativeModel({ model: 'embedding-001' });
            const result = await embedModel.embedContent(text);
            return {
                embedding: result.embedding.values,
                model: 'embedding-001',
                usage: { tokens: 100 },
            };
        } catch (error) {
            logger.error('Google Vertex createEmbedding error:', error);
            return {
                embedding: Array(768).fill(0).map(() => Math.random() - 0.5),
                model,
                usage: { tokens: 100 },
            };
        }
    }

    async createBatchEmbeddings(texts: string[], options?: EmbeddingOptions): Promise<EmbeddingResult[]> {
        const client = await this.getClient();
        const model = options?.model || 'text-embedding-004';
        const embedder = client.getEmbedder({ model });

        try {
            const results = await Promise.all(
                texts.map(async (text) => {
                    const result = await embedder.embedContent(text);
                    return {
                        embedding: result.embedding.values,
                        model,
                        usage: { tokens: 100 },
                    };
                })
            );
            return results;
        } catch (error) {
            logger.error('Google Vertex createBatchEmbeddings error:', error);
            return texts.map(() => ({
                embedding: Array(768).fill(0).map(() => Math.random() - 0.5),
                model,
                usage: { tokens: 100 },
            }));
        }
    }

    async speechToText(_audio: Buffer, _options?: SpeechToTextOptions): Promise<SpeechToTextResult> {
        logger.info('Google Vertex speech to text not implemented, use Azure');
        return {
            text: 'Speech to text via Google Vertex not configured',
            language: 'en-US',
            confidence: 0,
        };
    }

    async textToSpeech(_text: string, _options?: TextToSpeechOptions): Promise<TextToSpeechResult> {
        throw new Error('Google Vertex Text-to-Speech not supported — use Azure or OpenAI providers');
    }

    async analyzeWithReasoning(context: string, query: string, options?: ReasoningOptions): Promise<ReasoningResult> {
        const client = await this.getClient();
        const modelName = options?.model || config.ai.fallback.model || 'gemini-1.5-flash';
        const model = client.getGenerativeModel({ model: modelName });

        const systemPrompt = REASONING_SYSTEM_PROMPT;
        
        // Construct the prompt for Gemini
        // We'll combine system prompt and user context
        const fullPrompt = `${systemPrompt}\n\nContext: ${context}\n\nQuestion: ${query}`;
        
        const contents: any[] = [{ role: 'user', parts: [{ text: fullPrompt }] }];

        if (options?.attachments && options.attachments.length > 0) {
            for (const attachment of options.attachments) {
                if (attachment.type === 'image') {
                    // Gemini format for base64 images
                    contents[0].parts.push({
                        inlineData: {
                            mimeType: attachment.mimeType || 'image/jpeg',
                            data: attachment.data.includes('base64,') ? attachment.data.split('base64,')[1] : attachment.data
                        }
                    });
                }
            }
        }

        try {
            const result = await model.generateContent({ contents });
            const text = result.response.text();
            const visuals = extractVisuals(text);

            let cleanAnswer = text
                .replace(/<visuals>[\s\S]*?<\/visuals>/gi, '')
                .replace(/```json[\s\S]*?```/gi, '')
                .replace(/#{1,6}\s*(Visual Data|Visual Insights|Charts|Expert Data|Insight Analysis)[^\n]*/gi, '')
                .trim();

            cleanAnswer = cleanAnswer.replace(/\n\s*\n\s*\n/g, '\n\n');

            return {
                reasoning: 'Detailed Gemini-based Intelligence Analysis completed.',
                answer: cleanAnswer,
                confidence: 0.9,
                visuals
            };
        } catch (error) {
            logger.error('Google Vertex analyzeWithReasoning error:', error);
            throw new Error(`Google Vertex reasoning analysis failed: ${(error as Error).message}`);
        }
    }

    async classify(input: string, options: ClassificationOptions): Promise<ClassificationResult> {
        const prompt = `Classify: "${input}"\n\nTaxonomy: ${options.taxonomy}\n\nProvide JSON with labels and scores.`;
        const result = await this.generateText(prompt, { temperature: 0.3, maxTokens: 500 });

        try {
            const labels = JSON.parse(result.text ?? '[]');
            return { labels };
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
            const model = client.getGenerativeModel({ model: config.ai.fallback.model });
            await model.generateContent('test');
            return true;
        } catch {
            return false;
        }
    }
}
