import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// Keep inference offline and deterministic: no manifest can be read here, and a stub runtime
// reports any model file as unavailable, so every call exercises the colour check.
vi.mock('onnxruntime-web/wasm', () => ({
  InferenceSession: { create: vi.fn().mockRejectedValue(new Error('model unavailable')) },
  Tensor: class {
    constructor() {
      return {};
    }
  },
  env: { wasm: {} },
}));

import {
  EDGE_CONFIRM_CONFIDENCE_THRESHOLD,
  shouldConfirmEdgeDiagnosis,
  withholdEdgeAdvice,
  extractVisualMetricsFromCanvas,
  detectLeafAndSpots,
  diagnosePlantOffline,
  diagnoseSoilOffline,
  type EdgeDiagnosisCandidate,
  type EdgeVisualMetrics,
} from '@/services/edgePlantVisionClassifier';

// jsdom has no raster canvas, and the global test setup returns a stub context
// without getImageData. Paint synthetic pixel buffers instead so the colour
// thresholds are exercised against real pixel math rather than mocked metrics.
type Rgb = [number, number, number];
let paintFn: (width: number, height: number) => Uint8ClampedArray = () =>
  new Uint8ClampedArray(0);
const originalGetContext = HTMLCanvasElement.prototype.getContext;

function solid(rgb: Rgb) {
  return (width: number, height: number) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      data[i * 4] = rgb[0];
      data[i * 4 + 1] = rgb[1];
      data[i * 4 + 2] = rgb[2];
      data[i * 4 + 3] = 255;
    }
    return data;
  };
}

/** Top half one colour, bottom half another — produces a lesion/healthy split. */
function halves(top: Rgb, bottom: Rgb) {
  return (width: number, height: number) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      const rgb = y < height / 2 ? top : bottom;
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
        data[i + 3] = 255;
      }
    }
    return data;
  };
}

/** Alternating pixels: maximum surface texture, mid luminance. */
function checker(a: Rgb, b: Rgb) {
  return (width: number, height: number) => {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const rgb = (x + y) % 2 === 0 ? a : b;
        const i = (y * width + x) * 4;
        data[i] = rgb[0];
        data[i + 1] = rgb[1];
        data[i + 2] = rgb[2];
        data[i + 3] = 255;
      }
    }
    return data;
  };
}

function canvasPaintedWith(
  width: number,
  height: number,
  paint: (width: number, height: number) => Uint8ClampedArray
): HTMLCanvasElement {
  paintFn = paint;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

const HEALTHY_GREEN: Rgb = [34, 139, 34];
const NECROTIC_BROWN: Rgb = [120, 90, 40];
const SKY_BLUE: Rgb = [30, 60, 200];

const healthyCanvas = () => canvasPaintedWith(32, 32, solid(HEALTHY_GREEN));

function metrics(overrides: Partial<EdgeVisualMetrics> = {}): EdgeVisualMetrics {
  return {
    greenCanopyIndex: 0.8,
    chlorosisRatio: 0.01,
    necrosisRatio: 0.01,
    rustPustuleRatio: 0,
    mottlingVariance: 0,
    lesionCoveragePct: 0,
    excessGreen: 0.3,
    ngrdi: 0.4,
    textureVariance: 0.05,
    brownSpotRatio: 0,
    yellowHaloRatio: 0,
    edgeDensity: 0.02,
    ...overrides,
  };
}

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement
  ): CanvasRenderingContext2D {
    const width = this.width;
    const height = this.height;
    return {
      getImageData: () => ({ data: paintFn(width, height), width, height }),
      drawImage: () => undefined,
    } as unknown as CanvasRenderingContext2D;
  } as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  vi.restoreAllMocks();
});

