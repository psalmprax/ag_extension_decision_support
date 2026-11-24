import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ort = vi.hoisted(() => ({
  InferenceSession: { create: vi.fn() },
  Tensor: class {
    constructor(public type: string, public data: Float32Array, public dims: number[]) {}
  },
  env: { wasm: {} },
}));
vi.mock('onnxruntime-web/wasm', () => ort);

import { FIELD_EVALUATION_FLOOR, meetsFieldFloor, releasedEdgeModels, resetEdgeModelManifest, toProbabilities, type EdgeModelEntry } from '@/services/edgeModelManifest';
import { diagnosePlantOffline, resetEdgeModel } from '@/services/edgePlantVisionClassifier';

const LABELS = ['cassava___mosaic', 'corn___common_rust', 'corn___healthy'];
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

  it('runs none when the manifest cannot be read', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await releasedEdgeModels()).toEqual([]);
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
    expect(ort.InferenceSession.create).toHaveBeenCalledWith('/models/plant-disease.onnx', expect.anything());
    expect(result.origin).toBe('onnx');
    expect(result.primaryDiagnosis.condition).toBe('Maize Common Rust');
    expect(result.heuristicDisclaimer).toMatch(/top three for 84% of 400 field photos, and first for 62%/);
    // Treatment stays withheld until an expert confirms.
    expect(result.primaryDiagnosis.chemicalIntervention).toMatch(/withheld/);
  });
});
