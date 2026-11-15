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
        'vision',
    ];

    isConfigured(): boolean {
        return !!config.googleVertex.projectId && config.googleVertex.projectId !== 'your-project-id';
    }

    private client: any = null;

    private async getClient(): Promise<any> {
        if (this.client) return this.client;
        if (!this.isConfigured()) {
            throw new Error('Google Vertex client initialization failed — Project ID not configured');
        }

        try {
            // @google/generative-ai was deprecated in favour of @google/genai.
            // The same credential is kept: GOOGLE_VERTEX_PROJECT_ID has always
            // carried the API key for this provider (see config.googleVertex).
            const { GoogleGenAI } = await import('@google/genai');
            this.client = new GoogleGenAI({ apiKey: config.googleVertex.projectId });
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
            const result = await client.models.generateContent({ model: modelName, contents: prompt });
            const text = result.text ?? '';

            return {
                text,
                model: modelName,
                usage: {
                    promptTokens: result.usageMetadata?.promptTokenCount ?? 0,
                    completionTokens: result.usageMetadata?.candidatesTokenCount ?? 0,
                    totalTokens: result.usageMetadata?.totalTokenCount ?? 0,
                },
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

        try {
            const stream = await client.models.generateContentStream({ model: modelName, contents: prompt });
            for await (const chunk of stream) {
                const text = chunk.text;
                if (text) yield text;
            }
        } catch (error) {
            logger.error('Google Vertex streamText error:', error);
            throw new Error(`Google Vertex streaming failed: ${(error as Error).message}`);
        }
    }

    async createEmbedding(text: string, _options?: EmbeddingOptions): Promise<EmbeddingResult> {
        const client = await this.getClient();
        // Model selection not needed - using embedded model directly below

        try {
            // embedding-001 was retired with the old SDK; gemini-embedding-001 is
            // the current Gemini API embedding model.
            const result = await client.models.embedContent({ model: 'gemini-embedding-001', contents: text });
            return {
                embedding: result.embeddings?.[0]?.values ?? [],
                model: 'gemini-embedding-001',
                usage: { tokens: 100 },
            };
        } catch (error) {
            logger.error('Google Vertex createEmbedding error:', error);
            throw new Error(`Google Vertex embedding creation failed: ${(error as Error).message}`);
        }
    }

    async createBatchEmbeddings(texts: string[], options?: EmbeddingOptions): Promise<EmbeddingResult[]> {
        const client = await this.getClient();
        const model = options?.model || 'gemini-embedding-001';

        try {
            const result = await client.models.embedContent({ model, contents: texts });
            return (result.embeddings ?? []).map((item: any) => ({
                embedding: item.values ?? [],
                model,
                usage: { tokens: 0 },
            }));
        } catch (error) {
            logger.error('Google Vertex createBatchEmbeddings error:', error);
            throw new Error(`Google Vertex batch embedding creation failed: ${(error as Error).message}`);
        }
    }

    async speechToText(_audio: Buffer, _options?: SpeechToTextOptions): Promise<SpeechToTextResult> {
        throw new Error('Google Vertex speech-to-text not supported — use Azure or OpenAI providers');
    }

    async textToSpeech(_text: string, _options?: TextToSpeechOptions): Promise<TextToSpeechResult> {
        throw new Error('Google Vertex Text-to-Speech not supported — use Azure or OpenAI providers');
    }

    async analyzeWithReasoning(context: string, query: string, options?: ReasoningOptions): Promise<ReasoningResult> {
        const client = await this.getClient();
        const modelName = options?.model || config.ai.fallback.model || 'gemini-flash-latest';

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
            const result = await client.models.generateContent({ model: modelName, contents });
            const text = result.text ?? '';
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
            throw new Error('Failed to parse Google Vertex classification response');
        }
    }

    async analyzeImage(imageData: string | Buffer, prompt?: string, options?: ImageAnalysisOptions): Promise<ImageAnalysisResult> {
        const client = await this.getClient();
        const modelName = options?.model || config.ai.fallback.model || 'gemini-flash-latest';

        try {
            let base64Image: string;
            if (Buffer.isBuffer(imageData)) {
                base64Image = imageData.toString('base64');
            } else if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
                base64Image = imageData.split(',')[1];
            } else {
                base64Image = imageData as string;
            }

            const contents = [
                {
                    role: 'user',
                    parts: [
                        { text: prompt || 'Analyze this agricultural image.' },
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: base64Image
                            }
                        }
                    ]
                }
            ];

            const result = await client.models.generateContent({ model: modelName, contents });

            return {
                analysis: result.text || 'Unable to analyze image',
                model: modelName,
                usage: {
                    promptTokens: result.usageMetadata?.promptTokenCount ?? 0,
                    completionTokens: result.usageMetadata?.candidatesTokenCount ?? 0,
                    totalTokens: result.usageMetadata?.totalTokenCount ?? 0,
                },
            };
        } catch (error) {
            logger.error('Google Vertex analyzeImage error:', error);
            return {
                analysis: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
                model: modelName,
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            };
        }
    }

    async healthCheck(): Promise<boolean> {
        if (!this.isConfigured()) return false;
        try {
            const client = await this.getClient();
            await client.models.generateContent({ model: config.ai.fallback.model, contents: 'test' });
            this.recordHealthError();
            return true;
        } catch (error) {
            this.recordHealthError(error instanceof Error ? error.message : String(error));
            return false;
        }
    }
}
