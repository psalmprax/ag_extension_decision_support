/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    BaseAIProvider,
    AIProviderType,
    TextGenerationOptions,
    TextGenerationResult,
    ReasoningOptions,
    ReasoningResult,
    ClassificationOptions,
    ClassificationResult,
    ImageAnalysisOptions,
    ImageAnalysisResult,
    VideoAnalysisOptions,
    VideoAnalysisResult,
} from '../types';
import { REASONING_SYSTEM_PROMPT, extractVisuals } from '../assetLibrary';
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
                parameters: zodToJsonSchema(tool.schema as any),
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

    async analyzeImage(imageData: string | Buffer, prompt?: string, options?: ImageAnalysisOptions): Promise<ImageAnalysisResult> {
        const model = options?.model || 'llama-3.2-11b-vision-preview';
        try {
            let base64Image: string;
            if (Buffer.isBuffer(imageData)) {
                base64Image = imageData.toString('base64');
            } else if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
                base64Image = imageData.split(',')[1];
            } else {
                base64Image = imageData as string;
            }

            const response = await this.client.chat.completions.create({
                model,
                messages: [
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
                ],
                temperature: options?.temperature ?? 0.2,
                max_tokens: options?.maxTokens ?? 1000,
            });

            return {
                analysis: response.choices[0].message.content || 'Unable to analyze image',
                model,
                usage: {
                    promptTokens: response.usage?.prompt_tokens || 0,
                    completionTokens: response.usage?.completion_tokens || 0,
                    totalTokens: response.usage?.total_tokens || 0,
                },
            };
        } catch (error) {
            logger.error('Groq analyzeImage error:', error);
            return {
                analysis: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
                model,
                usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            };
        }
    }

    async analyzeWithReasoning(context: string, query: string, options?: ReasoningOptions): Promise<ReasoningResult> {
        const groundedPrompt = `Use the context below as the authoritative source for this answer. If the context is incomplete, say what is missing before adding general agricultural guidance. Cite source titles or URLs when available.\n\nContext:\n${context || 'No specific context found in knowledge base.'}\n\nQuestion: ${query}`;
        const messages = [
            { role: 'system', content: REASONING_SYSTEM_PROMPT },
            { role: 'user', content: groundedPrompt },
        ];

        const result = await this.generateText(messages, {
            temperature: options?.temperature ?? 0.2,
            maxTokens: options?.maxTokens ?? 2000,
        });

        const text = result.text ?? '';
        const visuals = extractVisuals(text);

        const cleanAnswer = text
            .replace(/<visuals>[\s\S]*?<\/visuals>/gi, '')
            .replace(/```json[\s\S]*?```/gi, '')
            .trim();

        return {
            reasoning: 'Detailed Intelligence Analysis completed.',
            answer: cleanAnswer,
            confidence: 0.9,
            visuals,
        };
    }

    async classify(input: string, options: ClassificationOptions): Promise<ClassificationResult> {
        const prompt = `Classify the following agricultural query into one of these categories: ${options.taxonomy}. \n        Return ONLY a JSON array of objects with "label" and "score" (0-1).\n        Query: "${input}"`;

        try {
            const result = await this.generateText(
                [{ role: 'user', content: prompt }],
                { temperature: 0.1, maxTokens: 200 }
            );
            const text = (result.text || '').trim();
            const jsonMatch = text.match(/\[.*\]/s);
            if (jsonMatch) {
                return { labels: JSON.parse(jsonMatch[0]) };
            }
            return { labels: [{ label: 'general', score: 1.0 }] };
        } catch (error) {
            logger.error('Groq classify error:', error);
            return { labels: [{ label: 'general', score: 1.0 }] };
        }
    }

    async analyzeVideo(_videoData: Buffer, _prompt?: string, _options?: VideoAnalysisOptions): Promise<VideoAnalysisResult> {
        throw new Error('Video analysis not implemented for Groq provider');
    }

    async healthCheck(): Promise<boolean> {
        try {
            await this.client.chat.completions.create({
                model: 'llama-3.1-8b-instant',
                messages: [{ role: 'user', content: 'test' }],
                max_tokens: 1,
            });
            this.recordHealthError();
            return true;
        } catch (error) {
            logger.error('Groq health check failed:', error);
            this.recordHealthError(error instanceof Error ? error.message : String(error));
            return false;
        }
    }
}
