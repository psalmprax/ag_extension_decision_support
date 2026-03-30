import {
    BaseAIProvider,
    AIProviderType,
    TextGenerationOptions,
    TextGenerationResult,
} from '../aiProvider';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import Groq from 'groq-sdk';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { Tool } from '../../../tools/types';


export class GroqProvider extends BaseAIProvider {
    readonly provider: AIProviderType = 'groq';
    readonly capabilities = ['text-generation', 'tool-use', 'embeddings'];
    private client: Groq;

    constructor() {
        super();
        this.client = new Groq({ apiKey: config.groq.apiKey });
    }

    async generateText(messages: any[], options?: TextGenerationOptions): Promise<TextGenerationResult> {
        const model = options?.model || 'llama-3.3-70b-versatile';

        const toolSchemas = options?.tools?.map((tool: Tool<z.ZodType<any, any>>) => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description,
                parameters: zodToJsonSchema(tool.schema),
            },
        }));

        try {
            const response = await this.client.chat.completions.create({
                model,
                messages,
                temperature: options?.temperature ?? 0.7,
                max_tokens: options?.maxTokens ?? 1000,
                top_p: options?.topP,
                frequency_penalty: options?.frequencyPenalty,
                presence_penalty: options?.presencePenalty,
                stop: options?.stop,
                tools: toolSchemas,
                tool_choice: toolSchemas && toolSchemas.length > 0 ? 'auto' : undefined,
            });

            const choice = response.choices[0];
            return {
                text: choice.message.content,
                toolCalls: choice.message.tool_calls?.map(tc => ({
                    id: tc.id,
                    type: tc.type,
                    function: {
                        name: tc.function.name,
                        arguments: tc.function.arguments,
                    },
                })),
                model,
                usage: {
                    promptTokens: response.usage?.prompt_tokens || 0,
                    completionTokens: response.usage?.completion_tokens || 0,
                    totalTokens: response.usage?.total_tokens || 0,
                },
                finishReason: choice.finish_reason,
            };
        } catch (error) {
            logger.error('Groq generateText error:', error);
            throw new Error(`Groq text generation failed: ${(error as Error).message}`);
        }
    }

    async createEmbedding(text: string, options?: any): Promise<any> {
        const model = options?.model || 'nomic-embed-text-v1.5';
        try {
            const response = await this.client.embeddings.create({
                model,
                input: text,
            });

            return {
                embedding: response.data[0].embedding,
                model,
                usage: {
                    tokens: response.usage.total_tokens,
                },
            };
        } catch (error) {
            logger.error('Groq createEmbedding error:', error);
            throw error;
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.client.chat.completions.create({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 1,
            });
            return true;
        } catch (error) {
            logger.error('Groq health check failed:', error);
            return false;
        }
    }
}
