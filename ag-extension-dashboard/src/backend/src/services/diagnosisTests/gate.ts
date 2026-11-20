/**
 * What a farmer is told about a photo diagnosis depends on how it did on labelled photos
 * of that crop and problem. A diagnosis is "tested" only when the latest run had enough
 * photos of that class and got enough of them right; otherwise it is marked for the
 * officer to confirm, however sure the AI says it is.
 */
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import type { PlantImageAnalysis } from '@/services/plantDiseaseService';
import { matchesLabel, normaliseLabel } from './matching';

export const MIN_SAMPLES = Number(process.env.DIAGNOSIS_MIN_SAMPLES || 20);
export const MIN_ACCURACY = Number(process.env.DIAGNOSIS_MIN_ACCURACY || 0.85);

export type ValidationStatus = 'tested' | 'below_threshold' | 'not_tested';

export interface DiagnosisValidation {
    status: ValidationStatus;
    samples: number;
    /** Share of test photos of this crop and problem the diagnosis got right (0–1); null when untested. */
    accuracy: number | null;
}

interface ClassStatusRow { label: string; samples: number; correct: number }

export function validationFor(disease: string, classes: ClassStatusRow[]): DiagnosisValidation {
    const row = classes.find(c => typeof c.label === 'string' && matchesLabel(disease, c.label));
    if (!row || row.samples === 0) return { status: 'not_tested', samples: row?.samples ?? 0, accuracy: null };
    const accuracy = row.correct / row.samples;
    const passed = row.samples >= MIN_SAMPLES && accuracy >= MIN_ACCURACY;
    return { status: passed ? 'tested' : 'below_threshold', samples: row.samples, accuracy };
}

/** The analysis with each diagnosis's test result; untested ones need the officer's confirmation. */
export async function withValidation<T extends PlantImageAnalysis>(analysis: T, crop?: string | null): Promise<T & { validation: DiagnosisValidation | null }> {
    let classes: ClassStatusRow[] = [];
    if (crop?.trim()) {
        try {
            const { rows } = await query<ClassStatusRow>(
                'SELECT label, samples, correct FROM diagnosis_class_status WHERE crop = $1',
                [normaliseLabel(crop)],
            );
            classes = rows;
        } catch (error) {
            logger.warn('Diagnosis test results unavailable; treating every diagnosis as untested:', error);
        }
    }
    const diseases = (analysis.diseases ?? []).map(d => {
        const validation = validationFor(d.disease, classes);
        return { ...d, validation, reviewStatus: validation.status === 'tested' ? d.reviewStatus : 'needs_expert_review' as const };
    });
    const top = [...diseases].sort((a, b) => b.confidence - a.confidence)[0];
    return {
        ...analysis,
        diseases,
        reviewStatus: top && top.validation.status !== 'tested' ? 'needs_expert_review' : analysis.reviewStatus,
        validation: top?.validation ?? null,
    };
}
