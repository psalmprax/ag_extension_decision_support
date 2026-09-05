import axios from 'axios';
import { logger } from '../../../utils/logger';
import { config } from '@/config';
import { normalizeToolDefinitions, normalizeMessages, normalizeToolCalls } from '../toolCalling';
import {
  BaseAIProvider,
  AIProviderType,
  TextGenerationOptions,
  TextGenerationResult,
  EmbeddingOptions,
  EmbeddingResult,
  ReasoningOptions,
  ReasoningResult,
  ClassificationOptions,
  ClassificationResult,
} from '../types';
import { REASONING_SYSTEM_PROMPT, extractVisuals, buildGroundedReasoningPrompt } from '../assetLibrary';

export interface AIHubMixRequest {
  model?: string;
  messages: Array<{ role: string; content: string | null; [k: string]: unknown }>;
  temperature?: number;
  max_tokens?: number;
  tools?: unknown[];
  web_search?: boolean;
  web_search_options?: Record<string, unknown>;
}

export interface AIHubMixResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: unknown[];
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
    this.accessKey = accessKey || process.env.AIHUBMIX_ACCESS_KEY || config.aihubmix?.accessKey || '';
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
 * AIHubMix Provider — Native client for AIHubMix OpenAI-compatible proxy.
 * Connects to AIHubMix model endpoints (https://aihubmix.com/v1) with quota-aware error handling.
 */
export class AIHubMixProvider extends BaseAIProvider {
  readonly provider: AIProviderType = 'aihubmix';
  readonly capabilities: string[] = ['text', 'chat', 'reasoning', 'embedding'];

  private apiKey: string;
  private baseUrl: string;
  private accountService: AIHubMixAccountService;

  constructor(apiKey?: string, baseUrl = 'https://aihubmix.com/v1') {
    super();
    this.apiKey = apiKey || process.env.AIHUBMIX_API_KEY || config.aihubmix?.apiKey || '';
    this.baseUrl = baseUrl;
    this.accountService = new AIHubMixAccountService();
  }

  private async resolveApiKey(): Promise<string> {
    if (this.apiKey) return this.apiKey;
    if (process.env.AIHUBMIX_API_KEY) return process.env.AIHUBMIX_API_KEY;
    if (config.aihubmix?.apiKey) return config.aihubmix.apiKey;

    // If only AIHUBMIX_ACCESS_KEY is present, auto-discover or issue an sk- key
    const accessKey = process.env.AIHUBMIX_ACCESS_KEY || config.aihubmix?.accessKey;
    if (accessKey) {
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

  public override isConfigured(): boolean {
    return Boolean(
      this.apiKey ||
      process.env.AIHUBMIX_API_KEY ||
      config.aihubmix?.apiKey ||
      process.env.AIHUBMIX_ACCESS_KEY ||
      config.aihubmix?.accessKey
    );
  }

  public override async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      const key = await this.resolveApiKey();
      if (!key) return false;

      const authHeader = key.startsWith('Bearer ') ? key : `Bearer ${key}`;
      const probeModel = process.env.AI_PRIMARY_MODEL || 'gemini-2.5-flash';

      // 10s timeout to tolerate remote proxy and multi-model routing latency
      try {
        await axios.post(
          `${this.baseUrl}/chat/completions`,
          { model: probeModel, messages: [{ role: 'user', content: 'ping' }], max_tokens: 2 },
          { headers: { Authorization: authHeader, 'Content-Type': 'application/json' }, timeout: 10000 }
        );
      } catch (postErr) {
        const status = (postErr as { response?: { status?: number } }).response?.status;
        // If specific model rejected (400/404), probe credentials via standard /models
        if (status === 400 || status === 404) {
          await axios.get(`${this.baseUrl}/models`, {
            headers: { Authorization: authHeader },
            timeout: 10000,
          });
        } else {
          throw postErr;
        }
      }

      this.recordHealthError();
      return true;
    } catch (err) {
      // A configured-but-failing provider is unhealthy; reporting "configured"
      // here would route live traffic into a dead endpoint.
      const status = (err as { response?: { status?: number } }).response?.status;
      this.recordHealthError(status ? `HTTP ${status}` : (err as Error).message);
      return false;
    }
  }

  public async chat(req: AIHubMixRequest): Promise<string> {
    const result = await this.chatRaw(req);
    const content = result.choices?.[0]?.message?.content;
    if (!content && !result.choices?.[0]?.message?.tool_calls?.length) {
      throw new Error('Empty completion content returned from AIHubMix.');
    }
    return content || '';
  }

  /** Full chat completion including tool_calls and optional web search (OpenAI-compatible). */
  public async chatRaw(req: AIHubMixRequest): Promise<AIHubMixResponse> {
    const key = await this.resolveApiKey();
    if (!key) {
      throw new Error('AIHubMix API key not configured (AIHUBMIX_API_KEY or AIHUBMIX_ACCESS_KEY missing).');
    }

    const model = req.model || process.env.AI_PRIMARY_MODEL || 'gemini-2.5-flash';
    const enableWebSearch = req.web_search ?? (process.env.AIHUBMIX_WEB_SEARCH !== 'false');

    const makeRequest = (withWebSearch: boolean) => {
      const payload: Record<string, unknown> = {
        model,
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.max_tokens ?? 4096,
        ...(req.tools && req.tools.length > 0 ? { tools: req.tools, tool_choice: 'auto' } : {}),
      };
      if (withWebSearch) {
        payload.web_search = true;
        payload.web_search_options = req.web_search_options || {};
      }
      return axios.post<AIHubMixResponse>(
        `${this.baseUrl}/chat/completions`,
        payload,
        {
          headers: {
            Authorization: key.startsWith('Bearer ') ? key : `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        }
      );
    };

    try {
      logger.info(`Routing request to AIHubMix provider (model: ${model}, web_search: ${enableWebSearch})`);
      const response = await makeRequest(enableWebSearch);

      if (!response.data?.choices?.length) {
        throw new Error('Empty completion returned from AIHubMix.');
      }

      return response.data;
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: unknown }; message?: string };
      const status = axiosError.response?.status;
      const responseBodyStr = JSON.stringify(axiosError.response?.data || '');

      // If the model rejects web_search_options (e.g. 400 unknown parameter), retry once without it
      if (enableWebSearch && (status === 400 || status === 422) && (responseBodyStr.includes('web_search') || responseBodyStr.includes('unknown') || responseBodyStr.includes('parameter'))) {
        logger.warn(`AIHubMix model ${model} does not accept web_search_options, retrying without parameter...`);
        try {
          const retryResponse = await makeRequest(false);
          if (retryResponse.data?.choices?.length) {
            return retryResponse.data;
          }
        } catch (retryErr) {
          logger.error(`AIHubMix retry without web_search failed:`, retryErr);
        }
      }

      if (status === 429 || responseBodyStr.includes('insufficient_user_quota') || responseBodyStr.includes('quota')) {
        logger.warn(`AIHubMix quota/rate limit exceeded (HTTP ${status}) for model ${model}. Triggering OmniRoute failover.`);
        throw new Error(`AIHUBMIX_QUOTA_EXCEEDED: Quota limit reached for ${model}`);
      }

      logger.error(`AIHubMix API error (${status || 'Network'}):`, axiosError.message);
      throw err;
    }
  }

  public override async generateText(
    prompt: string | Array<{ role: string; content: string }>,
    options?: TextGenerationOptions
  ): Promise<TextGenerationResult> {
    const messages = normalizeMessages(prompt) as AIHubMixRequest['messages'];
    const model = options?.model || process.env.AI_PRIMARY_MODEL || 'gemini-2.5-flash';
    const tools = normalizeToolDefinitions(options?.tools);
    const raw = await this.chatRaw({
      model,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens ?? 4096,
      tools,
      web_search: options?.webSearch,
      web_search_options: options?.webSearchOptions,
    });
    const choice = raw.choices[0];
    if (choice?.finish_reason === 'length') {
      logger.warn(`AIHubMix completion for model ${model} reached finish_reason='length' (truncated). Prompt tokens: ${raw.usage?.prompt_tokens}, completion tokens: ${raw.usage?.completion_tokens}`);
    }

    return {
      text: choice?.message?.content || (choice?.message as { reasoning_content?: string })?.reasoning_content || '',
      toolCalls: normalizeToolCalls(choice?.message?.tool_calls as unknown[]),
      model,
      usage: raw.usage ? {
        promptTokens: raw.usage.prompt_tokens ?? 0,
        completionTokens: raw.usage.completion_tokens ?? 0,
        totalTokens: raw.usage.total_tokens ?? 0,
      } : undefined,
      finishReason: choice?.finish_reason,
    };
  }

  public override async createEmbedding(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult> {
    const key = await this.resolveApiKey();
    if (!key) throw new Error('AIHubMix API key missing for embeddings');

    const model = options?.model || process.env.AI_EMBEDDINGS_MODEL || 'text-embedding-3-large';
    const response = await axios.post(
      `${this.baseUrl}/embeddings`,
      { model, input: text },
      {
        headers: { Authorization: `Bearer ${key}` },
        timeout: 15000,
      }
    );

    return {
      embedding: response.data.data[0].embedding,
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
      model: options?.model || process.env.AI_PRIMARY_MODEL || 'gemini-2.5-flash',
      temperature: options?.temperature ?? 0.2,
      maxTokens: Math.max(options?.maxTokens ?? 4096, 4096),
      tools: options?.tools,
      webSearch: options?.webSearch ?? true,
      webSearchOptions: options?.webSearchOptions,
    });

    const text = result.text ?? '';
    const visuals = extractVisuals(text);

    const cleanAnswer = text
      .replace(/<visuals>[\s\S]*?<\/visuals>/gi, '')
      .replace(/```json[\s\S]*?```/gi, '')
      .trim();

    return {
      reasoning: `Detailed Intelligence Analysis completed via AIHubMix (${result.model || 'gemini-2.5-flash'}).`,
      answer: cleanAnswer,
      confidence: 0.95,
      visuals,
      toolCalls: result.toolCalls as any,
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
