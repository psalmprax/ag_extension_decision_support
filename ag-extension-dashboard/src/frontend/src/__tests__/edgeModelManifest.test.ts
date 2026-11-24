import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ort = vi.hoisted(() => ({
  InferenceSession: { create: vi.fn() },
  Tensor: class {
    constructor(public type: string, public data: Float32Array, public dims: number[]) {}
  },
  env: { wasm: {} },
}));
vi.mock('onnxruntime-web/wasm', () => ort);

import { FIELD_EVALUATION_FLOOR, confidentThreshold, meetsFieldFloor, modelUrl, rejectedCandidate, releasedEdgeModels, resetEdgeModelManifest, toProbabilities, type EdgeModelEntry } from '@/services/edgeModelManifest';
import { diagnosePlantOffline, resetEdgeModel } from '@/services/edgePlantVisionClassifier';

const LABELS = ['cassava___mosaic', 'corn___rust', 'corn___healthy'];
const passing: EdgeModelEntry = {
  file: 'plant-disease.onnx',
  name: 'mobilenetv3_small_100, field photos test',
  labels: LABELS,
  output: 'probabilities',
  inputSize: 224,
  fieldEvaluation: { dataset: 'plantdoc test split', images: 400, top1Accuracy: 0.62, top3Accuracy: 0.84, cropTop1Accuracy: 0.91, evaluatedOn: '2026-11-24' },
};
const withEvaluation = (changes: Partial<NonNullable<EdgeModelEntry['fieldEvaluation']>>): EdgeModelEntry => ({
  ...passing,
  fieldEvaluation: { ...passing.fieldEvaluation!, ...changes },
});

function serveManifest(models: EdgeModelEntry[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ models }) }));
}

// jsdom canvases have no pixels: paint a green leaf with a rust-brown half.
const originalGetContext = HTMLCanvasElement.prototype.getContext;
function leafCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  return canvas;
}

beforeEach(() => {
  resetEdgeModelManifest();
  resetEdgeModel();
  ort.InferenceSession.create.mockReset();
  HTMLCanvasElement.prototype.getContext = function getContext() {
    const width = this.width;
    const height = this.height;
    return {
      drawImage: () => undefined,
      getImageData: () => {
        const data = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < width * height; i++) {
          const rust = i % width >= width / 2;
          data.set(rust ? [150, 70, 25, 255] : [40, 140, 40, 255], i * 4);
        }
        return { data, width, height };
      },
    } as unknown as CanvasRenderingContext2D;
  } as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  vi.unstubAllGlobals();
});

