import {
    BaseAIProvider,
    AIProviderType,
    TextGenerationOptions,
    TextGenerationResult,
    ReasoningOptions,
    ReasoningResult,
} from '../aiProvider';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import { REASONING_SYSTEM_PROMPT, extractVisuals } from '../assetLibrary';

export class OllamaProvider extends BaseAIProvider {
    readonly provider: AIProviderType = 'ollama';
    readonly capabilities = [
        'text-generation',
        'reasoning',
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
            // Using global fetch as it's available in Node 18+ and Bun
            const response = await fetch(`${host}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model,
                    messages,
                    stream: false,
                    options: {
                        temperature: options?.temperature ?? 0.7,
                        num_predict: options?.maxTokens ?? 1000,
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ollama API error: ${response.statusText} - ${errorText}`);
            }

            const data: any = await response.json();
            return {
                text: data.message?.content || '',
                model,
            };
        } catch (error) {
            logger.error('Ollama generateText error:', error);
            throw new Error(`Ollama text generation failed: ${(error as Error).message}`);
        }
    }

    async analyzeWithReasoning(context: string, query: string, options?: ReasoningOptions): Promise<ReasoningResult> {
        const systemPrompt = REASONING_SYSTEM_PROMPT;
        const promptText = `Context: ${context}\n\nQuestion: ${query}`;
        
        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: promptText }
        ];

        const result = await this.generateText(messages, {
            temperature: options?.temperature ?? 0.2,
            maxTokens: options?.maxTokens ?? 2000,
        });

        const text = result.text ?? '';
        const visuals = extractVisuals(text);

        let cleanAnswer = text
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
            const response = await fetch(`${config.ollama.host}/api/tags`);
            return response.ok;
        } catch (error) {
            return false;
        }
    }
}
