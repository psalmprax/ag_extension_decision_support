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
    EmbeddingOptions,
    EmbeddingResult,
} from '../types';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { REASONING_SYSTEM_PROMPT, extractVisuals } from '../assetLibrary';
import axios from 'axios';

export class OllamaProvider extends BaseAIProvider {
    readonly provider: AIProviderType = 'ollama';
    readonly capabilities = [
        'text-generation',
        'reasoning',
        'classification',
        'embeddings',
    ];

    isConfigured(): boolean {
        return !!config.ollama.host;
    }

    async generateText(prompt: string | any[], options?: TextGenerationOptions): Promise<TextGenerationResult> {
        const host = config.ollama.host;
        const model = options?.model || config.ollama.model || 'llama3';

        let messages: any[] = [];
        if (Array.isArray(prompt)) {
            messages = prompt;
        } else {
            messages = [
                { role: 'system', content: 'You are a helpful agricultural extension assistant.' },
                { role: 'user', content: prompt }
            ];
        }

        try {
            const response = await axios.post(`${host}/api/chat`, {
                model,
                messages,
                stream: false,
                options: {
                    temperature: options?.temperature ?? 0.7,
                    num_predict: options?.maxTokens ?? 1000,
                }
            }, {
                timeout: parseInt(process.env.OLLAMA_REQUEST_TIMEOUT_MS || '120000', 10),
            });

            const data = response.data;
            return {
                text: data.message?.content || '',
                model,
                usage: {
                    promptTokens: data.prompt_eval_count ?? 0,
                    completionTokens: data.eval_count ?? 0,
                    totalTokens: (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
                },
                finishReason: 'stop',
                toolCalls: undefined,
            };
        } catch (error) {
            logger.error('Ollama generateText error:', error);
            throw new Error(`Ollama text generation failed: ${(error as Error).message}`);
        }
    }

    async createEmbedding(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult> {
        const host = config.ollama.host;
        const model = options?.model || 'nomic-embed-text';

        try {
            const response = await axios.post(`${host}/api/embeddings`, {
                model,
                prompt: text,
            }, {
                timeout: 10000,
            });

            const embedding: number[] = response.data.embedding;
            if (!embedding || !Array.isArray(embedding)) {
                throw new Error('Ollama returned an empty or invalid embedding format');
            }

            return {
                embedding,
                model,
            };
        } catch (error) {
            logger.error('Ollama createEmbedding error:', error);
            throw error;
        }
    }

    async classify(input: string, options: ClassificationOptions): Promise<ClassificationResult> {
        const prompt = `Classify the following agricultural query into one of these categories: ${options.taxonomy}. 
        Return ONLY a JSON array of objects with "label" and "score" (0-1).
        Query: "${input}"`;

        try {
            const result = await this.generateText(prompt, { temperature: 0.1, maxTokens: 200 });
            const text = (result.text || '').trim();
            const jsonMatch = text.match(/\[.*\]/s);
            if (jsonMatch) {
                return { labels: JSON.parse(jsonMatch[0]) };
            }
            return { labels: [{ label: 'general', score: 1.0 }] };
        } catch (error) {
            logger.error('Ollama classify error:', error);
            return { labels: [{ label: 'general', score: 1.0 }] };
        }
    }

    async analyzeWithReasoning(context: string, query: string, options?: ReasoningOptions): Promise<ReasoningResult> {
        const systemPrompt = REASONING_SYSTEM_PROMPT;
        const promptText = `Use the context below as the authoritative source for this answer. If the context is incomplete, say what is missing before adding general agricultural guidance. Cite source titles or URLs when available.\n\nContext:\n${context || 'No specific context found in knowledge base.'}\n\nQuestion: ${query}`;
        
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: promptText }
        ];

        const result = await this.generateText(messages, {
            temperature: options?.temperature ?? 0.2,
            maxTokens: options?.maxTokens ?? 900,
        });

        const text = result.text ?? '';
        const visuals = extractVisuals(text);

        const cleanAnswer = text
            .replace(/<visuals>[\s\S]*?<\/visuals>/gi, '')
            .replace(/```json[\s\S]*?```/gi, '')
            .trim();

        return {
            reasoning: 'Ollama local analysis completed.',
            answer: cleanAnswer,
            confidence: 0.8,
            visuals
        };
    }

    async healthCheck(): Promise<boolean> {
        try {
            const response = await axios.get(`${config.ollama.host}/api/tags`, { timeout: 2000 });
            return response.status === 200;
        } catch (error) {
            logger.warn(`Ollama health check failed for ${config.ollama.host}:`, (error as Error).message);
            return false;
        }
    }
}