describe('shouldConfirmEdgeDiagnosis', () => {
  it('always requires confirmation for heuristic triage, even at high confidence and mild severity', () => {
    expect(shouldConfirmEdgeDiagnosis('heuristic', 0.99, 'mild')).toBe(true);
    expect(shouldConfirmEdgeDiagnosis('heuristic', 0.1, 'severe')).toBe(true);
  });

  it('requires confirmation below the 0.8 confidence threshold', () => {
    expect(EDGE_CONFIRM_CONFIDENCE_THRESHOLD).toBe(0.8);
    expect(shouldConfirmEdgeDiagnosis('onnx', 0.79, 'mild')).toBe(true);
  });

  it('does not require confirmation at the threshold for mild severity', () => {
    expect(shouldConfirmEdgeDiagnosis('onnx', 0.8, 'mild')).toBe(false);
  });

  it('requires confirmation for moderate and severe crop damage regardless of confidence', () => {
    expect(shouldConfirmEdgeDiagnosis('onnx', 0.95, 'moderate')).toBe(true);
    expect(shouldConfirmEdgeDiagnosis('onnx', 0.95, 'severe')).toBe(true);
  });
});

describe('withholdEdgeAdvice', () => {
  const candidate: EdgeDiagnosisCandidate = {
    condition: 'Tomato Late Blight',
    scientificName: 'Phytophthora infestans',
    crop: 'Tomato',
    confidence: 0.9,
    severity: 'moderate',
    symptoms: ['Water-soaked lesions'],
    culturalControl: ['Remove infected foliage'],
    biologicalControl: ['Trichoderma viride drench'],
    chemicalIntervention: 'Mancozeb 80% WP',
  };

  it('replaces every treatment section with an expert-confirmation notice', () => {
    const withheld = withholdEdgeAdvice(candidate);
    expect(withheld.culturalControl).toHaveLength(1);
    expect(withheld.culturalControl[0]).toMatch(/withheld until a qualified local expert confirms/);
    expect(withheld.biologicalControl).toEqual([]);
    expect(withheld.chemicalIntervention).toMatch(/withheld until a qualified local expert confirms/);
  });

  it('keeps the diagnosis identity untouched', () => {
    const withheld = withholdEdgeAdvice(candidate);
    expect(withheld.condition).toBe('Tomato Late Blight');
    expect(withheld.scientificName).toBe('Phytophthora infestans');
    expect(withheld.confidence).toBe(0.9);
    expect(withheld.symptoms).toEqual(['Water-soaked lesions']);
    // Original object is not mutated.
    expect(candidate.chemicalIntervention).toBe('Mancozeb 80% WP');
  });
});

describe('extractVisualMetricsFromCanvas', () => {
  it('reads a uniformly green leaf as full canopy with no lesions', async () => {
    const m = await extractVisualMetricsFromCanvas(healthyCanvas());

    expect(m.greenCanopyIndex).toBe(1);
    expect(m.chlorosisRatio).toBe(0);
    expect(m.necrosisRatio).toBe(0);
    expect(m.rustPustuleRatio).toBe(0);
    expect(m.brownSpotRatio).toBe(0);
    expect(m.yellowHaloRatio).toBe(0);
    expect(m.lesionCoveragePct).toBe(0);
    expect(m.mottlingVariance).toBe(0);
    expect(m.edgeDensity).toBe(0);
    expect(m.textureVariance).toBe(0);
  });

  it('computes vegetation indices from real channel values', async () => {
    const m = await extractVisualMetricsFromCanvas(healthyCanvas());
    // 2*G - R - B normalized: 2*(139/255) - (34/255) - (34/255)
    expect(m.excessGreen).toBeCloseTo(0.8235, 3);
    // (G - R) / (G + R)
    expect(m.ngrdi).toBeCloseTo(0.6069, 3);
  });

  it('treats a lesion-covered leaf as high necrosis with lesion coverage', async () => {
    const m = await extractVisualMetricsFromCanvas(
      canvasPaintedWith(32, 32, halves(HEALTHY_GREEN, NECROTIC_BROWN))
    );

    expect(m.greenCanopyIndex).toBeGreaterThan(0.3);
    expect(m.greenCanopyIndex).toBeLessThan(0.7);
    expect(m.necrosisRatio).toBeGreaterThan(0.4);
    expect(m.lesionCoveragePct).toBe(100);
  });

  it('ignores white background pixels when measuring canopy', async () => {
    const m = await extractVisualMetricsFromCanvas(
      canvasPaintedWith(32, 32, solid([255, 255, 255]))
    );
    expect(m.greenCanopyIndex).toBe(0);
    expect(m.lesionCoveragePct).toBe(0);
  });
});

