import { logger } from '@/utils/logger';
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';

export interface DiseaseDiagnosis {
  disease: string;
  confidence: number;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  symptoms: string[];
  treatment: string[];
  prevention: string[];
  imageUrl?: string;
}

export interface PlantImageAnalysis {
  overallHealth: 'healthy' | 'stressed' | 'diseased';
  diseases: DiseaseDiagnosis[];
  nutrientDeficiencies: string[];
  recommendations: string[];
  confidence: number;
}

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
}

class PlantDiseaseService {
  private static readonly DISEASE_DATABASE: Record<string, {
    symptoms: string[];
    treatment: string[];
    prevention: string[];
    description: string;
  }> = {
    'late_blight': {
      symptoms: ['Dark water-soaked lesions on leaves', 'White fungal growth on leaf undersides', 'Brown lesions on stems', 'Rapid leaf death'],
      treatment: ['Apply copper-based fungicide immediately', 'Remove and destroy infected plant parts', 'Apply mancozeb as preventive spray', 'Ensure proper spacing for air circulation'],
      prevention: ['Use resistant varieties', 'Avoid overhead irrigation', 'Rotate crops every 3 years', 'Apply preventive fungicide during humid weather'],
      description: 'Late blight (Phytophthora infestans) is a devastating disease affecting tomatoes and potatoes. It spreads rapidly in cool, wet conditions.',
    },
    'powdery_mildew': {
      symptoms: ['White powdery coating on leaves', 'Yellowing leaves', 'Distorted new growth', 'Premature leaf drop'],
      treatment: ['Apply sulfur-based fungicide', 'Use neem oil spray (2ml/L water)', 'Apply potassium bicarbonate solution', 'Remove severely infected leaves'],
      prevention: ['Ensure good air circulation', 'Avoid overhead watering', 'Plant resistant varieties', 'Apply preventive sulfur spray'],
      description: 'Powdery mildew is a common fungal disease that affects many crops. It thrives in warm, dry conditions with high humidity at night.',
    },
    'bacterial_wilt': {
      symptoms: ['Sudden wilting of entire plant', 'Yellowing of lower leaves', 'Brown discoloration in stem vascular tissue', 'Plant death within days'],
      treatment: ['No effective chemical treatment available', 'Remove and destroy infected plants', 'Apply copper sulfate to surrounding soil', 'Solarize soil in affected area'],
      prevention: ['Use resistant varieties', 'Rotate crops', 'Ensure well-drained soil', 'Avoid planting in previously infected areas'],
      description: 'Bacterial wilt (Ralstonia solanacearum) causes sudden wilting and death. It persists in soil for years and spreads through water and contaminated tools.',
    },
    'leaf_spot': {
      symptoms: ['Circular brown spots on leaves', 'Yellow halos around spots', 'Spots may merge causing leaf death', 'Premature defoliation'],
      treatment: ['Apply chlorothalonil fungicide', 'Remove infected leaves', 'Apply copper-based spray', 'Improve air circulation'],
      prevention: ['Avoid overhead irrigation', 'Space plants properly', 'Remove plant debris', 'Use disease-free seeds'],
      description: 'Leaf spot diseases are caused by various fungi and bacteria. They reduce photosynthetic area and can significantly impact yield.',
    },
    'rust': {
      symptoms: ['Orange-brown pustules on leaf undersides', 'Yellow spots on upper leaf surface', 'Premature leaf drop', 'Reduced yield'],
      treatment: ['Apply triazole fungicide', 'Remove infected leaves', 'Apply sulfur spray', 'Use systemic fungicide for severe cases'],
      prevention: ['Plant resistant varieties', 'Ensure proper spacing', 'Avoid excessive nitrogen', 'Monitor fields regularly'],
      description: 'Rust diseases affect many cereal and legume crops. They reduce photosynthetic capacity and can cause significant yield losses.',
    },
    'mosaic_virus': {
      symptoms: ['Mottled yellow-green pattern on leaves', 'Stunted growth', 'Distorted leaves', 'Reduced fruit size'],
      treatment: ['No cure for viral diseases', 'Remove and destroy infected plants', 'Control insect vectors (aphids)', 'Use virus-free seeds'],
      prevention: ['Use certified virus-free seeds', 'Control aphid populations', 'Practice good hygiene', 'Remove weeds that host viruses'],
      description: 'Mosaic viruses are spread by insects and contaminated tools. Once infected, plants cannot be cured and must be removed.',
    },
  };

