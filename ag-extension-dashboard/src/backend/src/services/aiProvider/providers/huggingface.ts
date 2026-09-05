/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import { logger } from '../../../utils/logger';
import { normalizeToolDefinitions, normalizeMessages, normalizeToolCalls } from '../toolCalling';
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

export interface HuggingFaceRequest {
  model?: string;
  messages: Array<{ role: string; content: string | null; [k: string]: unknown }>;
  temperature?: number;
  max_tokens?: number;
  tools?: unknown[];
}

export interface HuggingFaceResponse {
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
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

/**
 * Hugging Face Provider — OpenAI-compatible chat completions via the HF
 * Inference Providers router (https://router.huggingface.co/v1).
 * Reads HUGGINGFACE_API_KEY (hf_...) from the environment.
 */
export class HuggingFaceProvider extends BaseAIProvider {
  readonly provider: AIProviderType = 'huggingface';
  readonly capabilities: string[] = ['text', 'chat', 'reasoning', 'tool-use'];
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
      await axios.post(
        `${this.baseUrl}/chat/completions`,
        { model: 'meta-llama/Llama-3.1-8B-Instruct', messages: [{ role: 'user', content: 'ping' }], max_tokens: 2 },
        { headers: { Authorization: `Bearer ${this.getApiKey()}` }, timeout: 3000 }
      );
      this.recordHealthError();
      return true;
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      this.recordHealthError(status ? `HTTP ${status}` : (err as Error).message);
      return false;
    }
  }

  public override async generateText(
    prompt: string | Array<{ role: string; content: string }>,
    options?: TextGenerationOptions
  ): Promise<TextGenerationResult> {
    const messages = normalizeMessages(prompt) as any[];
    const model = options?.model || process.env.HUGGINGFACE_PRIMARY_MODEL || 'meta-llama/Llama-3.3-70B-Instruct';
    const tools = normalizeToolDefinitions(options?.tools);

    const raw = await this.chatRaw({
      model,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens ?? 4096,
      tools,
    });
    const choice = raw.choices?.[0];

    return {
      text: choice?.message?.content || '',
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

  public async chat(req: HuggingFaceRequest): Promise<string> {
    const raw = await this.chatRaw(req);
    const content = raw.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty completion content returned from Hugging Face.');
    }
    return content;
  }

  private async chatRaw(req: HuggingFaceRequest): Promise<HuggingFaceResponse> {
    const key = this.getApiKey();
    if (!key) {
      throw new Error('Hugging Face API key not configured (HUGGINGFACE_API_KEY missing).');
    }

    const model = req.model || process.env.HUGGINGFACE_PRIMARY_MODEL || 'meta-llama/Llama-3.3-70B-Instruct';

    try {
      logger.info(`Routing request to Hugging Face provider (model: ${model})`);

      const payload: Record<string, unknown> = {
        model,
        messages: req.messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.max_tokens ?? 4096,
        ...(req.tools && (req.tools as any[]).length > 0 ? { tools: req.tools, tool_choice: 'auto' } : {}),
      };

      const response = await axios.post<HuggingFaceResponse>(
        `${this.baseUrl}/chat/completions`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        }
      );

      return response.data;
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: unknown }; message?: string };
      const status = axiosError.response?.status;
      const responseBodyStr = JSON.stringify(axiosError.response?.data || '');

      if (status === 429 || status === 402 || responseBodyStr.includes('quota') || responseBodyStr.includes('exceeded')) {
        logger.warn(`Hugging Face quota/rate limit exceeded (HTTP ${status}) for model ${model}. Triggering OmniRoute failover.`);
        throw new Error(`HUGGINGFACE_QUOTA_EXCEEDED: Quota/Rate limit reached for ${model}`);
      }

      logger.error(`Hugging Face API error (${status || 'Network'}):`, axiosError.message);
      throw err;
    }
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

    const model = options?.model || process.env.HUGGINGFACE_PRIMARY_MODEL || 'meta-llama/Llama-3.3-70B-Instruct';

    const result = await this.generateText(messages, {
      model,
      temperature: options?.temperature ?? 0.2,
      maxTokens: Math.max(options?.maxTokens ?? 4096, 4096),
      tools: options?.tools,
    });

    const text = result.text ?? '';
    const visuals = extractVisuals(text);

    const cleanAnswer = text
      .replace(/<visuals>[\s\S]*?<\/visuals>/gi, '')
      .replace(/```json[\s\S]*?```/gi, '')
      .trim();

    return {
      reasoning: `Detailed Intelligence Analysis completed via Hugging Face (${result.model || model}).`,
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