describe('detectLeafAndSpots', () => {
  it('accepts healthy foliage and labels a full-frame crop leaf box', async () => {
    const stage1 = await detectLeafAndSpots(healthyCanvas());

    expect(stage1.model).toBe('heuristic-saliency');
    expect(stage1.detectedLeaf).toBe(true);
    expect(stage1.rejectionReason).toBeUndefined();
    expect(stage1.boxes[0].label).toBe('crop_leaf');
    expect(stage1.boxes[0].confidence).toBeGreaterThanOrEqual(0.78);
    expect(stage1.boxes[0].confidence).toBeLessThanOrEqual(0.98);
  });

  it('rejects a non-foliage specimen so no disease is reported', async () => {
    const stage1 = await detectLeafAndSpots(
      canvasPaintedWith(32, 32, solid(SKY_BLUE))
    );

    expect(stage1.detectedLeaf).toBe(false);
    expect(stage1.boxes).toHaveLength(1);
    expect(stage1.boxes[0].label).toBe('non_plant_background');
    expect(stage1.rejectionReason).toMatch(/does not look like a leaf/);
  });

  it('adds lesion boxes for an affected leaf, capped at four', async () => {
    const stage1 = await detectLeafAndSpots(
      canvasPaintedWith(32, 32, halves(HEALTHY_GREEN, NECROTIC_BROWN))
    );

    const lesions = stage1.boxes.filter(b => b.label !== 'crop_leaf');
    expect(lesions.length).toBeGreaterThan(0);
    expect(lesions.length).toBeLessThanOrEqual(4);
    expect(lesions[0].id).toBe('lesion-1');
    for (const box of lesions) {
      expect(box.confidence).toBeGreaterThanOrEqual(0.68);
      expect(box.confidence).toBeLessThanOrEqual(0.96);
      expect(box.box).toHaveLength(4);
    }
  });

  it('uses precomputed metrics instead of re-reading the canvas', async () => {
    const stage1 = await detectLeafAndSpots(
      healthyCanvas(),
      metrics({ greenCanopyIndex: 0.03, excessGreen: -1, necrosisRatio: 0, textureVariance: 0, edgeDensity: 0 })
    );
    expect(stage1.detectedLeaf).toBe(false);
  });
});

