import { query } from './databaseService';
import { logger } from '@/utils/logger';
import { demoSql, type DemoViewer } from '@/services/demoScope';

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
        const sanitized = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
        return /[",\n']/.test(sanitized) ? `"${sanitized.replace(/"/g, '""')}"` : sanitized;
    };
    const header = columns.join(',');
    const body = rows.map(r => columns.map(c => escape(r[c])).join(',')).join('\n');
    return `mis_version=${MIS_VERSION}\n${header}\n${body}\n`;
};

const FARMER_COLUMNS = ['farmer_ref', 'district', 'region', 'village', 'crops', 'farm_size_ha', 'registered_at'];
const VISIT_COLUMNS = ['visit_ref', 'farmer_ref', 'officer_ref', 'visit_type', 'status', 'visit_date', 'follow_up_required'];
const OUTCOME_COLUMNS = ['visit_ref', 'crop', 'advice_category', 'outcome', 'measured_at'];

/**
 * Whose records an export may hold: an officer their own farmers, a manager their region,
 * an administrator everyone. The same rule as the farmer list and the farm map.
 */
export type MisScope =
    | { kind: 'all'; viewer?: DemoViewer }
    | { kind: 'officer'; officerId: string; viewer?: DemoViewer }
    // A manager with no region on record gets an empty export (NULL matches no row).
    | { kind: 'region'; region: string | null; viewer?: DemoViewer };

/** WHERE conditions on the farmers table (alias f), starting at parameter $2. */
function farmerScopeSql(scope: MisScope): { sql: string; params: unknown[] } {
    const conditions = ['f.is_active = true', demoSql('f', scope.viewer)];
    const params: unknown[] = [];
    if (scope.kind === 'officer') {
        params.push(scope.officerId);
        conditions.push(`f.assigned_officer_id = $${params.length + 1}`);
    } else if (scope.kind === 'region') {
        params.push(scope.region);
        conditions.push(`f.region = $${params.length + 1}`);
    }
    return { sql: conditions.join(' AND '), params };
}

const DATASETS: Record<MisDataset, { columns: string[]; sql: (where: string) => string }> = {
    farmers: {
        columns: FARMER_COLUMNS,
        sql: where => `SELECT f.id AS farmer_ref, f.district, f.region, f.village,
                        array_to_string(f.crops, ';') AS crops,
                        f.farm_size_hectares AS farm_size_ha,
                        f.created_at AS registered_at
                 FROM farmers f WHERE ${where} ORDER BY f.created_at LIMIT $1`,
    },
    visits: {
        columns: VISIT_COLUMNS,
        sql: where => `SELECT v.id AS visit_ref, v.farmer_id AS farmer_ref, v.officer_id AS officer_ref,
                        v.visit_type, v.status,
                        COALESCE(v.completed_at, v.scheduled_at) AS visit_date,
                        v.follow_up_required AS follow_up_required
                 FROM visits v JOIN farmers f ON f.id = v.farmer_id
                 WHERE ${where}
                 ORDER BY COALESCE(v.completed_at, v.scheduled_at) DESC NULLS LAST LIMIT $1`,
    },
    outcomes: {
        columns: OUTCOME_COLUMNS,
        sql: where => `SELECT o.visit_id AS visit_ref, o.crop, o.advice_category, o.outcome, o.measured_at
                 FROM recommendation_outcomes o
                 JOIN visits v ON v.id = o.visit_id JOIN farmers f ON f.id = v.farmer_id
                 WHERE ${where}
                 ORDER BY o.measured_at DESC LIMIT $1`,
    },
};

export const misExportService = {
    version: MIS_VERSION,

    async exportDataset(
        dataset: MisDataset,
        scope: MisScope = { kind: 'all' },
        limit = 10000
    ): Promise<{ csv: string; rowCount: number }> {
        const spec = Object.prototype.hasOwnProperty.call(DATASETS, dataset) ? DATASETS[dataset] : undefined;
        if (!spec) throw new Error('UNKNOWN_DATASET');
        const where = farmerScopeSql(scope);
        const { rows } = await query<Record<string, unknown>>(spec.sql(where.sql), [limit, ...where.params]);
        logger.debug(`MIS export ${dataset}: ${rows.length} rows`);
        return { csv: toCsv(rows, spec.columns), rowCount: rows.length };
    },
};
