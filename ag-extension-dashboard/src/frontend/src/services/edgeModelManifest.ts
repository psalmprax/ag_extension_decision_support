/**
 * Which on-device disease models may run.
 *
 * A model file on its own is not enough. It runs only when /models/manifest.json lists it with
 * an evaluation on photos taken in fields that meets FIELD_EVALUATION_FLOOR, the acceptance gate
 * in docs/specs/PHASE2-OFFLINE-DIAGNOSIS-MODEL.md. Accuracy on lab images such as PlantVillage
 * (one leaf, plain background) does not carry over to field photos, so a lab score does not count.
 * scripts/ml/train_disease_classifier.py writes the manifest entry with these numbers.
 */
export interface FieldEvaluation {
  /** The held-out field photo set, e.g. "PlantDoc test split + Nakuru officer photos 2026". */
  dataset: string;
  images: number;
  /** Share of field photos whose top label was right, 0 to 1. */
  top1Accuracy: number;
  /** Share whose right label was among the top three, which the app shows. */
  top3Accuracy: number;
  /** Share whose top label named the right crop. */
  cropTop1Accuracy: number;
  evaluatedOn: string;
  /** Set by a pipeline check on generated images; such a model never runs. */
  smoke?: boolean;
  /** The same numbers for each source of test photos. */
  perSource?: Record<string, { images: number; top1Accuracy: number; top3Accuracy: number }>;
}

/** How often the top answer was right at each confidence, on the published test photos. */
export interface ModelCalibration {
  basis: string;
  /** The top-1 accuracy an answer must reach to count as sure, e.g. 0.9. */
  target: number;
  /** The lowest confidence from which answers met the target; null when none did. */
  confidentAt: number | null;
  points: Array<{ minConfidence: number; share: number; top1Accuracy: number; images: number }>;
  /**
   * Crops whose own test photos met the target at confidentAt (most crops have no published test
   * split, so the overall threshold is checked crop by crop). Absent in older manifests.
   */
  cropsMeetingTarget?: string[];
  crops?: Record<string, { images: number; imagesAtConfidentAt: number; top1AccuracyAtConfidentAt: number }>;
}

export interface EdgeModelEntry {
  file: string;
  /** Shown to the person, e.g. "MobileNetV3 small, field photos v1". */
  name: string;
  /** Output index to label, in the model's own order. */
  labels: string[];
  /** Whether the output is already softmax probabilities or raw logits. */
  output: 'probabilities' | 'logits';
  inputSize: number;
  fieldEvaluation?: FieldEvaluation;
  /** Scores on random holdouts of the other sources; reported only, never used by the gate. */
  holdoutEvaluation?: FieldEvaluation;
  calibration?: ModelCalibration;
  /** SHA-256 of the model file, written by scripts/ml/install_disease_model.py. */
  sha256?: string;
}

// An answer counts as sure only when the calibration was measured on this many photos or more,
// and never below this confidence, whatever the manifest says.
const MIN_CALIBRATION_IMAGES = 300;
const MIN_CONFIDENT_AT = 0.5;

/**
 * The confidence from which the model's top answer can be shown without asking the online
 * model; null when the manifest gives none, so the online model is always asked.
 */
export function confidentThreshold(entry: EdgeModelEntry): number | null {
  const calibration = entry.calibration;
  const sureAt = calibration?.confidentAt;
  if (typeof sureAt !== 'number' || !Number.isFinite(sureAt) || sureAt > 1) return null;
  if ((entry.fieldEvaluation?.images ?? 0) < MIN_CALIBRATION_IMAGES || calibration!.target < 0.9) return null;
  return Math.max(sureAt, MIN_CONFIDENT_AT);
}

/**
 * Whether the online check may be skipped for this crop: the person named it, the model knows
 * it, and (when the manifest says) its own test photos met the target at the sure threshold.
 */
export function cropMaySkipOnlineCheck(entry: EdgeModelEntry, crop: string | null): boolean {
  if (!crop) return false;
  const listed = entry.calibration?.cropsMeetingTarget;
  return !Array.isArray(listed) || listed.includes(crop);
}

/** A short, stable hash of a string (djb2), for a version tag when no SHA-256 was recorded. */
function shortHash(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return hash.toString(36);
}

/**
 * Where to load a model from. Phones keep a downloaded model for up to 30 days under its
 * address, so each model gets its own: the file's SHA-256, or else a hash of its name, labels
 * and scores. A new model under the same file name is then downloaded, never mixed with the
 * old model's weights.
 */
export function modelUrl(entry: EdgeModelEntry): string {
  const version = entry.sha256?.slice(0, 16)
    ?? shortHash(JSON.stringify([entry.name, entry.labels, entry.inputSize, entry.fieldEvaluation ?? null]));
  return `/models/${encodeURIComponent(entry.file)}?v=${version}`;
}

export const FIELD_EVALUATION_FLOOR = { images: 300, top3Accuracy: 0.7, cropTop1Accuracy: 0.6 } as const;

export function meetsFieldFloor(entry: EdgeModelEntry): boolean {
  const evaluation = entry.fieldEvaluation;
  return Boolean(
    evaluation
      && !evaluation.smoke
      && evaluation.images >= FIELD_EVALUATION_FLOOR.images
      && evaluation.top3Accuracy >= FIELD_EVALUATION_FLOOR.top3Accuracy
      && evaluation.cropTop1Accuracy >= FIELD_EVALUATION_FLOOR.cropTop1Accuracy
      && entry.labels.length > 1
  );
}

/** The latest trained model that was scored, kept in the manifest even when it failed the gate. */
export interface ModelCandidate {
  name: string;
  fieldEvaluation: FieldEvaluation;
}

interface Manifest {
  models?: EdgeModelEntry[];
  lastCandidate?: ModelCandidate;
}

let manifest: Promise<Manifest> | null = null;

function readManifest(): Promise<Manifest> {
  manifest ??= fetch('/models/manifest.json', { signal: AbortSignal.timeout(5_000) })
    .then(response => (response.ok ? (response.json() as Promise<Manifest>) : {}))
    .catch((error: unknown) => {
      console.warn('No on-device disease model manifest; using the colour check only.', error);
      return {};
    });
  return manifest;
}

/** The models in the manifest that passed the field evaluation; none when it cannot be read. */
export async function releasedEdgeModels(): Promise<EdgeModelEntry[]> {
  return ((await readManifest()).models ?? []).filter(meetsFieldFloor);
}

/**
 * The latest trained model when it was scored on field photos and fell short of the gate, so the
 * app can say why no disease model runs. Null when there is none, or it was only a smoke run.
 */
export async function rejectedCandidate(): Promise<ModelCandidate | null> {
  const candidate = (await readManifest()).lastCandidate;
  if (!candidate?.fieldEvaluation || candidate.fieldEvaluation.smoke) return null;
  const passes = meetsFieldFloor({ file: '', name: candidate.name, labels: ['a', 'b'], output: 'probabilities', inputSize: 0, fieldEvaluation: candidate.fieldEvaluation });
  return passes ? null : candidate;
}

/** Forgets the manifest that was read, so the next call reads it again. */
export function resetEdgeModelManifest(): void {
  manifest = null;
}

/** Turns raw model output into probabilities that add up to 1. */
export function toProbabilities(values: Float32Array, output: EdgeModelEntry['output']): number[] {
  const list = Array.from(values);
  if (output === 'probabilities') return list;
  const max = Math.max(...list);
  const exps = list.map(value => Math.exp(value - max));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map(value => value / total);
}
