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

export interface AIHubMixUserProfile {
  id: number;
  username: string;
  email: string;
  quota: number; // Internal billing units
  used_quota: number;
  request_count: number;
  group: string;
}

export interface AIHubMixToken {
  id: number;
  user_id: number;
  key: string; // The sk- API key
  name: string;
  status: number;
  remain_quota: number;
  unlimited_quota: boolean;
  used_quota: number;
  created_time: number;
  accessed_time: number;
  expired_time: number;
  models?: string; // Comma-separated string
}

export interface CreateTokenParams {
  name: string;
  remain_quota?: number;
  unlimited_quota?: boolean;
  expired_time?: number;
  models?: string;
}

/**
 * AIHubMix Account Management REST Client
 * Authenticates with AIHUBMIX_ACCESS_KEY to manage quota, models, and sk- tokens.
 */
export class AIHubMixAccountService {
  private accessKey: string;
  private apiBaseUrl: string;

  constructor(accessKey?: string, apiBaseUrl = 'https://aihubmix.com/api') {
    this.accessKey = accessKey || process.env.AIHUBMIX_ACCESS_KEY || '';
    this.apiBaseUrl = apiBaseUrl;
  }

  private getAuthHeader(): { Authorization: string } {
    const key = this.accessKey || process.env.AIHUBMIX_ACCESS_KEY || '';
    if (!key) {
      throw new Error('AIHUBMIX_ACCESS_KEY is required for account management.');
    }
    // Bearer prefix is optional; both forms accepted
    return { Authorization: key.startsWith('Bearer ') ? key : `Bearer ${key}` };
  }

  /**
   * GET /api/user/self — Read account profile, quota, and used quota
   */
  public async getUserSelf(): Promise<AIHubMixUserProfile> {
    try {
      const res = await axios.get<{ success: boolean; message?: string; data: AIHubMixUserProfile }>(
        `${this.apiBaseUrl}/user/self`,
        { headers: this.getAuthHeader(), timeout: 15000 }
      );
      return res.data.data;
    } catch (err) {
      logger.error('Failed to fetch AIHubMix user profile:', err);
      throw err;
    }
  }

  /**
   * GET /api/user/available_models — Read models available to the group
   */
  public async getAvailableModels(): Promise<string[]> {
    try {
      const res = await axios.get<{ success: boolean; data: string[] }>(
        `${this.apiBaseUrl}/user/available_models`,
        { headers: this.getAuthHeader(), timeout: 15000 }
      );
      return res.data.data || [];
    } catch (err) {
      logger.error('Failed to fetch AIHubMix available models:', err);
      throw err;
    }
  }

  /**
   * GET /api/user/token — Rotates the Access Key immediately (DESTRUCTIVE write)
   */
  // fallow-ignore-next-line unused-class-member
  public async rotateAccessKey(): Promise<string> {
    try {
      logger.warn('Rotating AIHubMix Access Key — previous key will be invalidated immediately');
      const res = await axios.get<{ success: boolean; data: string }>(
        `${this.apiBaseUrl}/user/token`,
        { headers: this.getAuthHeader(), timeout: 15000 }
      );
      return res.data.data;
    } catch (err) {
      logger.error('Failed to rotate AIHubMix Access Key:', err);
      throw err;
    }
  }

  /**
   * GET /api/token/ — List API keys
   */
  public async listTokens(p: number = 0, size: number = 20): Promise<AIHubMixToken[]> {
    try {
      const res = await axios.get<{ success: boolean; data: AIHubMixToken[] }>(
        `${this.apiBaseUrl}/token/?p=${p}&size=${size}`,
        { headers: this.getAuthHeader(), timeout: 15000 }
      );
      return res.data.data || [];
    } catch (err) {
      logger.error('Failed to list AIHubMix tokens:', err);
      throw err;
    }
  }

  /**
   * GET /api/token/search — Search API keys by keyword
   */
  public async searchTokens(keyword: string): Promise<AIHubMixToken[]> {
    try {
      const res = await axios.get<{ success: boolean; data: AIHubMixToken[] }>(
        `${this.apiBaseUrl}/token/search?keyword=${encodeURIComponent(keyword)}`,
        { headers: this.getAuthHeader(), timeout: 15000 }
      );
      return res.data.data || [];
    } catch (err) {
      logger.error('Failed to search AIHubMix tokens:', err);
      throw err;
    }
  }

