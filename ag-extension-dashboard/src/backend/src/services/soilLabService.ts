import { query } from './databaseService';
import { logger } from '@/utils/logger';

export interface SoilLabRowInput {
    farmerRef?: string;
    labName?: string;
    sampleRef?: string;
    ph?: number;
    nitrogenPpm?: number;
    phosphorusPpm?: number;
    potassiumPpm?: number;
    organicMatterPct?: number;
    testedAt?: string;
}

/**
 * Soil lab CSV contract (header row required, order-insensitive):
 * farmer_ref,lab_name,sample_ref,ph,nitrogen_ppm,phosphorus_ppm,potassium_ppm,organic_matter_pct,tested_at
 */
export const EXPECTED_COLUMNS = ['farmer_ref', 'lab_name', 'sample_ref', 'ph', 'nitrogen_ppm', 'phosphorus_ppm', 'potassium_ppm', 'organic_matter_pct', 'tested_at'];

const numOrUndef = (record: Record<string, string>, key: string): number | undefined => {
    const n = Number(record[key]);
    return record[key] !== '' && Number.isFinite(n) ? n : undefined;
};

const dateOrUndef = (record: Record<string, string>, key: string): string | undefined => {
    const d = new Date(record[key]);
    return record[key] && !Number.isNaN(d.getTime()) ? d.toISOString() : undefined;
};

/** Parse a single CSV data line into a SoilLabRowInput, given the header mapping. */
function parseSoilLabRow(line: string, headers: string[], rowNumber: number): SoilLabRowInput {
    const values = line.split(',').map(v => v.trim());
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => (record[h] = values[idx] ?? ''));

    if (!record.farmer_ref) throw new Error(`Row ${rowNumber}: farmer_ref is required`);

    return {
        farmerRef: record.farmer_ref,
        labName: record.lab_name || undefined,
        sampleRef: record.sample_ref || undefined,
        ph: numOrUndef(record, 'ph'),
        nitrogenPpm: numOrUndef(record, 'nitrogen_ppm'),
        phosphorusPpm: numOrUndef(record, 'phosphorus_ppm'),
        potassiumPpm: numOrUndef(record, 'potassium_ppm'),
        organicMatterPct: numOrUndef(record, 'organic_matter_pct'),
        testedAt: dateOrUndef(record, 'tested_at'),
    };
}

/** Pure CSV parser → typed rows. Throws a descriptive error on malformed input. */
export function parseSoilLabCsv(csv: string): SoilLabRowInput[] {
    const lines = csv.trim().split(/\r?\n/);
    if (lines.length < 2) throw new Error('CSV must contain a header row and at least one data row');

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const missing = EXPECTED_COLUMNS.filter(c => !headers.includes(c));
    if (missing.length > 0) throw new Error(`CSV is missing required columns: ${missing.join(', ')}`);

    const rows: SoilLabRowInput[] = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        rows.push(parseSoilLabRow(lines[i], headers, i + 1));
    }
    return rows;
}

export const soilLabService = {
    parseSoilLabCsv,

    async importRows(rows: SoilLabRowInput[]): Promise<{ imported: number; unmatchedFarmers: string[] }> {
        let imported = 0;
        const unmatchedFarmers: string[] = [];

        for (const row of rows) {
            const { rows: farmer } = await query<{ id: string }>(
                'SELECT id FROM farmers WHERE id::text = $1 OR phone = $1 LIMIT 1',
                [row.farmerRef!]
            );
            const farmerId = farmer.length > 0 ? farmer[0].id : null;
            if (!farmerId) unmatchedFarmers.push(row.farmerRef!);

            await query(
                `INSERT INTO soil_lab_results
                     (farmer_id, lab_name, sample_ref, ph, nitrogen_ppm, phosphorus_ppm, potassium_ppm, organic_matter_pct, tested_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [farmerId, row.labName || null, row.sampleRef || null, row.ph ?? null, row.nitrogenPpm ?? null, row.phosphorusPpm ?? null, row.potassiumPpm ?? null, row.organicMatterPct ?? null, row.testedAt || null]
            );
            imported += 1;
        }
        logger.info(`Soil lab import: ${imported} rows, ${unmatchedFarmers.length} unmatched farmer refs`);
        return { imported, unmatchedFarmers: [...new Set(unmatchedFarmers)] };
    },

    async getResultsForFarmer(farmerId: string) {
        const { rows } = await query<{
            id: string;
            lab_name: string | null;
            sample_ref: string | null;
            ph: string | null;
            nitrogen_ppm: string | null;
            phosphorus_ppm: string | null;
            potassium_ppm: string | null;
            organic_matter_pct: string | null;
            tested_at: Date | null;
        }>(
            `SELECT id, lab_name, sample_ref, ph, nitrogen_ppm, phosphorus_ppm, potassium_ppm, organic_matter_pct, tested_at
             FROM soil_lab_results WHERE farmer_id = $1 ORDER BY tested_at DESC NULLS LAST LIMIT 50`,
            [farmerId]
        );
        return rows.map(r => ({
            id: r.id,
            labName: r.lab_name,
            sampleRef: r.sample_ref,
            ph: r.ph !== null ? Number(r.ph) : null,
            nitrogenPpm: r.nitrogen_ppm !== null ? Number(r.nitrogen_ppm) : null,
            phosphorusPpm: r.phosphorus_ppm !== null ? Number(r.phosphorus_ppm) : null,
            potassiumPpm: r.potassium_ppm !== null ? Number(r.potassium_ppm) : null,
            organicMatterPct: r.organic_matter_pct !== null ? Number(r.organic_matter_pct) : null,
            testedAt: r.tested_at,
        }));
    },
};
