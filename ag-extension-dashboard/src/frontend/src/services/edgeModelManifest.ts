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
