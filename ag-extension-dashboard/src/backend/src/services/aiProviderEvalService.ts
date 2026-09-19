// fallow-ignore-file unused-file
/**
 * AI provider eval harness — detects quality drift across the fallback cascade.
 *
 * omniRouteService fails over across 7 providers; without measurement a
 * degraded free-model fallback can silently lower agronomic advice quality.
 * Record every attempt (provider, latency, outcome, officer-rated quality) and
 * evaluate() yields per-provider success rate, p50 latency, and mean quality
 * with a blocklist recommendation for providers below floor.
 */
export interface ProviderAttempt {
  provider: string;
  model: string;
  latencyMs: number;
  success: boolean;
  qualityScore?: number; // 0..1 officer rating, optional
}

export interface ProviderEval {
  provider: string;
  attempts: number;
  successRate: number;
  p50LatencyMs: number;
  meanQuality: number | null;
  recommendBlock: boolean;
}

const MIN_ATTEMPTS_FOR_BLOCK = 20;
const MIN_SUCCESS_RATE = 0.9;
const MIN_MEAN_QUALITY = 0.6;

export function evaluateProviders(attempts: ProviderAttempt[]): ProviderEval[] {
  const byProvider = new Map<string, ProviderAttempt[]>();
  for (const a of attempts) {
    const list = byProvider.get(a.provider) ?? [];
    list.push(a);
    byProvider.set(a.provider, list);
  }
  const evals: ProviderEval[] = [];
  for (const [provider, list] of byProvider) {
    const success = list.filter(a => a.success).length;
    const latencies = list.map(a => a.latencyMs).sort((x, y) => x - y);
    const qualities = list.map(a => a.qualityScore).filter((q): q is number => typeof q === 'number');
    const meanQuality = qualities.length === 0 ? null : +(qualities.reduce((s, q) => s + q, 0) / qualities.length).toFixed(3);
    const successRate = +(success / list.length).toFixed(3);
    evals.push({
      provider,
      attempts: list.length,
      successRate,
      p50LatencyMs: latencies[Math.floor((latencies.length - 1) / 2)],
      meanQuality,
      recommendBlock:
        list.length >= MIN_ATTEMPTS_FOR_BLOCK &&
        (successRate < MIN_SUCCESS_RATE || (meanQuality !== null && meanQuality < MIN_MEAN_QUALITY)),
    });
  }
  return evals.sort((a, b) => b.successRate - a.successRate);
}
