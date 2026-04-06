import { logger } from '@/utils/logger';

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
      if (typeof imageData === 'string' && imageData.startsWith('data:')) {
        const base64Data = imageData.split(',')[1];
        if (!base64Data) {
          return this.generateFallbackAnalysis('Invalid image data');
        }
      }

      return this.generateFallbackAnalysis('Image analysis requires vision model integration');
    } catch (error) {
      logger.error('Plant disease analysis failed:', error);
      return this.generateFallbackAnalysis(error instanceof Error ? error.message : 'Unknown error');
    }
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
