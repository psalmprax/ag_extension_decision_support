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
            // Return mock client for development
            return this.getMockClient();
        }
    }

    private getMockClient() {
        return {
            async getChatCompletions(_deploymentName: string, _messages: any, _options: any) {
                return {
                    choices: [
                        {
                            message: {
                                role: 'assistant',
                                content: 'This is a mock response from Azure OpenAI. Configure your API keys for actual responses.',
                            },
                            finishReason: 'stop',
                        },
                    ],
                    usage: {
                        promptTokens: 10,
                        completionTokens: 20,
                        totalTokens: 30,
                    },
                };
            },
            async getEmbeddings(_deploymentName: string, _input: string | string[]) {
                const input = Array.isArray(_input) ? _input : [_input];
                return {
                    data: input.map(() => ({
                        embedding: Array(1536).fill(0).map(() => Math.random() - 0.5),
                    })),
                    usage: {
                        tokens: input.length * 100,
                    },
                };
            },
        };
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
            // Return mock response in case of error
            return {
                text: 'This is a mock response. Configure your Azure OpenAI API keys for actual responses.',
                model,
                usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
                finishReason: 'stop',
            };
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
        };

        try {
            const events = await client.getChatCompletions(
                config.azureOpenAI.deploymentName,
                messages,
                requestOptions
            );

            for (const choice of events.choices) {
                if (choice.delta?.content) {
                    yield choice.delta.content;
                }
            }
        } catch (error) {
            logger.error('Azure OpenAI streamText error:', error);
            yield 'Mock streaming response. Configure API keys for actual responses.';
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
            // Return mock embedding
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
            const response = await client.getEmbeddings(model, texts);
            return response.data.map((item: any) => ({
                embedding: item.embedding,
                model,
                usage: { tokens: response.usage.tokens / texts.length },
            }));
        } catch (error) {
            logger.error('Azure OpenAI createBatchEmbeddings error:', error);
            return texts.map(() => ({
                embedding: Array(1536).fill(0).map(() => Math.random() - 0.5),
                model,
                usage: { tokens: 100 },
            }));
        }
    }

    async speechToText(audio: Buffer, options?: SpeechToTextOptions): Promise<SpeechToTextResult> {
        logger.info('Speech to text called with audio size:', audio.length);
        // Mock implementation - Azure Speech Services would require additional setup
        return {
            text: 'Mock transcription. Configure Azure Speech Services for actual transcription.',
            language: options?.language || 'en-US',
            confidence: 0.95,
        };
    }

    async textToSpeech(text: string, options?: TextToSpeechOptions): Promise<TextToSpeechResult> {
        logger.info('Text to speech called with text length:', text.length);
        // Mock implementation - Azure Speech Services would require additional setup
        return {
            audio: Buffer.from('Mock audio'),
            format: 'audio/wav',
        };
    }

    async analyzeWithReasoning(context: string, query: string, options?: ReasoningOptions): Promise<ReasoningResult> {
        const prompt = `Given the following context about agricultural practices:\n\n${context}\n\nQuestion: ${query}\n\nPlease provide a detailed analysis and answer.`;
        const result = await this.generateText(prompt, {
            temperature: options?.temperature ?? 0.3,
            maxTokens: options?.maxTokens ?? 1500,
        });

        return {
            reasoning: 'Analysis based on provided context and agricultural knowledge.',
            answer: result.text ?? '',
            confidence: 0.85,
        };
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