describe('which on-device models may run', () => {
  it('needs an evaluation on enough field photos that meets the acceptance gate', () => {
    expect(FIELD_EVALUATION_FLOOR).toEqual({ images: 300, top3Accuracy: 0.7, cropTop1Accuracy: 0.6 });
    expect(meetsFieldFloor(passing)).toBe(true);
    expect(meetsFieldFloor({ ...passing, fieldEvaluation: undefined })).toBe(false);
    expect(meetsFieldFloor(withEvaluation({ images: 299 }))).toBe(false);
    expect(meetsFieldFloor(withEvaluation({ top3Accuracy: 0.69 }))).toBe(false);
    expect(meetsFieldFloor(withEvaluation({ cropTop1Accuracy: 0.59 }))).toBe(false);
  });

  it('never runs a smoke run of the training script', () => {
    expect(meetsFieldFloor(withEvaluation({ smoke: true }))).toBe(false);
  });

  it('names the latest trained model that failed field testing, so the app can say why none runs', async () => {
    const failed = { name: 'mobilenetv3_small_100, field photos', fieldEvaluation: { ...passing.fieldEvaluation!, top3Accuracy: 0.4 } };
    const serve = (body: unknown) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(body) }));
    serve({ models: [], lastCandidate: failed });
    expect(await rejectedCandidate()).toEqual(failed);
    expect(await releasedEdgeModels()).toEqual([]);
    resetEdgeModelManifest();
    serve({ models: [], lastCandidate: { ...failed, fieldEvaluation: { ...failed.fieldEvaluation, smoke: true } } });
    expect(await rejectedCandidate()).toBeNull();
    resetEdgeModelManifest();
    serve({ models: [passing], lastCandidate: { name: passing.name, fieldEvaluation: passing.fieldEvaluation } });
    expect(await rejectedCandidate()).toBeNull();
  });

  it('runs none when the manifest cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await releasedEdgeModels()).toEqual([]);
  });

  it('gives each model its own address, so a phone never keeps an old model under a new list of labels', () => {
    const retrained = { ...passing, fieldEvaluation: { ...passing.fieldEvaluation!, top1Accuracy: 0.63 } };
    expect(modelUrl(passing)).toBe(modelUrl({ ...passing }));
    expect(modelUrl(retrained)).not.toBe(modelUrl(passing));
    expect(modelUrl({ ...passing, sha256: 'ab12cd34ef56ab78cd90ef12' })).toBe('/models/plant-disease.onnx?v=ab12cd34ef56ab78');
    expect(modelUrl({ ...passing, sha256: 'ff12cd34ef56ab78cd90ef12' })).not.toBe(modelUrl({ ...passing, sha256: 'ab12cd34ef56ab78cd90ef12' }));
  });

  it('turns logits into probabilities and leaves probabilities alone', () => {
    const fromLogits = toProbabilities(new Float32Array([2, 0, 0]), 'logits');
    expect(fromLogits.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(fromLogits[0]).toBeGreaterThan(0.7);
    expect(toProbabilities(new Float32Array([0.2, 0.8]), 'probabilities')[1]).toBeCloseTo(0.8, 6);
  });
});

