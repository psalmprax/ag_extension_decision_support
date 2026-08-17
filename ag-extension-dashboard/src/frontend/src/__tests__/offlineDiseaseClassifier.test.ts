import { describe, it, expect } from 'vitest';
import {
  classifyPlantImageOnDevice,
  classifySoilOnDevice,
} from '@/services/offlineDiseaseClassifier';

describe('Offline Edge Disease & Soil Classifier', () => {
  it('classifies coffee leaf disease with on-device edge model', async () => {
    const result = await classifyPlantImageOnDevice('mock-base64-data', 'coffee');

    expect(result.isOfflineEdgeResult).toBe(true);
    expect(result.diseases.length).toBeGreaterThan(0);
    expect(result.diseases[0].disease).toContain('Coffee Leaf Rust');
    expect(result.diseases[0].provenance.model).toBe('gpexts-edge-vision-v1.2-lite');
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('classifies maize leaf disease with on-device edge model', async () => {
    const result = await classifyPlantImageOnDevice('mock-base64-data', 'maize');

    expect(result.isOfflineEdgeResult).toBe(true);
    expect(result.diseases[0].disease).toContain('Fall Armyworm');
    expect(result.diseases[0].treatment.length).toBeGreaterThan(0);
  });

  it('defaults to maize profile if unknown crop provided', async () => {
    const result = await classifyPlantImageOnDevice('mock-base64-data', 'unknown-crop');

    expect(result.isOfflineEdgeResult).toBe(true);
    expect(result.diseases.length).toBe(1);
  });

  it('generates on-device soil classification metrics without network', () => {
    const soilResult = classifySoilOnDevice('Coffee');

    expect(soilResult.overallHealthScore).toBe(74);
    expect(soilResult.texture).toContain('Clay Loam');
    expect(soilResult.npkDeficiencies.phosphorus).toBe('low');
    expect(soilResult.cropSuitability).toContain('Coffee');
    expect(soilResult.provenance.provider).toBe('GPExts Edge Soil Analyzer');
  });
});
