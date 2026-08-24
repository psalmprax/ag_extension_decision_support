import { query } from './databaseService';
import { logger } from '@/utils/logger';

/**
 * Government MIS interop — standardized CSV exports with a documented column
 * contract so national extension systems (AESA-style MIS, DHIS2-like) can
 * ingest GPExts data. Column order is the contract: never reorder without a
 * version bump (see `mis_version` header row).
 */

export const MIS_VERSION = '1.0';

export type MisDataset = 'farmers' | 'visits' | 'outcomes';

const toCsv = (rows: Record<string, unknown>[], columns: string[]): string => {
    const escape = (v: unknown): string => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = columns.join(',');
    const body = rows.map(r => columns.map(c => escape(r[c])).join(',')).join('\n');
    return `mis_version=${MIS_VERSION}\n${header}\n${body}\n`;
};

const FARMER_COLUMNS = ['farmer_ref', 'district', 'region', 'village', 'crops', 'farm_size_ha', 'registered_at'];
const VISIT_COLUMNS = ['visit_ref', 'farmer_ref', 'officer_ref', 'visit_type', 'status', 'visit_date', 'follow_up_required'];
const OUTCOME_COLUMNS = ['visit_ref', 'crop', 'advice_category', 'outcome', 'measured_at'];

export const misExportService = {
    version: MIS_VERSION,

    async exportDataset(dataset: MisDataset, limit = 10000): Promise<{ csv: string; rowCount: number }> {
        let rows: Record<string, unknown>[];
        let columns: string[];

        if (dataset === 'farmers') {
            columns = FARMER_COLUMNS;
            const { rows: r } = await query<Record<string, unknown>>(
                `SELECT id AS farmer_ref, district, region, village,
                        array_to_string(crops, ';') AS crops,
                        farm_size_hectares AS farm_size_ha,
                        created_at AS registered_at
                 FROM farmers WHERE is_active = true ORDER BY created_at LIMIT $1`,
                [limit]
            );
            rows = r;
        } else if (dataset === 'visits') {
            columns = VISIT_COLUMNS;
            const { rows: r } = await query<Record<string, unknown>>(
                `SELECT v.id AS visit_ref, v.farmer_id AS farmer_ref, v.officer_id AS officer_ref,
                        v.visit_type, v.status,
                        COALESCE(v.completed_at, v.scheduled_at) AS visit_date,
                        v.follow_up_required AS follow_up_required
                 FROM visits v ORDER BY COALESCE(v.completed_at, v.scheduled_at) DESC NULLS LAST LIMIT $1`,
                [limit]
            );
            rows = r;
        } else if (dataset === 'outcomes') {
            columns = OUTCOME_COLUMNS;
            const { rows: r } = await query<Record<string, unknown>>(
                `SELECT visit_id AS visit_ref, crop, advice_category, outcome, measured_at
                 FROM recommendation_outcomes ORDER BY measured_at DESC LIMIT $1`,
                [limit]
            );
            rows = r;
        } else {
            throw new Error('UNKNOWN_DATASET');
        }

        logger.debug(`MIS export ${dataset}: ${rows.length} rows`);
        return { csv: toCsv(rows, columns), rowCount: rows.length };
    },
};