describe('diagnosePlantOffline', () => {
  it('reports healthy vigorous foliage on a clean leaf, carrying the crop hint', async () => {
    const result = await diagnosePlantOffline(healthyCanvas(), 'Maize');

    expect(result.isOfflineInference).toBe(true);
    expect(result.origin).toBe('heuristic');
    expect(result.primaryDiagnosis.condition).toBe('Healthy Vigorous Foliage');
    expect(result.primaryDiagnosis.crop).toBe('Maize');
    expect(result.primaryDiagnosis.confidence).toBeGreaterThanOrEqual(0.72);
    expect(result.alternatives).toEqual([]);
    expect(result.twoStage?.stage2Classifier.model).toBe('heuristic-v2');
    expect(Number.isNaN(Date.parse(result.analyzedAt))).toBe(false);
  });

  it('withholds chemical advice on every heuristic diagnosis', async () => {
    const result = await diagnosePlantOffline(
      canvasPaintedWith(32, 32, halves(HEALTHY_GREEN, NECROTIC_BROWN)),
      'Maize'
    );

    expect(result.origin).toBe('heuristic');
    expect(result.primaryDiagnosis.chemicalIntervention).toMatch(/withheld until/);
    expect(result.primaryDiagnosis.biologicalControl).toEqual([]);
    for (const alt of result.alternatives) {
      expect(alt.chemicalIntervention).toMatch(/withheld until/);
    }
  });

  it('flags the highest-confidence maize condition when lesions cover the leaf', async () => {
    const result = await diagnosePlantOffline(
      canvasPaintedWith(32, 32, halves(HEALTHY_GREEN, NECROTIC_BROWN)),
      'Maize'
    );

    expect(result.primaryDiagnosis.crop).toBe('Maize');
    expect(result.primaryDiagnosis.severity).toBe('severe');
    expect(result.metrics.lesionCoveragePct).toBeGreaterThan(50);
    expect(shouldConfirmEdgeDiagnosis(
      result.origin,
      result.primaryDiagnosis.confidence,
      result.primaryDiagnosis.severity
    )).toBe(true);
  });

  it('rejects a non-foliage image without proposing a disease', async () => {
    const result = await diagnosePlantOffline(
      canvasPaintedWith(32, 32, solid(SKY_BLUE)),
      'Tomato'
    );

    expect(result.isRejectedNonFoliage).toBe(true);
    expect(result.rejectionMessage).toMatch(/does not look like a leaf/);
    expect(result.primaryDiagnosis.condition).toBe('Non-Foliage Detected (Specimen Rejected)');
    expect(result.primaryDiagnosis.crop).toBe('Tomato');
    expect(result.primaryDiagnosis.chemicalIntervention).toBe('No intervention required.');
    expect(result.alternatives).toEqual([]);
    expect(result.twoStage?.stage1Detector.detectedLeaf).toBe(false);
  });

  it('analyzes an HTMLImageElement source by drawing it onto a canvas', async () => {
    const img = document.createElement('img');
    paintFn = solid(HEALTHY_GREEN);
    const result = await diagnosePlantOffline(img);
    expect(result.isOfflineInference).toBe(true);
    expect(result.metrics.greenCanopyIndex).toBe(1);
  });
});

describe('diagnoseSoilOffline', () => {
  it('classifies a dark reddish soil as clay loam with high organic matter', () => {
    paintFn = solid([110, 60, 45]);
    const result = diagnoseSoilOffline(document.createElement('canvas'));

    expect(result.isOfflineInference).toBe(true);
    expect(result.textureClass).toBe('Clay Loam / Tropical Oxisol');
    expect(result.drainageClass).toBe('Slow / Prone to Surface Compaction');
    expect(result.organicMatterIndex).toBe('High');
    expect(result.estimatedMoisture).toBe('High Moisture / Near Saturation (>35%)');
    expect(result.confidence).toBeCloseTo(0.86, 2);
    expect(result.recommendations.join(' ')).toMatch(/Avoid tillage when saturated/);
    expect(result.recommendations.join(' ')).toMatch(/High moisture content detected/);
    expect(result.metrics.reddishHueRatio).toBe(1);
  });

  it('classifies a bright, high-texture surface as coarse sand with leaching risk', () => {
    paintFn = checker([255, 255, 255], [40, 40, 40]);
    const result = diagnoseSoilOffline(document.createElement('canvas'));

    expect(result.textureClass).toBe('Coarse Sand / Loamy Sand');
    expect(result.drainageClass).toBe('Excessively Drained (High Leaching Risk)');
    expect(result.organicMatterIndex).toBe('Low');
    expect(result.recommendations.join(' ')).toMatch(/Split fertilizer applications/);
    expect(result.metrics.textureVariance).toBeGreaterThan(0.65);
  });

  it('falls back to a neutral loam profile for an average bare-soil surface', () => {
    paintFn = solid([150, 140, 130]);
    const result = diagnoseSoilOffline(document.createElement('canvas'), 'Maize');

    expect(result.textureClass).toBe('Loam (Balanced Agronomic Blend)');
    expect(result.recommendations.join(' ')).toMatch(/Balanced soil texture suitable/);
    expect(Number.isNaN(Date.parse(result.analyzedAt))).toBe(false);
  });
});
