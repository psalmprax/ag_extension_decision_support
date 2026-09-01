import axios from 'axios';
import { logger } from '../../../utils/logger';
import { BaseAIProvider, AIProviderType, TextGenerationOptions, TextGenerationResult } from '../types';

export interface HuggingFaceRequest {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

export interface HuggingFaceResponse {
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
 * Hugging Face Provider — OpenAI-compatible chat completions via the HF
 * Inference Providers router (https://router.huggingface.co/v1).
 * Reads HUGGINGFACE_API_KEY (hf_...) from the environment.
 */
export class HuggingFaceProvider extends BaseAIProvider {
  readonly provider: AIProviderType = 'huggingface';
  readonly capabilities: string[] = ['text', 'chat'];
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl = 'https://router.huggingface.co/v1') {
    super();
    this.apiKey = apiKey || process.env.HUGGINGFACE_API_KEY || '';
    this.baseUrl = baseUrl;
  }

  private getApiKey(): string {
    return this.apiKey || process.env.HUGGINGFACE_API_KEY || '';
  }

  public override isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  public override async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      await axios.post(`${this.baseUrl}/chat/completions`, { model: 'meta-llama/Llama-3.1-8B-Instruct', messages: [{ role: 'user', content: 'ping' }], max_tokens: 2 }, { headers: { Authorization: `Bearer ${this.getApiKey()}` }, timeout: 3000 });
      return true;
    } catch { return this.isConfigured(); }
  }

  public override async generateText(prompt: string | Array<{ role: string; content: string }>, options?: TextGenerationOptions): Promise<TextGenerationResult> {
    const messages = typeof prompt === 'string' ? [{ role: 'user', content: prompt }] : prompt;
    const text = await this.chat({ model: options?.model, messages, temperature: options?.temperature, max_tokens: options?.maxTokens });
    return { text, model: options?.model || 'meta-llama/Llama-3.1-8B-Instruct' };
  }

  public async chat(req: HuggingFaceRequest): Promise<string> {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('Hugging Face API key not configured (HUGGINGFACE_API_KEY missing).');
    }

    const model = req.model || 'meta-llama/Llama-3.1-8B-Instruct';

    try {
      logger.info(`Routing request to Hugging Face provider (model: ${model})`);

      const response = await axios.post<HuggingFaceResponse>(
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
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const content = response.data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Empty completion content returned from Hugging Face.');
      }

      return content;
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: unknown }; message?: string };
      const status = axiosError.response?.status;
      const responseBodyStr = JSON.stringify(axiosError.response?.data || '');

      if (status === 429 || status === 402 || responseBodyStr.includes('quota') || responseBodyStr.includes('insufficient')) {
        logger.warn(`Hugging Face quota/rate limit exceeded (HTTP ${status}) for model ${model}. Triggering OmniRoute failover.`);
        throw new Error(`HUGGINGFACE_QUOTA_EXCEEDED: Quota/Rate limit reached for ${model}`);
      }

      logger.error(`Hugging Face API error (${status || 'Network'}):`, axiosError.message);
      throw err;
    }
  }
}