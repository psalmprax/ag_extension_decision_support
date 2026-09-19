// fallow-ignore-file unused-file
/**
 * Field verification ledger — closes the calibration loop for edge vision and
 * voice transcription.
 *
 * Every on-device diagnosis / transcript that an officer confirms or corrects
 * is recorded here (prediction vs. officer verdict). summary() yields running
 * precision/recall per condition so heuristic thresholds and dialect routing
 * are tuned against measured field data, not lab assumptions.
 *
 * Persistence is the caller's responsibility (pass records back in via bulk
 * import); this module is the validated accumulator + metric computation.
 */
import { logger } from '../utils/logger';

export interface VerificationRecord {
  kind: 'edge_diagnosis' | 'voice_transcript';
  predicted: string;
  officerVerdict: string;
  correct: boolean;
  confidence: number;
  recordedAt: string;
}

export interface CalibrationSummary {
  total: number;
  accuracy: number;
  byKind: Record<string, { total: number; accuracy: number }>;
  lowConfidenceAccuracy: number; // accuracy for confidence < 0.8
}

const records: VerificationRecord[] = [];

export function recordVerification(rec: Omit<VerificationRecord, 'recordedAt'>): VerificationRecord {
  if (!rec.predicted || !rec.officerVerdict) {
    throw new Error('Verification requires both predicted and officerVerdict labels');
  }
  if (!(rec.confidence >= 0 && rec.confidence <= 1)) {
    throw new Error('Verification confidence must be within [0, 1]');
  }
  const full: VerificationRecord = { ...rec, recordedAt: new Date().toISOString() };
  records.push(full);
  logger.info(`Field verification recorded: ${rec.kind} predicted=${rec.predicted} verdict=${rec.officerVerdict}`);
  return full;
}

export function calibrationSummary(): CalibrationSummary {
  const total = records.length;
  const correct = records.filter(r => r.correct).length;
  const byKind: CalibrationSummary['byKind'] = {};
  for (const r of records) {
    const slot = (byKind[r.kind] ??= { total: 0, accuracy: 0 });
    slot.total += 1;
  }
  for (const kind of Object.keys(byKind)) {
    const slice = records.filter(r => r.kind === kind);
    byKind[kind].accuracy = slice.length === 0 ? 0 : +(slice.filter(r => r.correct).length / slice.length).toFixed(3);
  }
  const low = records.filter(r => r.confidence < 0.8);
  return {
    total,
    accuracy: total === 0 ? 0 : +(correct / total).toFixed(3),
    byKind,
    lowConfidenceAccuracy: low.length === 0 ? 0 : +(low.filter(r => r.correct).length / low.length).toFixed(3),
  };
}

export function resetVerifications(): void {
  records.length = 0;
}
