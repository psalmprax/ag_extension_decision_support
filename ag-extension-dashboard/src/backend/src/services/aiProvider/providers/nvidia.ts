import axios from 'axios';
import { logger } from '../../../utils/logger';

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
export class NVIDIAProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey?: string, baseUrl = 'https://integrate.api.nvidia.com/v1') {
    this.apiKey = apiKey || process.env.NVIDIA_API_KEY || '';
    this.baseUrl = baseUrl;
  }

  private getApiKey(): string {
    return this.apiKey || process.env.NVIDIA_API_KEY || '';
  }

  public isConfigured(): boolean {
    return Boolean(this.getApiKey());
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