  async analyzeImage(imageData: string | Buffer): Promise<PlantImageAnalysis> {
    try {
      let base64Image: string;
      if (Buffer.isBuffer(imageData)) {
        base64Image = imageData.toString('base64');
      } else if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
        base64Image = imageData.split(',')[1];
      } else {
        base64Image = imageData as string;
      }

      const provider = await AIProviderFactory.getProvider();
      const prompt = `You are a professional agricultural plant pathologist. Analyze this plant leaf image.
Provide a diagnostic analysis in JSON format. The JSON MUST strictly match the following schema:
{
  "overallHealth": "healthy" | "stressed" | "diseased",
  "diseases": [
    {
      "disease": "Disease Name",
      "confidence": number (between 0 and 100),
      "severity": "mild" | "moderate" | "severe",
      "description": "Short explanation",
      "symptoms": ["symptom 1", "symptom 2"],
      "treatment": ["treatment 1", "treatment 2"],
      "prevention": ["prevention 1", "prevention 2"]
    }
  ],
  "nutrientDeficiencies": ["Deficiency 1"],
  "recommendations": ["Recommendation 1"],
  "confidence": number (overall analysis confidence, 0 to 100)
}
IMPORTANT: Return ONLY the JSON object, surrounded by \`\`\`json and \`\`\`. Do not write any conversational text.`;

      const result = await provider.analyzeImage(base64Image, prompt);
      const parsed = this.parseJSONResponse<PlantImageAnalysis>(result.analysis);

      if (parsed) {
        return parsed;
      }

      return this.generateFallbackAnalysis('Failed to parse LLM vision analysis');
    } catch (error) {
      logger.error('Plant disease analysis failed:', error);
      return this.generateFallbackAnalysis(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async analyzeSoilImage(imageData: string | Buffer, details?: any): Promise<SoilAnalysisResult> {
    try {
      let base64Image: string;
      if (Buffer.isBuffer(imageData)) {
        base64Image = imageData.toString('base64');
      } else if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
        base64Image = imageData.split(',')[1];
      } else {
        base64Image = imageData as string;
      }

      const provider = await AIProviderFactory.getProvider();
      const prompt = `You are an expert soil scientist and agronomist. Analyze this soil sample photo.
Optional farm / regional details: ${JSON.stringify(details || {})}
Provide a detailed soil analysis in JSON format. The JSON MUST strictly match the following schema:
{
  "overallHealthScore": number (0 to 100),
  "texture": "Texture class (e.g. Sandy Loam, Clay, Silt, etc.)",
  "estimatedMoisture": "Estimated moisture level (e.g. Optimal, Dry, Waterlogged)",
  "drainageClass": "Drainage class (e.g. Well-drained, Poorly-drained)",
  "colorDiscoloration": "Color and discoloration details",
  "npkDeficiencies": {
    "nitrogen": "low" | "optimal" | "high",
    "phosphorus": "low" | "optimal" | "high",
    "potassium": "low" | "optimal" | "high"
  },
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "cropSuitability": ["Suitable Crop 1", "Suitable Crop 2"],
  "confidence": number (overall analysis confidence, 0 to 100)
}
IMPORTANT: Return ONLY the JSON object, surrounded by \`\`\`json and \`\`\`. Do not write any conversational text.`;

      const result = await provider.analyzeImage(base64Image, prompt);
      const parsed = this.parseJSONResponse<SoilAnalysisResult>(result.analysis);

      if (parsed) {
        return parsed;
      }

      return this.generateFallbackSoilAnalysis('Failed to parse LLM soil analysis');
    } catch (error) {
      logger.error('Soil analysis failed:', error);
      return this.generateFallbackSoilAnalysis(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private parseJSONResponse<T>(content: string): T | null {
    try {
      let rawJson = content;
      const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
      const match = content.match(jsonBlockRegex);
      if (match && match[1]) {
        rawJson = match[1];
      } else {
        rawJson = content.replace(/```/g, '').trim();
      }
      return JSON.parse(rawJson) as T;
    } catch (e) {
      logger.error('JSON parsing from vision provider response failed. Content:', content, e);
      return null;
    }
  }

  private generateFallbackSoilAnalysis(error: string): SoilAnalysisResult {
    return {
      overallHealthScore: 50,
      texture: 'Loamy Soil (Estimated)',
      estimatedMoisture: 'Moderate (Estimated)',
      drainageClass: 'Well-drained (Estimated)',
      colorDiscoloration: `Analyzed with note: ${error}`,
      npkDeficiencies: {
        nitrogen: 'optimal',
        phosphorus: 'optimal',
        potassium: 'optimal',
      },
      recommendations: [
        'Ensure the image clearly shows the soil sample with good lighting',
        'Avoid extreme camera flash, glare, or heavy shadows',
        'Consider getting a physical laboratory NPK test for 100% accurate results',
      ],
      cropSuitability: ['Maize', 'Beans', 'Potatoes'],
      confidence: 30,
    };
  }

  async diagnoseFromSymptoms(symptoms: string[], cropType?: string): Promise<DiseaseDiagnosis[]> {
    const diagnoses: DiseaseDiagnosis[] = [];
    const symptomText = symptoms.join(' ').toLowerCase();

    for (const [diseaseId, diseaseInfo] of Object.entries(PlantDiseaseService.DISEASE_DATABASE)) {
      let matchScore = 0;
      const matchedSymptoms: string[] = [];

      for (const symptom of diseaseInfo.symptoms) {
        if (symptomText.includes(symptom.toLowerCase().split(' ')[0])) {
          matchScore++;
          matchedSymptoms.push(symptom);
        }
      }

      if (matchScore > 0) {
        const confidence = Math.min(matchScore / diseaseInfo.symptoms.length, 1);
        diagnoses.push({
          disease: diseaseId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          confidence: Math.round(confidence * 100),
          severity: confidence > 0.7 ? 'severe' : confidence > 0.4 ? 'moderate' : 'mild',
          description: diseaseInfo.description,
          symptoms: matchedSymptoms,
          treatment: diseaseInfo.treatment,
          prevention: diseaseInfo.prevention,
        });
      }
    }

    diagnoses.sort((a, b) => b.confidence - a.confidence);
    return diagnoses.slice(0, 3);
  }

  getDiseaseInfo(diseaseId: string): typeof PlantDiseaseService.DISEASE_DATABASE[string] | null {
    return PlantDiseaseService.DISEASE_DATABASE[diseaseId] || null;
  }

  getAllDiseases(): string[] {
    return Object.keys(PlantDiseaseService.DISEASE_DATABASE).map(id =>
      id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    );
  }

  private generateFallbackAnalysis(error: string): PlantImageAnalysis {
    return {
      overallHealth: 'stressed',
      diseases: [],
      nutrientDeficiencies: [],
      recommendations: [
        'For accurate disease diagnosis, please provide clear photos of affected plant parts',
        'Include both the top and underside of leaves if possible',
        'Note any visible symptoms: spots, wilting, discoloration, or growth abnormalities',
        'Consider using the symptom-based diagnosis tool as an alternative',
      ],
      confidence: 0,
    };
  }
}

export const plantDiseaseService = new PlantDiseaseService();
