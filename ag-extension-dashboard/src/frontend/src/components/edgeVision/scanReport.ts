import type { OfflineDiagnosisResult, OfflineSoilDiagnosisResult } from '@/services/edgePlantVisionClassifier';

export type ScanTargetMode = 'crop' | 'soil';

/** The text an officer copies or shares after an on-device scan. */
export function buildDiagnosticReportSummary(
  scanMode: ScanTargetMode,
  crop: string,
  cropResult: OfflineDiagnosisResult | null,
  soilResult: OfflineSoilDiagnosisResult | null
): string {
  if (scanMode === 'crop' && cropResult) {
    const diag = cropResult.primaryDiagnosis;
    const action = diag.culturalControl[0] || 'See full report';
    return `[Agri-Vision Offline Scan]\nCrop: ${crop}\nDiagnosis: ${diag.condition} (${Math.round(diag.confidence * 100)}% confidence)\nSeverity: ${diag.severity === 'not_assessed' ? 'not assessed' : diag.severity}\nAction: ${action}`;
  }
  if (soilResult) {
    return `[Agri-Soil Offline Scan]\nTexture: ${soilResult.textureClass} (${Math.round(soilResult.confidence * 100)}% confidence)\nDrainage: ${soilResult.drainageClass}\nOrganic Matter: ${soilResult.organicMatterIndex}\nMoisture: ${soilResult.estimatedMoisture}`;
  }
  return 'Diagnostic specimen report';
}

/** The scan as an entry in the plot's history. */
export function createPlotEntry(
  scanMode: ScanTargetMode,
  crop: string,
  cropResult: OfflineDiagnosisResult | null,
  soilResult: OfflineSoilDiagnosisResult | null
) {
  const isCrop = scanMode === 'crop';
  const condition = isCrop
    ? cropResult?.primaryDiagnosis.condition || 'Crop observation'
    : soilResult?.textureClass || 'Soil sample';
  const confidence = isCrop
    ? cropResult?.primaryDiagnosis.confidence ?? 0.85
    : soilResult?.confidence ?? 0.85;

  return {
    id: `scan-${Date.now()}`,
    crop,
    condition,
    mode: scanMode,
    timestamp: new Date().toISOString(),
    confidence,
  };
}
