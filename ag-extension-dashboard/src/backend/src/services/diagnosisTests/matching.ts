/**
 * Whether a diagnosis names the labelled problem. Labels are common names written by an
 * agronomist ("maize lethal necrosis", "healthy"); the AI may answer with more words
 * ("Maize Lethal Necrosis Disease (MLND)"). A match needs every significant word of the
 * label in the answer, so "leaf blight" does not match "northern leaf blight" the other way.
 */
const FILLER = new Set(['disease', 'of', 'the', 'and', 'on', 'in', 'a', 'virus', 'infection', 'spp', 'sp']);

export function labelWords(text: string): string[] {
    if (typeof text !== 'string') return [];
    return text.toLowerCase()
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        .filter(word => word.length > 1 && !FILLER.has(word));
}

/** The label as stored: lower case, single spaces, so "Leaf Rust " and "leaf rust" are one class. */
export function normaliseLabel(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 160);
}

export const HEALTHY = 'healthy';

export interface PredictionForMatch {
    overallHealth: string;
    diseases: Array<{ disease: string; confidence: number }>;
}

/** The answer the diagnosis gave, as one name: its top disease, or "healthy". */
export function topPrediction(prediction: PredictionForMatch): { name: string; confidence: number | null } {
    const top = prediction.diseases.toSorted((a, b) => b.confidence - a.confidence)[0];
    if (top?.disease) return { name: top.disease, confidence: top.confidence };
    return { name: prediction.overallHealth === 'healthy' ? HEALTHY : prediction.overallHealth, confidence: null };
}

export function matchesLabel(predicted: string, label: string): boolean {
    const wanted = labelWords(label);
    if (wanted.length === 0) return false;
    const got = new Set(labelWords(predicted));
    return wanted.every(word => got.has(word));
}
