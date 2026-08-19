export interface LanguageDetectionResult {
    language: 'en' | 'sw' | 'fr';
    confidence: number;
    indicators: Record<'en' | 'sw' | 'fr', number>;
}

const swahiliSet = new Set(['maziwa', 'ngamia', 'kilimo', 'nyanja', 'asili', 'shamba']);
const englishSet = new Set(['soil', 'water', 'crop', 'fertilizer', 'harvest', 'farm', 'pest', 'disease', 'treatment', 'prevention', 'yield']);
const frenchSet = new Set(['sol', 'eau', 'crope', 'engrais', 'récolte', 'ferme', 'maladie', 'traitement', 'prévention', 'rendement']);

const wordWeights: Record<string, number> = {
    'shamba': 3, 'kilimo': 3, 'nyanja': 2, 'asili': 2,
    'fertilizer': 3, 'pest': 3, 'disease': 3, 'harvest': 3,
    'engrais': 3, 'maladie': 3, 'traitement': 3,
};

export function detectLanguage(text: string): LanguageDetectionResult {
    if (!text) {
        return { language: 'en', confidence: 0, indicators: { en: 0, sw: 0, fr: 0 } };
    }

    const lower = text.toLowerCase();
    const words = lower.split(/\s+/).filter((w: string) => w.length > 0);

    let swScore = 0;
    let enScore = 0;
    let frScore = 0;

    for (const word of words) {
        const weight = wordWeights[word] || 1;

        if (swahiliSet.has(word)) {
            swScore += weight;
        }
        if (englishSet.has(word)) {
            enScore += weight;
        }
        if (frenchSet.has(word)) {
            frScore += weight;
        }
    }

    const totalWords = Math.max(words.length, 1);
    const avgSw = swScore / totalWords;
    const avgEn = enScore / totalWords;
    const avgFr = frScore / totalWords;

    const maxScore = Math.max(avgSw, avgEn, avgFr);
    const confidence = Math.min(maxScore * 100, 100);

    let language: 'en' | 'sw' | 'fr';
    if (avgSw > avgEn && avgSw > avgFr) language = 'sw';
    else if (avgEn > avgSw && avgEn > avgFr) language = 'en';
    else language = 'fr';

    const indicators = {
        en: Math.round(avgEn * 100),
        sw: Math.round(avgSw * 100),
        fr: Math.round(avgFr * 100),
    };

    return { language, confidence, indicators };
}
