/**
 * Utility functions for AlphaAI component - extracted to reduce cognitive complexity
 */

import apiClient from '@/api/client';

import type { LastImageAnalysis } from '../StudioTabs';

/** Validate, upload, and analyze a leaf image; resolves to the health summary text. */
export interface LeafAnalysisOutcome {
  summary: string;
  analysis: LastImageAnalysis;
}

function buildDetections(
  diseases: Array<{ disease: string; confidence: number; severity?: string }>
): Array<{
  id: string;
  x: number;
  y: number;
  radius: number;
  label: string;
  confidence: number;
  severity: 'mild' | 'moderate' | 'severe';
}> {
  return diseases.slice(0, 4).map((d, i) => {
    const conf = d.confidence > 1 ? d.confidence / 100 : d.confidence;
    const sev =
      d.severity === 'severe' || d.severity === 'moderate' || d.severity === 'mild'
        ? d.severity
        : 'moderate';
    return {
      id: `finding-${i}`,
      x: 0.5 + (i % 2 === 0 ? -0.12 : 0.12) * Math.ceil(i / 2),
      y: 0.5 + (i < 2 ? -0.1 : 0.1),
      radius: 0.18,
      label: `${d.disease} (whole-image, not localised)`,
      confidence: Number.isFinite(conf) ? conf : 0,
      severity: sev as 'mild' | 'moderate' | 'severe',
    };
  });
}

function buildSummary(
  overallHealth: string,
  diseases: Array<{ disease: string; confidence: number }>,
  reviewStatus: string | undefined
): string {
  const diseaseSummary = diseases.length
    ? ` — ${diseases.map(d => `${d.disease} ${Math.round(d.confidence > 1 ? d.confidence : d.confidence * 100)}%`).join(', ')}`
    : '';
  const reviewNote = reviewStatus === 'needs_expert_review' ? ' · needs expert review' : '';
  return `${overallHealth}${diseaseSummary}${reviewNote}`;
}

/** Validate, upload, and analyze a leaf image; resolves to the health summary text. */
export async function analyzeLeafImage(file: File): Promise<LeafAnalysisOutcome> {
  if (file.size > 8 * 1024 * 1024) throw new Error('Image too large — max 8MB');
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const base64 = dataUrl.split(',')[1];
  const { data } = await apiClient.post('/ai/diseases/analyze', { image: base64 });
  const payload = (data?.data ?? data ?? {}) as {
    overallHealth?: string;
    confidence?: number;
    diseases?: Array<{ disease: string; confidence: number; severity?: string }>;
    reviewStatus?: string;
  };
  const overallHealth = payload.overallHealth || 'unknown';
  const diseases = Array.isArray(payload.diseases) ? payload.diseases : [];
  // The analyzer returns whole-image findings without coordinates, so each finding
  // is drawn as a centred marker; the label states that it is not localised.
  const detections = buildDetections(diseases);
  const summary = buildSummary(overallHealth, diseases, payload.reviewStatus);
  return { summary, analysis: { imageSrc: dataUrl, overallHealth, detections } };
}
