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

/***
 * Score-sorted, quota-aware failover LLM router with dynamic 2-model switching.
 * Supports automatic model rotation between two primary candidates based on success rates,
 * quota exhaustion, and response latency. Falls back to full catalog if both primary models fail.
 */
export class OmniRouteService {
  private static blocklist: Set<string> = new Set();
  private static aihubmix = new AIHubMixProvider();
  private static openrouter = new OpenRouterProvider();
  private static huggingface = new HuggingFaceProvider();
  private static nvidia = new NVIDIAProvider();

  // Dynamic 2-model switching configuration
  private static primaryCandidates: RouteCandidate[] = [];
  private static secondaryCandidates: RouteCandidate[] = [];
  private static modelRotationCounter = 0;
  private static consecutiveFailures: Map<string, number> = new Map();
  private static modelSuccessRates: Map<string, number> = new Map();

  /*** Initialize dynamic 2-model switching with top 2 catalog candidates */
    public static initializeDynamicSwitching(catalog: RouteCandidate[]): void {
      // Separate free and paid models, sort each by score descending
      const freeModels = catalog
        .filter((c) => c.isFree)
        .sort((a, b) => b.score - a.score);
      const paidModels = catalog
        .filter((c) => !c.isFree)
        .sort((a, b) => b.score - a.score);

      // Take top 2 free models as primary candidates
      // If fewer than 2 free, fill remaining with highest-scored paid models
      this.primaryCandidates = [];
      for (let i = 0; i < 2; i++) {
        if (i < freeModels.length) {
          this.primaryCandidates.push(freeModels[i]);
        } else if (i - freeModels.length < paidModels.length) {
          this.primaryCandidates.push(paidModels[i - freeModels.length]);
        }
      }

      // Secondary candidates: the next best models regardless of free/paid
      // Combine remaining free + paid, sorted by score
      const remaining = [
        ...freeModels.slice(2),
        ...paidModels,
      ].sort((a, b) => b.score - a.score);
      this.secondaryCandidates = remaining.slice(0, 2);

      logger.info(`[OmniRoute] Free-model priority switching initialized`);
      logger.info(`[OmniRoute] Primary (free-first): ${this.primaryCandidates
        .map((c) => c.providerName + ':' + c.model + (c.isFree ? ' [FREE]' : ''))
        .join(', ')}`);
      logger.info(`[OmniRoute] Secondary: ${this.secondaryCandidates
        .map((c) => c.providerName + ':' + c.model + (c.isFree ? ' [FREE]' : ''))
        .join(', ')}`);
      logger.info(`[OmniRoute] Free models available: ${catalog.filter((c) => c.isFree).length}`);
      logger.info(`[OmniRoute] Paid models available: ${catalog.filter((c) => !c.isFree).length}`);
    }

  /** Get current primary model for rotation */
  public static getCurrentPrimary(): RouteCandidate | null {
    if (this.primaryCandidates.length === 0) return null;
    return this.primaryCandidates[this.modelRotationCounter % this.primaryCandidates.length];
  }

  /** Rotate to next primary model in the pair */
  public static rotatePrimary(): void {
    this.modelRotationCounter++;
    logger.debug(`[OmniRoute] Rotated primary model (counter: ${this.modelRotationCounter})`);
  }

  /** Record a success for a model */
  public static recordSuccess(modelKey: string): void {
    const current = this.modelSuccessRates.get(modelKey) || 0;
    this.modelSuccessRates.set(modelKey, current + 1);
    // Rotate after 2 consecutive successes to balance load
    if (current + 1 >= 2) {
      this.rotatePrimary();
      this.modelSuccessRates.clear();
    }
  }

  /** Record a failure for a model */
  public static recordFailure(modelKey: string): void {
    const current = this.consecutiveFailures.get(modelKey) || 0;
    this.consecutiveFailures.set(modelKey, current + 1);
    // After 2 failures, consider switching
    if (current + 1 >= 2) {
      this.rotatePrimary();
      this.consecutiveFailures.clear();
    }
  }

  /** Get the full catalog (for fallback) */
  public static getFullCatalog(): RouteCandidate[] {
    // Reconstruct from the original - in production, store reference
    return [
      // AIHubMix Free Tier
      { providerName: 'aihubmix', model: 'gpt-5.5-free', score: 100, isFree: true },
      { providerName: 'aihubmix', model: 'google/gemini-2.0-flash-exp:free', score: 98, isFree: true },
      { providerName: 'aihubmix', model: 'deepseek-ai/DeepSeek-V3', score: 95, isFree: true },
      // ... rest of catalog would be loaded from original source
    ];
  }

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
    { providerName: 'openrouter', model: 'meta-llama/Llama-3.3-70b-instruct:free', score: 91, isFree: true },
    { providerName: 'openrouter', model: 'deepseek/deepseek-r1:free', score: 90, isFree: true },
    { providerName: 'openrouter', model: 'mistralai/mistral-7b-instruct:free', score: 85, isFree: true },
    { providerName: 'openrouter', model: 'qwen/qwen-2-7b-instruct:free', score: 82, isFree: true },

    // --- Groq High-Speed Free Tier ---
    { providerName: 'groq', model: 'compound', score: 88, isFree: true },
    { providerName: 'groq', model: 'compound-mini', score: 87, isFree: true },
    { providerName: 'groq', model: 'llama-3.3-70b-versatile', score: 89, isFree: true },
    { providerName: 'groq', model: 'mixtral-8x7b-32768', score: 86, isFree: true },

    // --- Hugging Face Inference Router ---
    { providerName: 'huggingface', model: 'mistralai/Mistral-7B-Instruct-v0.3', score: 83, isFree: true },
    { providerName: 'huggingface', model: 'google/gemma-2-9b-it', score: 80, isFree: true },

    // --- NVIDIA NIM Free Credits ---
    { providerName: 'nvidia', model: 'meta/llama-3.1-8b-instruct', score: 82, isFree: true },
    { providerName: 'nvidia', model: 'nvidia/llama-3.1-nemotron-70b-instruct', score: 85, isFree: true },

    // --- OpenAI Fallback Paid ---
    { providerName: 'openai', model: 'gpt-4o-mini', score: 80, isFree: false }
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
