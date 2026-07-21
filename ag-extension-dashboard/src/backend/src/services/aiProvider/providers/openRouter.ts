import axios from 'axios';
import { logger } from '../../../utils/logger';

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
 * OpenRouter Provider — Native integration for OpenRouter free LLM models.
 * Connects to https://openrouter.ai/api/v1 with auto quota error detection.
 */
export class OpenRouterProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl = 'https://openrouter.ai/api/v1') {
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || '';
    this.baseUrl = baseUrl;
  }

  private getApiKey(): string {
    return this.apiKey || process.env.OPENROUTER_API_KEY || '';
  }

  public isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  public async chat(req: OpenRouterRequest): Promise<string> {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('OpenRouter API key not configured (OPENROUTER_API_KEY missing).');
    }

    const model = req.model || 'google/gemini-2.0-flash-exp:free';

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
            'HTTP-Referer': 'https://ag-extension.ca',
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
}
