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
    VideoAnalysisOptions,
    VideoAnalysisResult,
} from '../aiProvider';
import { REASONING_SYSTEM_PROMPT, extractVisuals } from '../assetLibrary';
import { config } from '@/config';
import { logger } from '@/utils/logger';

export class AzureOpenAIProvider extends BaseAIProvider {
    readonly provider: AIProviderType = 'azure_openai';
    readonly capabilities = [
        'text-generation',
        'embeddings',
        'speech-to-text',
        'text-to-speech',
        'reasoning',
        'classification',
        'vision',
    ];

    isConfigured(): boolean {
        return !!config.azureOpenAI.apiKey && !!config.azureOpenAI.endpoint && config.azureOpenAI.apiKey !== 'your-api-key';
    }

    private client: any = null;

    private async getClient(): Promise<any> {
        if (this.client) return this.client;

        try {
            const { OpenAIClient, AzureKeyCredential } = await import('@azure/openai');
            this.client = new OpenAIClient(
                config.azureOpenAI.endpoint,
                new AzureKeyCredential(config.azureOpenAI.apiKey)
            );
            return this.client;
        } catch (error) {
            logger.error('Failed to initialize Azure OpenAI client:', error);
            throw new Error('Azure OpenAI client initialization failed — API key not configured');
        }
    }

    async generateText(prompt: string | any[], options?: TextGenerationOptions): Promise<TextGenerationResult> {
        const client = await this.getClient();
        const model = options?.model || config.ai.primary.model;

        const messages = [
            { role: 'system', content: 'You are a helpful agricultural extension assistant.' },
            { role: 'user', content: prompt },
        ];

        const requestOptions = {
            temperature: options?.temperature ?? 0.7,
            maxTokens: options?.maxTokens ?? 1000,
            topP: options?.topP,
            frequencyPenalty: options?.frequencyPenalty,
            presencePenalty: options?.presencePenalty,
            stop: options?.stop,
        };

        try {
            const response = await client.getChatCompletions(
                config.azureOpenAI.deploymentName,
                messages,
                requestOptions
            );

            const choice = response.choices[0];
            return {
                text: choice.message.content,
                model,
                usage: response.usage,
                finishReason: choice.finishReason,
            };
        } catch (error) {
            logger.error('Azure OpenAI generateText error:', error);
            throw new Error(`Azure OpenAI text generation failed: ${(error as Error).message}`);
        }
    }

    async *streamText(prompt: string, options?: TextGenerationOptions): AsyncGenerator<string> {
        const client = await this.getClient();
        const messages = [
            { role: 'system', content: 'You are a helpful agricultural extension assistant.' },
            { role: 'user', content: prompt },
        ];

        const requestOptions = {
            temperature: options?.temperature ?? 0.7,
            maxTokens: options?.maxTokens ?? 1000,
            stream: true,
        };

        try {
            const events = await client.streamChatCompletions(
                config.azureOpenAI.deploymentName,
                messages,
                requestOptions
            );

            for await (const event of events) {
                for (const choice of event.choices) {
                    if (choice.delta?.content) {
                        yield choice.delta.content;
                    }
                }
            }
        } catch (error) {
            logger.error('Azure OpenAI streamText error:', error);
            throw new Error(`Azure OpenAI streaming failed: ${(error as Error).message}`);
        }
    }

