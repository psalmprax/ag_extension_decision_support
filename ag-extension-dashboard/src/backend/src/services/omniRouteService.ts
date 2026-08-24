import { AIHubMixProvider } from './aiProvider/providers/aihubmix';
import { OpenRouterProvider } from './aiProvider/providers/openRouter';
import { HuggingFaceProvider } from './aiProvider/providers/huggingface';
import { NVIDIAProvider } from './aiProvider/providers/nvidia';
import { logger } from '../utils/logger';

export interface RouteCandidate {
  providerName: 'aihubmix' | 'openrouter' | 'groq' | 'openai' | 'ollama' | 'huggingface' | 'nvidia';
  model: string;
  score: number;
  isFree?: boolean;
}

/**
 * Score-sorted, quota-aware failover LLM router.
 * Includes comprehensive catalog of top FREE LLMs across AIHubMix and OpenRouter.
 */
export class OmniRouteService {
  private static blocklist: Set<string> = new Set();
  private static aihubmix = new AIHubMixProvider();
  private static openrouter = new OpenRouterProvider();
  private static huggingface = new HuggingFaceProvider();
  private static nvidia = new NVIDIAProvider();

  public static readonly FREE_LLM_CATALOG: RouteCandidate[] = [
    // --- AIHubMix Free LLM Tier ---
    { providerName: 'aihubmix', model: 'gpt-5.5-free', score: 100, isFree: true },
    { providerName: 'aihubmix', model: 'google/gemini-2.0-flash-exp:free', score: 98, isFree: true },
    { providerName: 'aihubmix', model: 'deepseek-ai/DeepSeek-V3', score: 95, isFree: true },
    { providerName: 'aihubmix', model: 'meta-llama/Llama-3.3-70b-instruct:free', score: 92, isFree: true },
    { providerName: 'aihubmix', model: 'qwen/qwen-2.5-coder-32b-instruct:free', score: 88, isFree: true },

    // --- OpenRouter Free LLM Tier ---
    { providerName: 'openrouter', model: 'google/gemini-2.0-flash-exp:free', score: 97, isFree: true },
    { providerName: 'openrouter', model: 'google/gemini-2.0-flash-lite-preview-02-05:free', score: 94, isFree: true },
    { providerName: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct:free', score: 91, isFree: true },
    { providerName: 'openrouter', model: 'deepseek/deepseek-r1:free', score: 90, isFree: true },
    { providerName: 'openrouter', model: 'mistralai/mistral-7b-instruct:free', score: 85, isFree: true },
    { providerName: 'openrouter', model: 'qwen/qwen-2-7b-instruct:free', score: 82, isFree: true },

    // --- Groq High-Speed Free Tier ---
    { providerName: 'groq', model: 'llama-3.3-70b-versatile', score: 89, isFree: true },
    { providerName: 'groq', model: 'mixtral-8x7b-32768', score: 86, isFree: true },
    { providerName: 'groq', model: 'gemma2-9b-it', score: 84, isFree: true },

    // --- Hugging Face Inference Router ---
    { providerName: 'huggingface', model: 'mistralai/Mistral-7B-Instruct-v0.3', score: 83, isFree: true },
    { providerName: 'huggingface', model: 'google/gemma-2-9b-it', score: 80, isFree: true },

    // --- NVIDIA NIM Free Credits ---
    { providerName: 'nvidia', model: 'meta/llama-3.1-8b-instruct', score: 82, isFree: true },
    { providerName: 'nvidia', model: 'nvidia/llama-3.1-nemotron-70b-instruct', score: 85, isFree: true },

    // --- OpenAI Fallback Paid ---
    { providerName: 'openai', model: 'gpt-4o-mini', score: 80, isFree: false },
  ];

  private static async tryCandidate(
    candidate: RouteCandidate,
    messages: Array<{ role: string; content: string }>
  ): Promise<{ text: string; providerUsed: string; modelUsed: string; isFreeModel: boolean } | null> {
    if (candidate.providerName === 'aihubmix' && this.aihubmix.isConfigured()) {
      const text = await this.aihubmix.chat({ model: candidate.model, messages });
      return { text, providerUsed: 'aihubmix', modelUsed: candidate.model, isFreeModel: !!candidate.isFree };
    }

    if (candidate.providerName === 'openrouter' && this.openrouter.isConfigured()) {
      const text = await this.openrouter.chat({ model: candidate.model, messages });
      return { text, providerUsed: 'openrouter', modelUsed: candidate.model, isFreeModel: !!candidate.isFree };
    }

    if (candidate.providerName === 'huggingface' && this.huggingface.isConfigured()) {
      const text = await this.huggingface.chat({ model: candidate.model, messages });
      return { text, providerUsed: 'huggingface', modelUsed: candidate.model, isFreeModel: !!candidate.isFree };
    }

    if (candidate.providerName === 'nvidia' && this.nvidia.isConfigured()) {
      const text = await this.nvidia.chat({ model: candidate.model, messages });
      return { text, providerUsed: 'nvidia', modelUsed: candidate.model, isFreeModel: !!candidate.isFree };
    }

    return null;
  }

  /**
   * OmniRoute Execution with automatic in-flight failover across free & paid models.
   */
  public static async executeWithFailover(
    messages: Array<{ role: string; content: string }>,
    candidates: RouteCandidate[] = OmniRouteService.FREE_LLM_CATALOG
  ): Promise<{ text: string; providerUsed: string; modelUsed: string; isFreeModel: boolean }> {
    const sorted = [...candidates].sort((a, b) => b.score - a.score);

    for (const candidate of sorted) {
      const key = `${candidate.providerName}:${candidate.model}`;

      if (this.blocklist.has(key)) {
        logger.warn(`[OmniRoute] Skipping blocked model: ${key}`);
        continue;
      }

      try {
        const result = await this.tryCandidate(candidate, messages);
        if (result) return result;
      } catch (err: unknown) {
        const errorMsg = (err as Error).message || '';
        if (errorMsg.includes('QUOTA') || errorMsg.includes('429') || errorMsg.includes('402')) {
          logger.warn(`[OmniRoute] Quota hit for ${key}. Adding to 15m blocklist.`);
          this.blocklist.add(key);
          setTimeout(() => this.blocklist.delete(key), 15 * 60 * 1000);
        }
        logger.warn(`[OmniRoute] ${key} failed. Transitioning to next candidate...`);
      }
    }

    // Fail loudly: serving a canned diagnosis-shaped response in an agricultural
    // decision-support system is dangerous. Callers surface the error instead.
    logger.error(`[OmniRoute] All ${sorted.length} candidate model(s) exhausted — no provider available`);
    throw new Error(
      `OmniRoute exhausted all ${sorted.length} candidate model(s) — no free or paid fallback provider is configured and healthy`
    );
  }
}
