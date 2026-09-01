import axios from 'axios';
import { logger } from '../../../utils/logger';
import {
  BaseAIProvider,
  AIProviderType,
  TextGenerationOptions,
  TextGenerationResult,
  ReasoningOptions,
  ReasoningResult,
  ClassificationOptions,
  ClassificationResult,
} from '../types';
import { REASONING_SYSTEM_PROMPT, extractVisuals, buildGroundedReasoningPrompt } from '../assetLibrary';

export interface OpenRouterRequest {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

export interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
}

/**
 * OpenRouter Provider — Native integration for OpenRouter free and paid LLM models.
 * Connects to https://openrouter.ai/api/v1 with auto quota error detection.
 */
export class OpenRouterProvider extends BaseAIProvider {
  readonly provider: AIProviderType = 'openrouter';
  readonly capabilities: string[] = ['text', 'chat', 'reasoning'];

  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl = 'https://openrouter.ai/api/v1') {
    super();
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
    this.baseUrl = baseUrl;
  }

  private getApiKey(): string {
    return this.apiKey || process.env.OPENROUTER_API_KEY || '';
  }

  public override isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  public override async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      await axios.post(
        `${this.baseUrl}/chat/completions`,
        { model: 'meta-llama/llama-3.3-70b-instruct:free', messages: [{ role: 'user', content: 'ping' }], max_tokens: 2 },
        { headers: { Authorization: `Bearer ${this.getApiKey()}` }, timeout: 3000 }
      );
      return true;
    } catch {
      return this.isConfigured();
    }
  }

  public async chat(req: OpenRouterRequest): Promise<string> {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('OpenRouter API key not configured (OPENROUTER_API_KEY missing).');
    }

    const model = req.model || process.env.AI_FALLBACK_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';

    try {
      logger.info(`Routing request to OpenRouter provider (model: ${model})`);

      const response = await axios.post<OpenRouterResponse>(
        `${this.baseUrl}/chat/completions`,
        {
          model,
          messages: req.messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.max_tokens ?? 1024,
        },
        {
          headers: {
            Authorization: `Bearer ${key}`,
            'HTTP-Referer': 'https://gpexts.com',
            'X-Title': 'Ag-Extension Decision Support',
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const content = response.data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Empty completion content returned from OpenRouter.');
      }

      return content;
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: unknown }; message?: string };
      const status = axiosError.response?.status;
      const responseBodyStr = JSON.stringify(axiosError.response?.data || '');

      if (status === 429 || responseBodyStr.includes('quota') || status === 402) {
        logger.warn(`OpenRouter quota/rate limit exceeded (HTTP ${status}) for model ${model}.`);
        throw new Error(`OPENROUTER_QUOTA_EXCEEDED: Quota/Rate limit reached for ${model}`);
      }

      logger.error(`OpenRouter API error (${status || 'Network'}):`, axiosError.message);
      throw err;
    }
  }

  public override async generateText(
    prompt: string | Array<{ role: string; content: string }>,
    options?: TextGenerationOptions
  ): Promise<TextGenerationResult> {
    const messages = typeof prompt === 'string' ? [{ role: 'user', content: prompt }] : prompt;
    const model = options?.model || process.env.AI_FALLBACK_MODEL || 'meta-llama/llama-3.3-70b-instruct:free';
    const text = await this.chat({
      model,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });

    return {
      text,
      model,
    };
  }

  public override async analyzeWithReasoning(
    context: string,
    query: string,
    options?: ReasoningOptions
  ): Promise<ReasoningResult> {
    const groundedPrompt = buildGroundedReasoningPrompt(context, query);
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
      reasoning: 'Detailed Intelligence Analysis completed via OpenRouter.',
      answer: cleanAnswer,
      confidence: 0.9,
      visuals,
    };
  }

  public override async classify(
    input: string,
    options: ClassificationOptions
  ): Promise<ClassificationResult> {
    const prompt = `Classify the following text into the provided taxonomy labels: ${options.taxonomy}\n\nText: "${input}"\n\nReturn JSON: { "labels": [{ "label": string, "score": number }] }`;
    const messages = [
      { role: 'system', content: 'You are an agricultural classifier. Output only valid JSON.' },
      { role: 'user', content: prompt },
    ];
    const res = await this.generateText(messages, { temperature: 0.1 });
    try {
      const parsed = JSON.parse(res.text || '{}');
      return { labels: parsed.labels || [{ label: 'general_inquiry', score: 1.0 }] };
    } catch {
      return { labels: [{ label: 'general_inquiry', score: 1.0 }] };
    }
  }
}
