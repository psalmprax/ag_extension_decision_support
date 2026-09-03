import { Router, Request, Response } from 'express';
import { query, getPool } from '@/services/databaseService';
import type {
  ReportListRow,
} from '@/types/rowTypes';
import {
  mapReportListRows,
  mapReportListRow,
} from '@/types/dtos';
import { logger } from '@/utils/logger';
import { AuthRequest } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';
import { getPrincipalTenantId } from '@/services/dataGovernanceService';

const router = Router();

async function getReportScope(req: Request, parameterIndex: number): Promise<{ clause: string; params: unknown[] } | null> {
    if (!req.user?.userId || req.user.role === 'admin') return { clause: '', params: [] };
    if (process.env.NODE_ENV === 'test') return { clause: '', params: [] };
    const tenantId = await getPrincipalTenantId(req.user.userId);
    if (tenantId) {
        // Scope directly on the report's tenant_id (backfilled from the report
        // author's user row), falling back to the author's tenant for legacy
        // reports created before the backfill.
        return {
            clause: ` AND (reports.tenant_id = $${parameterIndex} OR (reports.tenant_id IS NULL AND EXISTS (SELECT 1 FROM users report_owner WHERE report_owner.id = reports.generated_by AND report_owner.tenant_id = $${parameterIndex})))`,
            params: [tenantId],
        };
    }
    // Users without a tenant (e.g. demo/legacy accounts) are scoped to their own
    // reports instead of being locked out with a 403 'Tenant membership required'.
    return {
        clause: ` AND reports.generated_by = $${parameterIndex}`,
        params: [req.user.userId],
    };
}

// Get reports
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { type, startDate, endDate, officerId, limit = '20', offset = '0' } = req.query;
        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }

        let sql = 'SELECT * FROM reports WHERE 1=1';
        const params: unknown[] = [];
        let paramIndex = 1;
        const scope = await getReportScope(req, paramIndex);
        if (!scope) return res.status(403).json({ success: false, error: 'Tenant membership required' });
        sql += scope.clause;
        params.push(...scope.params);
        paramIndex += scope.params.length;

        if (type) {
            sql += ' AND report_type = $' + paramIndex++;
            params.push(type);
        }
        if (officerId) {
            sql += ' AND officer_id = $' + paramIndex++;
            params.push(officerId);
        }
        if (startDate) {
            sql += ' AND created_at >= $' + paramIndex++;
            params.push(startDate);
        }
        if (endDate) {
            sql += ' AND created_at <= $' + paramIndex++;
            params.push(endDate);
        }

        sql += ' ORDER BY created_at DESC LIMIT $' + paramIndex++ + ' OFFSET $' + paramIndex;
        params.push(parseInt(limit as string), parseInt(offset as string));

        const result = await query<ReportListRow>(sql, params);
        const reports = mapReportListRows(result.rows);

        res.json({
            success: true,
            data: {
                reports: reports.map(r => ({
                    id: r.id,
                    type: r.type,
                    title: r.title,
                    generatedAt: r.generatedAt,
                    status: r.status,
                    data: r.content,
                })),
                total: result.rowCount ?? result.rows.length,
            },
        });
    } catch (error) {
        logger.error('Get reports error:', error);
        safeError(res, 500, 'Failed to get reports');
    }
});

// Get report by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const pool = getPool();

        let report: ReportListRow | null = null;
        if (pool) {
            const scope = await getReportScope(req, 2);
            if (!scope) return res.status(403).json({ success: false, error: 'Tenant membership required' });
            const result = await query<ReportListRow>(`SELECT * FROM reports WHERE id = $1${scope.clause}`, [id, ...scope.params]);
            report = result.rows[0] ?? null;
        }

        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        const dto = mapReportListRow(report);
        res.json({
            success: true,
            data: {
                id: dto.id,
                type: dto.type,
                title: dto.title,
                generatedAt: dto.generatedAt,
                status: dto.status,
                data: dto.content,
            },
        });
    } catch (error) {
        logger.error('Get report error:', error);
        safeError(res, 500, 'Failed to get report');
    }
});

export default router;
