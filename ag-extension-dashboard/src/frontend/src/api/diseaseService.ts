import apiClient from './client';

export interface DiseaseDiagnosis {
  disease: string;
  confidence: number;
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
    reportId?: string;
  };
}> => {
  const response = await apiClient.post('/ai/diagnose/image', { imageData, cropType });
  return response.data;
};

export interface SoilAnalysisResult {
  overallHealthScore: number;
  texture: string;
  estimatedMoisture: string;
  drainageClass: string;
  colorDiscoloration: string;
  npkDeficiencies: {
    nitrogen: 'low' | 'optimal' | 'high';
    phosphorus: 'low' | 'optimal' | 'high';
    potassium: 'low' | 'optimal' | 'high';
  };
  recommendations: string[];
  cropSuitability: string[];
  confidence: number;
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