describe('an offline photo check', () => {
  it('stays the colour check while no model has passed, and loads no model file', async () => {
    serveManifest([withEvaluation({ top3Accuracy: 0.4 })]);
    const result = await diagnosePlantOffline(leafCanvas(), 'Maize');
    expect(result.origin).toBe('heuristic');
    expect(result.heuristicDisclaimer).toMatch(/Colour check only, not a diagnosis/);
    expect(ort.InferenceSession.create).not.toHaveBeenCalled();
  });

  it("uses a released model's answer and says how it did on field photos", async () => {
    serveManifest([passing]);
    ort.InferenceSession.create.mockResolvedValue({
      inputNames: ['input'],
      run: vi.fn().mockResolvedValue({ probabilities: { data: new Float32Array([0.05, 0.9, 0.05]) } }),
    });
    const result = await diagnosePlantOffline(leafCanvas(), 'Maize');
    expect(ort.InferenceSession.create).toHaveBeenCalledWith(modelUrl(passing), expect.anything());
    expect(modelUrl(passing)).toMatch(/^\/models\/plant-disease\.onnx\?v=[0-9a-z]+$/);
    expect(result.origin).toBe('onnx');
    // Maize "rust" may be common or southern rust, so it is not named as either.
    expect(result.primaryDiagnosis.condition).toBe('Maize rust');
    expect(result.primaryDiagnosis.severity).toBe('not_assessed');
    // Maize was named, so only maize labels are ranked.
    expect(result.alternatives.map(a => a.condition)).toEqual(['Healthy maize leaf']);
    expect(result.heuristicDisclaimer).toMatch(/top three for 84% of 400 field photos, and first for 62%/);
    // Treatment stays withheld until an expert confirms.
    expect(result.primaryDiagnosis.chemicalIntervention).toMatch(/withheld/);
  });

  function serveModelAnswer(model: EdgeModelEntry, probabilities: number[]) {
    serveManifest([model]);
    ort.InferenceSession.create.mockResolvedValue({
      inputNames: ['input'],
      run: vi.fn().mockResolvedValue({ probabilities: { data: new Float32Array(probabilities) } }),
    });
  }
  const calibrated: EdgeModelEntry = {
    ...passing,
    calibration: { basis: 'published test splits', target: 0.9, confidentAt: 0.8, points: [] },
  };

  it('says an answer is sure enough to skip the online check only from the calibrated confidence', async () => {
    serveModelAnswer(calibrated, [0.05, 0.85, 0.1]);
    expect((await diagnosePlantOffline(leafCanvas(), 'Maize')).confidentEnough).toBe(true);
    resetEdgeModelManifest();
    resetEdgeModel();
    serveModelAnswer(calibrated, [0.05, 0.7, 0.25]);
    const unsure = await diagnosePlantOffline(leafCanvas(), 'Maize');
    expect(unsure.origin).toBe('onnx');
    expect(unsure.confidentEnough).toBe(false);
  });

  it('is never sure without a calibration in the manifest', async () => {
    serveModelAnswer(passing, [0.01, 0.98, 0.01]);
    expect((await diagnosePlantOffline(leafCanvas(), 'Maize')).confidentEnough).toBe(false);
  });

  it("ranks only the named crop's labels, and is not sure when that changed the model's first answer", async () => {
    serveModelAnswer(calibrated, [0.1, 0.85, 0.05]);
    const asCassava = await diagnosePlantOffline(leafCanvas(), 'cassava');
    // Only cassava labels count, and cassava mosaic at 10% is too unsure to show.
    expect(asCassava.origin).toBe('heuristic');
    expect(asCassava.heuristicDisclaimer).toMatch(/not sure enough/);
  });

  it('runs the colour check and says why when the named crop is not one the model knows', async () => {
    serveModelAnswer(calibrated, [0.05, 0.9, 0.05]);
    const result = await diagnosePlantOffline(leafCanvas(), 'Rice');
    expect(result.origin).toBe('heuristic');
    expect(result.cropNotCovered).toBe(true);
    expect(result.heuristicDisclaimer).toMatch(/not trained on this crop/);
  });

  it('ranks every crop when none is named, naming known conditions by their full name', async () => {
    serveModelAnswer(calibrated, [0.3, 0.6, 0.1]);
    const result = await diagnosePlantOffline(leafCanvas());
    expect([result.primaryDiagnosis, ...result.alternatives].map(c => c.condition))
      .toEqual(['Maize rust', 'Cassava Mosaic Disease (CMD)', 'Healthy maize leaf']);
  });

  it('reports a healthy leaf as healthy rather than as a disease', async () => {
    serveModelAnswer(calibrated, [0.02, 0.08, 0.9]);
    const result = await diagnosePlantOffline(leafCanvas(), 'Maize');
    expect(result.primaryDiagnosis.healthy).toBe(true);
    expect(result.primaryDiagnosis.condition).toBe('Healthy maize leaf');
  });
});

describe('confidentThreshold', () => {
  const withCalibration = (confidentAt: number | null, target = 0.9, images = 400): EdgeModelEntry => ({
    ...passing,
    fieldEvaluation: { ...passing.fieldEvaluation!, images },
    calibration: { basis: 'published test splits', target, confidentAt, points: [] },
  });

  it("reads the manifest's calibrated confidence", () => {
    expect(confidentThreshold(withCalibration(0.75))).toBe(0.75);
  });

  it('gives none without a calibration, a target below 90%, or too few test photos', () => {
    expect(confidentThreshold(passing)).toBeNull();
    expect(confidentThreshold(withCalibration(null))).toBeNull();
    expect(confidentThreshold(withCalibration(0.75, 0.8))).toBeNull();
    expect(confidentThreshold(withCalibration(0.75, 0.9, 120))).toBeNull();
  });

  it('never goes below one in two, whatever the manifest says', () => {
    expect(confidentThreshold(withCalibration(0.2))).toBe(0.5);
  });
});