  /**
   * GET /api/token/:id — Show one API key
   */
  // fallow-ignore-next-line unused-class-member
  public async getToken(id: number): Promise<AIHubMixToken> {
    try {
      const res = await axios.get<{ success: boolean; data: AIHubMixToken }>(
        `${this.apiBaseUrl}/token/${id}`,
        { headers: this.getAuthHeader(), timeout: 15000 }
      );
      return res.data.data;
    } catch (err) {
      logger.error(`Failed to fetch AIHubMix token ${id}:`, err);
      throw err;
    }
  }

  /**
   * POST /api/token/ — Create an API key
   */
  public async createToken(params: CreateTokenParams): Promise<AIHubMixToken> {
    try {
      const payload = {
        name: params.name,
        remain_quota: params.remain_quota ?? 500000,
        unlimited_quota: params.unlimited_quota ?? false,
        expired_time: params.expired_time ?? -1,
        models: params.models, // comma-separated string
      };

      const res = await axios.post<{ success: boolean; data: AIHubMixToken }>(
        `${this.apiBaseUrl}/token/`,
        payload,
        { headers: { ...this.getAuthHeader(), 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      return res.data.data;
    } catch (err) {
      logger.error('Failed to create AIHubMix API token:', err);
      throw err;
    }
  }

  /**
   * PUT /api/token/ — Update an API key
   */
  // fallow-ignore-next-line unused-class-member
  public async updateToken(token: Partial<AIHubMixToken> & { id: number }): Promise<boolean> {
    try {
      const res = await axios.put<{ success: boolean }>(
        `${this.apiBaseUrl}/token/`,
        token,
        { headers: { ...this.getAuthHeader(), 'Content-Type': 'application/json' }, timeout: 15000 }
      );
      return res.data.success;
    } catch (err) {
      logger.error(`Failed to update AIHubMix token ${token.id}:`, err);
      throw err;
    }
  }

  /**
   * DELETE /api/token/:id — Delete an API key
   */
  // fallow-ignore-next-line unused-class-member
  public async deleteToken(id: number): Promise<boolean> {
    try {
      const res = await axios.delete<{ success: boolean }>(
        `${this.apiBaseUrl}/token/${id}`,
        { headers: this.getAuthHeader(), timeout: 15000 }
      );
      return res.data.success;
    } catch (err) {
      logger.error(`Failed to delete AIHubMix token ${id}:`, err);
      throw err;
    }
  }
}

/**
 * AIHubMix Provider — Universal multi-model LLM API integration.
 * Connects to AIHubMix model endpoints (https://aihubmix.com/v1) with quota-aware error handling.
 */
export class AIHubMixProvider {
  private apiKey: string;
  private baseUrl: string;
  private accountService: AIHubMixAccountService;

  constructor(apiKey?: string, baseUrl = 'https://aihubmix.com/v1') {
    this.apiKey = apiKey || process.env.AIHUBMIX_API_KEY || '';
    this.baseUrl = baseUrl;
    this.accountService = new AIHubMixAccountService();
  }

  private async resolveApiKey(): Promise<string> {
    if (this.apiKey) return this.apiKey;
    if (process.env.AIHUBMIX_API_KEY) return process.env.AIHUBMIX_API_KEY;

    // If only AIHUBMIX_ACCESS_KEY is present, auto-discover or issue an sk- key
    if (process.env.AIHUBMIX_ACCESS_KEY) {
      try {
        const tokens = await this.accountService.listTokens(0, 10);
        const active = tokens.find(t => t.status === 1 && t.key);
        if (active) {
          this.apiKey = active.key;
          return this.apiKey;
        }

        // Auto-provision a default token
        const created = await this.accountService.createToken({
          name: 'agri-decision-support-key',
          unlimited_quota: true,
        });
        if (created?.key) {
          this.apiKey = created.key;
          return this.apiKey;
        }
      } catch (err) {
        logger.debug('Could not auto-provision AIHubMix sk- key from access key:', err);
      }
    }

    return '';
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey || process.env.AIHUBMIX_API_KEY || process.env.AIHUBMIX_ACCESS_KEY);
  }

  public async chat(req: AIHubMixRequest): Promise<string> {
    const key = await this.resolveApiKey();
    if (!key) {
      throw new Error('AIHubMix API key not configured (AIHUBMIX_API_KEY or AIHUBMIX_ACCESS_KEY missing).');
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
            Authorization: key.startsWith('Bearer ') ? key : `Bearer ${key}`,
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
