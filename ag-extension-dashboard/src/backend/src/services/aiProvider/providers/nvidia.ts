import axios from 'axios';
import { logger } from '../../../utils/logger';
import { BaseAIProvider, AIProviderType, TextGenerationOptions, TextGenerationResult } from '../types';

export interface NVIDIARequest {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

export interface NVIDIAResponse {
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
 * NVIDIA NIM Provider — OpenAI-compatible chat completions via the NVIDIA
 * build API (https://integrate.api.nvidia.com/v1). Reads NVIDIA_API_KEY
 * (nvapi-...) from the environment.
 */
export class NVIDIAProvider extends BaseAIProvider {
  readonly provider: AIProviderType = 'nvidia';
  readonly capabilities: string[] = ['text', 'chat'];
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl = 'https://integrate.api.nvidia.com/v1') {
    super();
    this.apiKey = apiKey || process.env.NVIDIA_API_KEY || '';
    this.baseUrl = baseUrl;
  }

  private getApiKey(): string {
    return this.apiKey || process.env.NVIDIA_API_KEY || '';
  }

  public override isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  public override async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      await axios.post(`${this.baseUrl}/chat/completions`, { model: 'meta/llama-3.1-8b-instruct', messages: [{ role: 'user', content: 'ping' }], max_tokens: 2 }, { headers: { Authorization: `Bearer ${this.getApiKey()}` }, timeout: 3000 });
      return true;
    } catch { return this.isConfigured(); }
  }

  public override async generateText(prompt: string | Array<{ role: string; content: string }>, options?: TextGenerationOptions): Promise<TextGenerationResult> {
    const messages = typeof prompt === 'string' ? [{ role: 'user', content: prompt }] : prompt;
    const text = await this.chat({ model: options?.model, messages, temperature: options?.temperature, max_tokens: options?.maxTokens });
    return { text, model: options?.model || 'meta/llama-3.1-8B-Instruct' };
  }

  public async chat(req: NVIDIARequest): Promise<string> {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('NVIDIA API key not configured (NVIDIA_API_KEY missing).');
    }

    const model = req.model || 'meta/llama-3.1-8b-instruct';

    try {
      logger.info(`Routing request to NVIDIA NIM provider (model: ${model})`);

      const response = await axios.post<NVIDIAResponse>(
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
        throw new Error('Empty completion content returned from NVIDIA NIM.');
      }

      return content;
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: unknown }; message?: string };
      const status = axiosError.response?.status;
      const responseBodyStr = JSON.stringify(axiosError.response?.data || '');

      if (status === 429 || status === 402 || responseBodyStr.includes('quota') || responseBodyStr.includes('insufficient')) {
        logger.warn(`NVIDIA NIM quota/rate limit exceeded (HTTP ${status}) for model ${model}. Triggering OmniRoute failover.`);
        throw new Error(`NVIDIA_QUOTA_EXCEEDED: Quota/Rate limit reached for ${model}`);
      }

      logger.error(`NVIDIA NIM API error (${status || 'Network'}):`, axiosError.message);
      throw err;
    }
  }
}