import { query } from './databaseService';
import { logger } from '@/utils/logger';
import { farmerScopeSql, type ScopePrincipal } from '@/services/access/farmerScope';
import { isUuid } from '@/utils/uuid';
import type { SoilTest, SoilTestInput } from '@/shared-api/fieldRecords';

interface SoilLabRow {
    id: string;
    field_id: string | null;
    lab_name: string | null;
    sample_ref: string | null;
    ph: string | null;
    organic_carbon_pct: string | null;
    organic_matter_pct: string | null;
    nitrogen_ppm: string | null;
    phosphorus_ppm: string | null;
    potassium_ppm: string | null;
    tested_at: Date | string | null;
}

const SOIL_LAB_COLUMNS = `id, field_id, lab_name, sample_ref, ph, organic_carbon_pct, organic_matter_pct,
    nitrogen_ppm, phosphorus_ppm, potassium_ppm, tested_at`;

const numberOrNull = (value: string | null): number | null => (value === null ? null : Number(value));

/** The test day as YYYY-MM-DD; results store the day, and a day has no time zone. */
function testDay(value: Date | string | null): string | null {
    if (value === null) return null;
    if (typeof value === 'string') return value.slice(0, 10);
    const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
}

function mapSoilLabRow(row: SoilLabRow): SoilTest {
    return {
        id: row.id,
        fieldId: row.field_id,
        testedAt: testDay(row.tested_at),
        labName: row.lab_name,
        sampleRef: row.sample_ref,
        ph: numberOrNull(row.ph),
        organicCarbonPct: numberOrNull(row.organic_carbon_pct),
        organicMatterPct: numberOrNull(row.organic_matter_pct),
        nitrogenPpm: numberOrNull(row.nitrogen_ppm),
        phosphorusPpm: numberOrNull(row.phosphorus_ppm),
        potassiumPpm: numberOrNull(row.potassium_ppm),
    };
}

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

    /**
     * Store lab results for the farmers the importer may see. A row whose farmer reference
     * (id or phone) matches none of them is reported and not stored: a result with no
     * farmer helps nobody, and one on another region's farmer is not this person's to add.
     */
    async importRows(rows: SoilLabRowInput[], importer: ScopePrincipal): Promise<{ imported: number; unmatchedFarmers: string[] }> {
        let imported = 0;
        const unmatchedFarmers: string[] = [];
        const scope = await farmerScopeSql(importer, 'f', 2);

        for (const row of rows) {
            const ref = row.farmerRef!;
            const byId = isUuid(ref);
            const { rows: farmer } = await query<{ id: string }>(
                `SELECT f.id FROM farmers f WHERE ${byId ? 'f.id = $1::uuid' : 'f.phone = $1'} AND ${scope.sql} LIMIT 1`,
                [ref, ...scope.params]
            );
            const farmerId = farmer[0]?.id;
            if (!farmerId) {
                unmatchedFarmers.push(ref);
                continue;
            }

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

    async getResultsForFarmer(farmerId: string): Promise<SoilTest[]> {
        const { rows } = await query<SoilLabRow>(
            `SELECT ${SOIL_LAB_COLUMNS} FROM soil_lab_results WHERE farmer_id = $1 ORDER BY tested_at DESC NULLS LAST LIMIT 50`,
            [farmerId]
        );
        return rows.map(mapSoilLabRow);
    },

    /** A field's results, oldest first, so a change over the years reads left to right. */
    async listForField(fieldId: string): Promise<SoilTest[]> {
        const { rows } = await query<SoilLabRow>(
            `SELECT ${SOIL_LAB_COLUMNS} FROM soil_lab_results WHERE field_id = $1
              ORDER BY tested_at ASC NULLS LAST, imported_at ASC LIMIT 200`,
            [fieldId]
        );
        return rows.map(mapSoilLabRow);
    },

    async addForField(field: { id: string; farmerId: string }, input: SoilTestInput): Promise<SoilTest> {
        const { rows } = await query<SoilLabRow>(
            `INSERT INTO soil_lab_results
                 (farmer_id, field_id, lab_name, sample_ref, ph, organic_carbon_pct, organic_matter_pct,
                  nitrogen_ppm, phosphorus_ppm, potassium_ppm, tested_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::date)
             RETURNING ${SOIL_LAB_COLUMNS}`,
            [
                field.farmerId, field.id, input.labName || null, input.sampleRef || null, input.ph ?? null,
                input.organicCarbonPct ?? null, input.organicMatterPct ?? null, input.nitrogenPpm ?? null,
                input.phosphorusPpm ?? null, input.potassiumPpm ?? null, input.testedAt,
            ]
        );
        return mapSoilLabRow(rows[0]);
    },

    /** Removes one result from a field; false when the field has no such result. */
    async removeFromField(fieldId: string, resultId: string): Promise<boolean> {
        const { rowCount } = await query('DELETE FROM soil_lab_results WHERE id = $1 AND field_id = $2', [resultId, fieldId]);
        return (rowCount ?? 0) > 0;
    },
};
