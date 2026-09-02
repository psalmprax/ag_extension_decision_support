/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@/utils/logger';
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';

// NOTE: A backend ONNX inference path was removed during the truthfulness remediation:
// it fed a uniform tensor derived from the first byte of the JPEG header into an
// untrained surrogate model and stamped healthy outputs as `verified_source`.
// Image diagnosis goes through the LLM vision provider below until a trained
// on-device model is wired with real pixel decoding (see the frontend classifier).

export type DiagnosticEvidenceStatus = 'verified_source' | 'no_verified_source';
export type DiagnosticReviewStatus = 'ready' | 'needs_expert_review';

export interface DiagnosticProvenance {
  evidenceStatus: DiagnosticEvidenceStatus;
  source: string;
  sourceUrl: string | null;
  sourceTimestamp: string | null;
  provider: string | null;
  model: string | null;
  generatedAt: string;
}

export interface DiseaseDiagnosis {
  disease: string;
  confidence: number;
  reviewStatus: DiagnosticReviewStatus;
  provenance: DiagnosticProvenance;
  safetyNotice: string;
  severity: 'mild' | 'moderate' | 'severe';
  description: string;
  symptoms: string[];
  treatment: string[];
  prevention: string[];
  imageUrl?: string;
}

export interface PlantImageAnalysis {
  overallHealth: 'healthy' | 'stressed' | 'diseased' | 'unknown';
  diseases: DiseaseDiagnosis[];
  nutrientDeficiencies: string[];
  recommendations: string[];
  confidence: number;
  reviewStatus: DiagnosticReviewStatus;
  provenance: DiagnosticProvenance;
}

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
}

const DIAGNOSTIC_REVIEW_THRESHOLD = 0.75;
const DIAGNOSTIC_SAFETY_NOTICE =
  'General guidance only. Confirm the diagnosis with a qualified agronomist and follow locally approved product labels before treatment.';

function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const normalized = value > 1 ? value / 100 : value;
  return Math.max(0, Math.min(1, normalized));
}

function getReviewStatus(confidence: number): DiagnosticReviewStatus {
  return normalizeConfidence(confidence) >= DIAGNOSTIC_REVIEW_THRESHOLD ? 'ready' : 'needs_expert_review';
}

