import apiClient from './client';

export interface DiagnosticProvenance {
  evidenceStatus: 'verified_source' | 'no_verified_source';
  source: string;
  sourceUrl: string | null;
  sourceTimestamp: string | null;
  provider: string | null;
  model: string | null;
  generatedAt: string;
}

export type DiagnosticReviewStatus = 'ready' | 'needs_expert_review';

export interface DiseaseDiagnosis {
  disease: string;
  confidence: number;
  reviewStatus: DiagnosticReviewStatus;
  provenance: DiagnosticProvenance;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  symptoms: string[];
  treatment: string[];
  prevention: string[];
}

export interface DiseaseInfo {
  disease: string;
  description: string;
  symptoms: string[];
  treatment: string[];
  prevention: string[];
  severity: string;
}

export const diagnoseFromSymptoms = async (
  symptoms: string[],
  cropType?: string
): Promise<{ success: boolean; data: DiseaseDiagnosis[] }> => {
  const response = await apiClient.post('/ai/diagnose', { symptoms, cropType });
  return response.data;
};

export const getDiseaseInfo = async (
  diseaseName: string
): Promise<{ success: boolean; data: DiseaseInfo }> => {
  const response = await apiClient.get(`/ai/diseases/${encodeURIComponent(diseaseName)}`);
  return response.data;
};

export const getAllDiseases = async (): Promise<{ success: boolean; data: string[] }> => {
  const response = await apiClient.get('/ai/diseases');
  return response.data;
};

export const analyzePlantImage = async (
  imageData: string,
  cropType?: string
): Promise<{
  success: boolean;
  data: {
    overallHealth: string;
    diseases: DiseaseDiagnosis[];
    recommendations: string[];
    confidence: number;
    reviewStatus: DiagnosticReviewStatus;
    provenance: DiagnosticProvenance;
    reportId?: string;
  };
}> => {
  const response = await apiClient.post('/ai/diagnose/image', { imageData, cropType });
  return response.data;
};

export interface SoilAnalysisResult {
  overallHealthScore: number | null;
  texture: string;
  estimatedMoisture: string;
  drainageClass: string;
  colorDiscoloration: string;
  npkDeficiencies: {
    nitrogen: 'low' | 'optimal' | 'high' | 'unknown';
    phosphorus: 'low' | 'optimal' | 'high' | 'unknown';
    potassium: 'low' | 'optimal' | 'high' | 'unknown';
  };
  recommendations: string[];
  cropSuitability: string[];
  confidence: number;
  reviewStatus: DiagnosticReviewStatus;
  provenance: DiagnosticProvenance;
  reportId?: string;
}

export const analyzeSoilImage = async (
  imageData: string,
  cropType?: string,
  details?: Record<string, unknown>
): Promise<{ success: boolean; data: SoilAnalysisResult }> => {
  const response = await apiClient.post('/ai/diagnose/soil', { imageData, cropType, details });
  return response.data;
};
