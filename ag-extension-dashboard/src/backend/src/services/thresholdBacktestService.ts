// fallow-ignore-file unused-file
/**
 * Threshold backtest runner — replaces hand-picked cutoffs (credit tiers,
 * DBSCAN epsilon bands, VPD irrigation triggers, hazard thresholds) with
 * measured precision/recall/F1 against labeled historical seasons.
 *
 * Feed labeled samples (score + ground-truth positive flag); sweep() reports
 * per-candidate-threshold metrics so cutoff changes ship with evidence.
 */
export interface LabeledSample {
  score: number;
  positive: boolean;
}

export interface ThresholdMetrics {
  threshold: number;
  precision: number;
  recall: number;
  f1: number;
  predictedPositives: number;
}

function prf(tp: number, fp: number, fn: number): { precision: number; recall: number; f1: number } {
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision: +precision.toFixed(3), recall: +recall.toFixed(3), f1: +f1.toFixed(3) };
}

export function sweepThresholds(samples: LabeledSample[], candidates: number[]): ThresholdMetrics[] {
  if (samples.length === 0) throw new Error('Backtest requires at least one labeled sample');
  if (candidates.length === 0) throw new Error('Backtest requires at least one candidate threshold');
  return candidates.map(threshold => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const s of samples) {
      const predicted = s.score >= threshold;
      if (predicted && s.positive) tp += 1;
      else if (predicted && !s.positive) fp += 1;
      else if (!predicted && s.positive) fn += 1;
    }
    return { threshold, ...prf(tp, fp, fn), predictedPositives: tp + fp };
  });
}

export function bestThreshold(metrics: ThresholdMetrics[]): ThresholdMetrics {
  return [...metrics].sort((a, b) => b.f1 - a.f1 || b.threshold - a.threshold)[0];
}