    async createEmbedding(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult> {
        const client = await this.getClient();
        const model = options?.model || 'text-embedding-3-large';

        try {
            const response = await client.getEmbeddings(model, text);
            return {
                embedding: response.data[0].embedding,
                model,
                usage: { tokens: response.usage.tokens },
            };
        } catch (error) {
            logger.error('Azure OpenAI createEmbedding error:', error);
            throw new Error(`Azure OpenAI embedding failed: ${(error as Error).message}`);
        }
    }

    async createBatchEmbeddings(texts: string[], options?: EmbeddingOptions): Promise<EmbeddingResult[]> {
        const client = await this.getClient();
        const model = options?.model || 'text-embedding-3-large';

        try {
            const response = await client.getEmbeddings(model, texts);
            return response.data.map((item: any) => ({
                embedding: item.embedding,
                model,
                usage: { tokens: response.usage.tokens / texts.length },
            }));
        } catch (error) {
            logger.error('Azure OpenAI createBatchEmbeddings error:', error);
            throw new Error(`Azure OpenAI batch embedding failed: ${(error as Error).message}`);
        }
    }

    async speechToText(_audio: Buffer, _options?: SpeechToTextOptions): Promise<SpeechToTextResult> {
        throw new Error('Azure Speech-to-Text not configured — set AZURE_SPEECH_KEY to enable');
    }

    async textToSpeech(_text: string, _options?: TextToSpeechOptions): Promise<TextToSpeechResult> {
        throw new Error('Azure Text-to-Speech not configured — set AZURE_SPEECH_KEY to enable');
    }

    async analyzeWithReasoning(context: string, query: string, options?: ReasoningOptions): Promise<ReasoningResult> {
        const client = await this.getClient();
        const systemPrompt = REASONING_SYSTEM_PROMPT;

        const userContent: any[] = [
            { type: 'text', text: `Context: ${context}\n\nQuestion: ${query}` }
        ];

        if (options?.attachments && options.attachments.length > 0) {
            for (const attachment of options.attachments) {
                if (attachment.type === 'image') {
                    userContent.push({
                        type: 'image_url',
                        image_url: { url: attachment.data }
                    });
                }
            }
        }

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent }
        ];

        const requestOptions = {
            temperature: options?.temperature ?? 0.2,
            maxTokens: options?.maxTokens ?? 2000,
        };

        try {
            const response = await client.getChatCompletions(
                config.azureOpenAI.deploymentName,
                messages,
                requestOptions
            );

            const text = response.choices[0].message.content ?? '';
            const visuals = extractVisuals(text);

            let cleanAnswer = text
                .replace(/<visuals>[\s\S]*?<\/visuals>/gi, '')
                .replace(/```json[\s\S]*?```/gi, '')
                .replace(/#{1,6}\s*(Visual Data|Visual Insights|Charts|Expert Data|Insight Analysis)[^\n]*/gi, '')
                .trim();

            cleanAnswer = cleanAnswer.replace(/\n\s*\n\s*\n/g, '\n\n');

            return {
                reasoning: 'Detailed Azure-based Intelligence Analysis completed.',
                answer: cleanAnswer,
                confidence: 0.9,
                visuals
            };
        } catch (error) {
            logger.error('Azure OpenAI analyzeWithReasoning error:', error);
            throw new Error(`Azure OpenAI reasoning analysis failed: ${(error as Error).message}`);
        }
    }

    async classify(input: string, options: ClassificationOptions): Promise<ClassificationResult> {
        const prompt = `Classify the following agricultural query into one or more categories from this taxonomy: ${options.taxonomy}\n\nQuery: ${input}\n\nRespond with a JSON array of labels and scores.`;

        const result = await this.generateText(prompt, { temperature: 0.3, maxTokens: 500 });

        try {
            const labels = JSON.parse(result.text ?? '[]');
            return { labels };
        } catch {
            // Return default classification if parsing fails
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
        const model = options?.model || config.ai.primary.model;

        try {
            let base64Image: string;
            if (Buffer.isBuffer(imageData)) {
                base64Image = imageData.toString('base64');
            } else if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
                base64Image = imageData.split(',')[1];
            } else {
                base64Image = imageData as string;
            }

            const messages = [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt || 'Analyze this agricultural image.' },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`,
                            },
                        },
                    ],
                },
            ];

            const requestOptions = {
                temperature: options?.temperature ?? 0.3,
                maxTokens: options?.maxTokens ?? 1000,
            };

            const response = await client.getChatCompletions(
                config.azureOpenAI.deploymentName,
                messages,
                requestOptions
            );

            return {
                analysis: response.choices[0].message.content || 'Unable to analyze image',
                model,
                usage: response.usage,
            };
        } catch (error: any) {
            logger.error('Azure OpenAI analyzeImage error:', error);
            return {
                analysis: `Error: ${error.message}`,
                model,
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            };
        }
    }

    async analyzeVideo(_videoData: Buffer, _prompt?: string, _options?: VideoAnalysisOptions): Promise<VideoAnalysisResult> {
        throw new Error('Video analysis not implemented for Azure OpenAI provider');
    }

    async healthCheck(): Promise<boolean> {
        try {
            const client = await this.getClient();
            // Try a simple request to check connectivity
            await client.getChatCompletions(
                config.azureOpenAI.deploymentName,
                [{ role: 'user', content: 'Hi' }],
                { maxTokens: 1 }
            );
            return true;
        } catch {
            return false;
        }
    }
}
