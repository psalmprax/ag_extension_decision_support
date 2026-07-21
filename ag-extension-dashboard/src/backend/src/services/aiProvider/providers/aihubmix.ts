import axios from 'axios';
import { logger } from '../../../utils/logger';

export interface AIHubMixRequest {
  model?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}

export interface AIHubMixResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * AIHubMix Provider — Universal multi-model LLM API integration.
 * Connects to AIHubMix proxy endpoints with quota-aware error handling.
 */
export class AIHubMixProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl = 'https://aihubmix.com/v1') {
    this.apiKey = apiKey || process.env.AIHUBMIX_API_KEY || '';
    this.baseUrl = baseUrl;
  }

  private getApiKey(): string {
    return this.apiKey || process.env.AIHUBMIX_API_KEY || '';
  }

  public isConfigured(): boolean {
    return Boolean(this.getApiKey());
  }

  public async chat(req: AIHubMixRequest): Promise<string> {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('AIHubMix API key not configured (AIHUBMIX_API_KEY missing).');
    }

    const model = req.model || 'google/gemini-2.0-flash-exp:free';

    try {
      logger.info(`Routing request to AIHubMix provider (model: ${model})`);

      const response = await axios.post<AIHubMixResponse>(
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
        throw new Error('Empty completion content returned from AIHubMix.');
      }

      return content;
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: unknown }; message?: string };
      const status = axiosError.response?.status;

      const responseBodyStr = JSON.stringify(axiosError.response?.data || '');
      if (status === 429 || responseBodyStr.includes('insufficient_user_quota') || responseBodyStr.includes('quota')) {
        logger.warn(`AIHubMix quota/rate limit exceeded (HTTP ${status}) for model ${model}. Triggering OmniRoute failover.`);
        throw new Error(`AIHUBMIX_QUOTA_EXCEEDED: Quota limit reached for ${model}`);
      }

      logger.error(`AIHubMix API error (${status || 'Network'}):`, axiosError.message);
      throw err;
    }
  }
}
