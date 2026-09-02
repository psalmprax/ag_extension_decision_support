/**
 * @deprecated Specification phase only — not wired to any API surface (route, tool, worker, or app.ts).
 * See docs/PILLAR_SERVICES_DECISION.md for details.
 * These services exist only in test files and have no production integration.
 */
import { logger } from '../utils/logger';

export interface MultispectralPixel {
  bandRed: number; // Sentinel-2 B4 (0.665 µm)
  bandNir: number; // Sentinel-2 B8 (0.842 µm)
  bandGreen: number; // Sentinel-2 B3 (0.560 µm)
  bandSwir?: number; // Sentinel-2 B11 (1.610 µm)
}

export interface ParcelSatelliteAnalysis {
  parcelId: string;
  capturedAt: string;
  cloudCoverPct: number;
  meanNdvi: number;
  meanEvi: number;
  meanNdwi: number;
  vegetationHealthGrade: 'severe_stress' | 'moderate_stress' | 'normal' | 'optimal';
  chlorophyllDensityIndex: number;
  moistureStressIndex: number;
  stressAnomaliesDetected: boolean;
  anomalyDescription?: string;
  recommendedAction: string;
}

export interface TemporalNdviTrend {
  date: string;
  ndvi: number;
  baselineMean: number;
  deviationPct: number;
}

/**
 * Calculates NDVI (Normalized Difference Vegetation Index)
 * Formula: (NIR - Red) / (NIR + Red)
 */
export function calculateNdvi(nir: number, red: number): number {
  const denominator = nir + red;
  if (denominator === 0) return 0;
  const ndvi = (nir - red) / denominator;
  return +Math.max(-1.0, Math.min(1.0, ndvi)).toFixed(3);
}

/**
 * Calculates EVI (Enhanced Vegetation Index) for dense crop canopy
 * Formula: 2.5 * (NIR - Red) / (NIR + 6*Red - 7.5*Blue + 1)
 */
export function calculateEvi(nir: number, red: number, blue: number = 0.05): number {
  const denominator = nir + 6 * red - 7.5 * blue + 1.0;
  if (denominator === 0) return 0;
  const evi = (2.5 * (nir - red)) / denominator;
  return +Math.max(-1.0, Math.min(1.0, evi)).toFixed(3);
}

/**
 * Calculates NDWI (Normalized Difference Water Index / Canopy Moisture)
 * Formula: (NIR - SWIR) / (NIR + SWIR)
 */
export function calculateNdwi(nir: number, swir: number = 0.15): number {
  const denominator = nir + swir;
  if (denominator === 0) return 0;
  const ndwi = (nir - swir) / denominator;
  return +Math.max(-1.0, Math.min(1.0, ndwi)).toFixed(3);
}

/**
 * Evaluates vegetative health status from mean NDVI
 */
export function classifyVegetationHealth(ndvi: number): 'severe_stress' | 'moderate_stress' | 'normal' | 'optimal' {
  if (ndvi < 0.25) return 'severe_stress';
  if (ndvi < 0.45) return 'moderate_stress';
  if (ndvi < 0.65) return 'normal';
  return 'optimal';
}

/**
 * Analyzes Sentinel-2 multispectral raster pixels for a registered agricultural parcel
 */
export function analyzeParcelMultispectral(params: {
  parcelId: string;
  pixels: MultispectralPixel[];
  cloudCoverPct?: number;
  baselineNdvi?: number;
}): ParcelSatelliteAnalysis {
  const { parcelId, pixels, cloudCoverPct = 5.0, baselineNdvi = 0.62 } = params;

  logger.info(`Analyzing Sentinel-2 imagery for parcel ${parcelId} across ${pixels.length} raster pixels`);

  if (pixels.length === 0) {
    return {
      parcelId,
      capturedAt: new Date().toISOString(),
      cloudCoverPct,
      meanNdvi: 0,
      meanEvi: 0,
      meanNdwi: 0,
      vegetationHealthGrade: 'severe_stress',
      chlorophyllDensityIndex: 0,
      moistureStressIndex: 1.0,
      stressAnomaliesDetected: false,
      recommendedAction: 'No clear multispectral satellite data available. Schedule manual ground scouting.',
    };
  }

  let totalNdvi = 0;
  let totalEvi = 0;
  let totalNdwi = 0;

  for (const px of pixels) {
    totalNdvi += calculateNdvi(px.bandNir, px.bandRed);
    totalEvi += calculateEvi(px.bandNir, px.bandRed);
    totalNdwi += calculateNdwi(px.bandNir, px.bandSwir || 0.15);
  }

  const meanNdvi = +(totalNdvi / pixels.length).toFixed(3);
  const meanEvi = +(totalEvi / pixels.length).toFixed(3);
  const meanNdwi = +(totalNdwi / pixels.length).toFixed(3);

  const healthGrade = classifyVegetationHealth(meanNdvi);
  const deviationFromBaselinePct = +(((meanNdvi - baselineNdvi) / (baselineNdvi || 1)) * 100).toFixed(1);
  const isAnomaly = deviationFromBaselinePct <= -15.0;

  let recommendedAction = 'Canopy vigor is optimal. Maintain standard weed scouting and scheduled top-dressing.';
  if (healthGrade === 'severe_stress' || isAnomaly) {
    recommendedAction = `CRITICAL ANOMALY: Canopy NDVI dropped ${deviationFromBaselinePct}% below 30-day baseline. Dispatch field officer immediately to verify Fall Armyworm, fungal blight, or severe soil moisture deficit.`;
  } else if (healthGrade === 'moderate_stress') {
    recommendedAction = 'Moderate canopy stress detected. Check soil moisture and consider nitrogen top-dressing.';
  }

  return {
    parcelId,
    capturedAt: new Date().toISOString(),
    cloudCoverPct,
    meanNdvi,
    meanEvi,
    meanNdwi,
    vegetationHealthGrade: healthGrade,
    chlorophyllDensityIndex: +(meanNdvi * 1.25).toFixed(2),
    moistureStressIndex: +(1.0 - Math.max(0, meanNdwi)).toFixed(2),
    stressAnomaliesDetected: isAnomaly,
    anomalyDescription: isAnomaly ? `Abrupt NDVI drop of ${deviationFromBaselinePct}% compared to historical baseline (${baselineNdvi})` : undefined,
    recommendedAction,
  };
}
