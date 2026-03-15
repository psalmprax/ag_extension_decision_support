import { Router, Request, Response } from 'express';
import { query, getPool } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { usageService } from '../services/usageService';

const router = Router();

// Apply authentication to all reporting routes
router.use(authorize('admin', 'regional_manager', 'extension_officer', 'farmer'));

// Get reports
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { type, startDate, endDate, officerId, limit = '20', offset = '0' } = req.query;
        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }

        let sql = 'SELECT * FROM reports WHERE 1=1';
        const params: any[] = [];
        let paramIndex = 1;

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

        const result = await query(sql, params);

        res.json({
            success: true,
            data: {
                reports: result.rows.map((r: any) => ({
                    id: r.id,
                    type: r.report_type,
                    title: r.title,
                    generatedAt: r.created_at,
                    status: r.status,
                    data: r.report_data,
                })),
                total: result.rows.length,
            },
        });
    } catch (error) {
        logger.error('Get reports error:', error);
        res.status(500).json({ success: false, error: 'Failed to get reports' });
    }
});

// Generate report
router.post('/generate', checkUsageLimit('report'), async (req: AuthRequest, res: Response) => {
    try {
        const { type, startDate, endDate, officerId, region } = req.body;
        const pool = getPool();

        let reportData: any = {};

        if (pool) {
            if (type === 'visit_summary' || type === 'activity_report') {
                const visitResult = await query(`
                    SELECT COUNT(*) as total, 
                           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                           SUM(duration_minutes) as total_minutes
                    FROM visits 
                    WHERE scheduled_at >= $1 AND scheduled_at <= $2
                    ${officerId ? 'AND officer_id = $3' : ''}
                `, [startDate, endDate, officerId].filter(Boolean));

                reportData.visits = visitResult.rows[0];
            }

            if (type === 'impact_metrics' || type === 'activity_report') {
                const convResult = await query(`
                    SELECT COUNT(*) as total_conversations,
                           SUM(CASE WHEN satisfaction_score IS NOT NULL THEN 1 ELSE 0 END) as rated,
                           AVG(satisfaction_score) as avg_satisfaction
                    FROM conversations 
                    WHERE created_at >= $1 AND created_at <= $2
                `, [startDate, endDate]);

                reportData.conversations = convResult.rows[0];
            }

            const result = await query(`
                INSERT INTO reports (report_type, title, officer_id, region, start_date, end_date, report_data, status, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', NOW())
                RETURNING *
            `, [type, `${type.replace('_', ' ')} - ${new Date(startDate).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`, officerId, region, startDate, endDate, JSON.stringify(reportData)]);

            await usageService.incrementUsage(req.user!.userId, 'report');

            return res.status(201).json({
                success: true,
                data: {
                    id: result.rows[0].id,
                    type: result.rows[0].report_type,
                    title: result.rows[0].title,
                    generatedAt: result.rows[0].created_at,
                    status: result.rows[0].status,
                    data: reportData,
                },
            });
        }

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }
    } catch (error) {
        logger.error('Generate report error:', error);
        res.status(500).json({ success: false, error: 'Failed to generate report' });
    }
});

// Get report by ID
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const pool = getPool();

        let report = null;
        if (pool) {
            const result = await query('SELECT * FROM reports WHERE id = $1', [id]);
            report = result.rows[0];
        }

        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        res.json({
            success: true,
            data: {
                id: report.id,
                type: report.report_type,
                title: report.title,
                generatedAt: report.created_at,
                status: report.status,
                data: report.report_data,
            },
        });
    } catch (error) {
        logger.error('Get report error:', error);
        res.status(500).json({ success: false, error: 'Failed to get report' });
    }
});

export default router;