function createProvenance(
  source: string,
  generatedAt: string,
  options: Partial<Pick<DiagnosticProvenance, 'evidenceStatus' | 'sourceUrl' | 'sourceTimestamp' | 'provider' | 'model'>> = {}
): DiagnosticProvenance {
  return {
    evidenceStatus: options.evidenceStatus ?? 'no_verified_source',
    source,
    sourceUrl: options.sourceUrl ?? null,
    sourceTimestamp: options.sourceTimestamp ?? null,
    provider: options.provider ?? null,
    model: options.model ?? null,
    generatedAt,
  };
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
      const generatedAt = new Date().toISOString();
      const provenance = createProvenance('AI vision analysis; no verified agronomic source attached', generatedAt, {
        provider: provider.provider,
        model: result.model,
      });
      const parsed = this.parseJSONResponse<PlantImageAnalysis>(result.analysis);

      if (parsed) {
        return this.normalizeImageAnalysis(parsed, provenance);
      }

      return this.generateFallbackAnalysis('Failed to parse LLM vision analysis', provenance);
    } catch (error) {
      logger.error('Plant disease analysis failed:', error);
      return this.generateFallbackAnalysis(
        error instanceof Error ? error.message : 'Unknown error',
        createProvenance('AI vision analysis unavailable; no verified source', new Date().toISOString())
      );
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
      const generatedAt = new Date().toISOString();
      const provenance = createProvenance('AI soil image analysis; no verified laboratory source attached', generatedAt, {
        provider: provider.provider,
        model: result.model,
      });
      const parsed = this.parseJSONResponse<SoilAnalysisResult>(result.analysis);

      if (parsed) {
        return this.normalizeSoilAnalysis(parsed, provenance);
      }

      return this.generateFallbackSoilAnalysis('Failed to parse LLM soil analysis', provenance);
    } catch (error) {
      logger.error('Soil analysis failed:', error);
      return this.generateFallbackSoilAnalysis(
        error instanceof Error ? error.message : 'Unknown error',
        createProvenance('AI soil image analysis unavailable; no verified source', new Date().toISOString())
      );
    }
  }

  private normalizeImageAnalysis(
    analysis: PlantImageAnalysis,
    provenance: DiagnosticProvenance
  ): PlantImageAnalysis {
    const confidence = normalizeConfidence(analysis.confidence);
    const reviewStatus = getReviewStatus(confidence);
    return {
      ...analysis,
      confidence,
      reviewStatus,
      provenance,
      diseases: (analysis.diseases ?? []).map(disease => {
        const diseaseConfidence = normalizeConfidence(disease.confidence);
        return {
          ...disease,
          confidence: diseaseConfidence,
          reviewStatus: getReviewStatus(diseaseConfidence),
          provenance,
          safetyNotice: disease.safetyNotice ?? DIAGNOSTIC_SAFETY_NOTICE,
        };
      }),
    };
  }

  private normalizeSoilAnalysis(
    analysis: SoilAnalysisResult,
    provenance: DiagnosticProvenance
  ): SoilAnalysisResult {
    const confidence = normalizeConfidence(analysis.confidence);
    return {
      ...analysis,
      overallHealthScore:
        typeof analysis.overallHealthScore === 'number'
          ? Math.max(0, Math.min(100, analysis.overallHealthScore))
          : null,
      confidence,
      reviewStatus: getReviewStatus(confidence),
      provenance,
      npkDeficiencies: {
        nitrogen: analysis.npkDeficiencies?.nitrogen ?? 'unknown',
        phosphorus: analysis.npkDeficiencies?.phosphorus ?? 'unknown',
        potassium: analysis.npkDeficiencies?.potassium ?? 'unknown',
      },
    };
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

  private generateFallbackSoilAnalysis(
    error: string,
    provenance: DiagnosticProvenance
  ): SoilAnalysisResult {
    return {
      overallHealthScore: null,
      texture: 'Unavailable',
      estimatedMoisture: 'Unavailable',
      drainageClass: 'Unavailable',
      colorDiscoloration: `Analysis unavailable: ${error}`,
      npkDeficiencies: {
        nitrogen: 'unknown',
        phosphorus: 'unknown',
        potassium: 'unknown',
      },
      recommendations: [
        'Upload a clearer soil image with even lighting',
        'Use a physical laboratory NPK test for verified soil measurements',
      ],
      cropSuitability: [],
      confidence: 0,
      reviewStatus: 'needs_expert_review',
      provenance,
    };
  }

  private tokenize(text: string): string[] {
    const stopwords = new Set(['on', 'of', 'and', 'the', 'with', 'a', 'or', 'in', 'to', 'for', 'at', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'an']);
    return text
      .toLowerCase()
      .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopwords.has(word));
  }

  private vectorize(tokens: string[], vocab: string[], idf: Record<string, number>): number[] {
    const tf: Record<string, number> = {};
    for (const t of tokens) {
      tf[t] = (tf[t] || 0) + 1;
    }
    return vocab.map(term => {
      const termTf = tf[term] || 0;
      return termTf * (idf[term] || 0);
    });
  }

  private buildTFIDFVectors() {
    const documents = Object.entries(PlantDiseaseService.DISEASE_DATABASE).map(([id, info]) => {
      const tokens = this.tokenize(info.symptoms.join(' ') + ' ' + info.description);
      return { id, tokens, info };
    });

    const vocabularySet = new Set<string>();
    for (const doc of documents) {
      for (const token of doc.tokens) {
        vocabularySet.add(token);
      }
    }
    const vocab = Array.from(vocabularySet);

    const N = documents.length;
    const idf: Record<string, number> = {};
    for (const term of vocab) {
      const df = documents.filter(doc => doc.tokens.includes(term)).length;
      idf[term] = Math.log((N + 1) / (df + 1)) + 1;
    }

    const docVectors: Record<string, number[]> = {};
    for (const doc of documents) {
      docVectors[doc.id] = this.vectorize(doc.tokens, vocab, idf);
    }

    return { vocab, idf, docVectors };
  }

  private cosineSimilarity(v1: number[], v2: number[]): number {
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;
    for (let i = 0; i < v1.length; i++) {
      dotProduct += v1[i] * v2[i];
      mag1 += v1[i] * v1[i];
      mag2 += v2[i] * v2[i];
    }
    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
  }

  async diagnoseFromSymptoms(symptoms: string[], _cropType?: string): Promise<DiseaseDiagnosis[]> {
    const queryText = symptoms.join(' ');
    const queryTokens = this.tokenize(queryText);
    
    const { vocab, idf, docVectors } = this.buildTFIDFVectors();
    const queryVector = this.vectorize(queryTokens, vocab, idf);

    const diagnoses: DiseaseDiagnosis[] = [];

    for (const [diseaseId, diseaseInfo] of Object.entries(PlantDiseaseService.DISEASE_DATABASE)) {
      const docVector = docVectors[diseaseId];
      const similarity = this.cosineSimilarity(queryVector, docVector);

      if (similarity > 0.05) {
        const matchedSymptoms = diseaseInfo.symptoms.filter(symptom => {
          const symptomTokens = this.tokenize(symptom);
          return symptomTokens.some(tok => queryTokens.includes(tok));
        });

        const confidence = normalizeConfidence(similarity);
        const provenance = createProvenance(
          'Internal heuristic knowledge base (TF-IDF symptom keyword matcher) — not a laboratory or field-verified source',
          new Date().toISOString(),
          { evidenceStatus: 'no_verified_source', model: 'tfidf-symptom-matcher' }
        );
        diagnoses.push({
          disease: diseaseId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          confidence,
          reviewStatus: getReviewStatus(confidence),
          provenance,
          safetyNotice: DIAGNOSTIC_SAFETY_NOTICE,
          severity: similarity > 0.7 ? 'severe' : similarity > 0.4 ? 'moderate' : 'mild',
          description: diseaseInfo.description,
          symptoms: matchedSymptoms.length > 0 ? matchedSymptoms : [diseaseInfo.symptoms[0]],
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

  private generateFallbackAnalysis(
    error: string,
    provenance: DiagnosticProvenance
  ): PlantImageAnalysis {
    return {
      overallHealth: 'unknown',
      diseases: [],
      nutrientDeficiencies: [],
      recommendations: [
        'Analysis was unavailable; do not treat this as a diagnosis',
        'Provide clear photos of affected plant parts for another attempt',
        'Consider an in-person agronomist or laboratory assessment',
      ],
      confidence: 0,
      reviewStatus: 'needs_expert_review',
      provenance: {
        ...provenance,
        source: `${provenance.source} (${error})`,
      },
    };
  }
}

export const plantDiseaseService = new PlantDiseaseService();
