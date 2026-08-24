import { z } from 'zod';
import { outbreakService } from '@/services/outbreakService';
import { logger } from '@/utils/logger';
import { Tool } from './types';
import { plantDiseaseService } from '@/services/plantDiseaseService';

const diagnoseFromSymptomsSchema = z.object({
  symptoms: z.array(z.string()).describe('List of observed symptoms (e.g., "yellow leaves", "brown spots", "wilting")'),
  cropType: z.string().optional().describe('Type of crop (e.g., maize, tomato, coffee)'),
});

const analyzePlantImageSchema = z.object({
  imageData: z.string().describe('Base64 encoded image of the affected plant'),
  cropType: z.string().optional().describe('Type of crop'),
});

const getDiseaseInfoSchema = z.object({
  diseaseName: z.string().describe('Name of the disease to get information about'),
});

export const diagnoseFromSymptomsTool: Tool<typeof diagnoseFromSymptomsSchema> = {
  name: 'diagnose_plant_disease',
  description: 'Diagnoses plant diseases based on observed symptoms. Use when farmers describe symptoms, extension officers report field observations, or when identifying crop health issues without images.',
  schema: diagnoseFromSymptomsSchema,
  execute: async ({ symptoms, cropType }) => {
    const diagnoses = await plantDiseaseService.diagnoseFromSymptoms(symptoms, cropType);

    if (diagnoses.length === 0) {
      return JSON.stringify({
        message: 'No matching diseases found for the described symptoms',
        symptoms,
        cropType: cropType || null,
        recommendation: 'Consider taking a clear photo of the affected plant for visual analysis, or describe additional symptoms.',
      }, null, 2);
    }

    return JSON.stringify({
      cropType: cropType || null,
      symptoms,
      possibleDiseases: diagnoses.map(d => ({
        disease: d.disease,
        confidence: `${d.confidence}%`,
        severity: d.severity,
        description: d.description,
        matchedSymptoms: d.symptoms,
        immediateActions: d.treatment.slice(0, 2),
        prevention: d.prevention.slice(0, 2),
      })),
      generalAdvice: [
        'Isolate affected plants to prevent spread',
        'Remove and destroy severely infected parts',
        'Apply recommended treatment promptly',
        'Monitor surrounding plants for similar symptoms',
        'Consult local extension officer for confirmation',
      ],
    }, null, 2);
  },
};

export const analyzePlantImageTool: Tool<typeof analyzePlantImageSchema> = {
  name: 'analyze_plant_image',
  description: 'Analyzes plant images for disease identification. Use when farmers or extension officers upload photos of affected crops for visual diagnosis.',
  schema: analyzePlantImageSchema,
  execute: async ({ imageData, cropType }) => {
    const analysis = await plantDiseaseService.analyzeImage(imageData);

    // Feed outbreak intelligence (fire-and-forget; failures must not break diagnosis)
    const primary = analysis.diseases?.[0];
    if (primary) {
      void outbreakService
        .recordDiagnosisEvent({
          crop: cropType || 'unknown',
          diseaseLabel: primary.disease,
          confidence: typeof primary.confidence === 'string' ? parseFloat(primary.confidence) : null,
          source: 'extension_tool',
        })
        .catch(error => logger.error('[outbreak] failed to record diagnosis event:', error));
    }

    return JSON.stringify({
      cropType: cropType || null,
      overallHealth: analysis.overallHealth,
      confidence: `${analysis.confidence}%`,
      diseases: analysis.diseases,
      nutrientDeficiencies: analysis.nutrientDeficiencies,
      recommendations: analysis.recommendations,
      note: 'For best results, also use the symptom-based diagnosis tool alongside image analysis.',
    }, null, 2);
  },
};

export const getDiseaseInfoTool: Tool<typeof getDiseaseInfoSchema> = {
  name: 'get_disease_information',
  description: 'Retrieves detailed information about a specific plant disease including symptoms, treatment, and prevention. Use when learning about diseases, preparing training materials, or advising farmers.',
  schema: getDiseaseInfoSchema,
  execute: async ({ diseaseName }) => {
    const diseaseId = diseaseName.toLowerCase().replace(/\s+/g, '_');
    const info = plantDiseaseService.getDiseaseInfo(diseaseId);

    if (!info) {
      const available = plantDiseaseService.getAllDiseases();
      return JSON.stringify({
        error: `Disease "${diseaseName}" not found in database`,
        availableDiseases: available,
        suggestion: 'Use diagnose_plant_disease tool to identify diseases from symptoms instead.',
      }, null, 2);
    }

    return JSON.stringify({
      disease: diseaseName,
      description: info.description,
      symptoms: info.symptoms,
      treatment: info.treatment,
      prevention: info.prevention,
      severity: 'varies by stage and conditions',
    }, null, 2);
  },
};
