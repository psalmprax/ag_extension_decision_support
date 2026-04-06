/* eslint-disable @typescript-eslint/no-explicit-any */
import { shareService } from "@/services/shareService";
import { Router, Request, Response } from 'express';
import { query, getPool } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { usageService } from '../services/usageService';
import { bulkOperationsService } from '@/services/bulkOperationsService';
import PDFDocument from 'pdfkit';
import * as XLSX from 'xlsx';

const router = Router();

// Apply authentication to all reporting routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

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
        const { type, startDate, endDate, officerId, region, title, farmerId } = req.body;
        const pool = getPool();

        // Use default date range if not provided (last 30 days)
        const effectiveStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const effectiveEndDate = endDate || new Date().toISOString();

        const reportData: any = {};

        if (pool) {
            if (type === 'visit_summary' || type === 'activity_report') {
                const visitResult = await query(`
                    SELECT COUNT(*) as total, 
                           SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                           SUM(duration_minutes) as total_minutes
                    FROM visits 
                    WHERE scheduled_at >= $1 AND scheduled_at <= $2
                    ${officerId ? 'AND officer_id = $3' : ''}
                `, [effectiveStartDate, effectiveEndDate, officerId].filter(Boolean));

                reportData.visits = visitResult.rows[0];
            }

            if (type === 'impact_metrics' || type === 'activity_report') {
                const convResult = await query(`
                    SELECT COUNT(*) as total_conversations,
                           SUM(CASE WHEN satisfaction_score IS NOT NULL THEN 1 ELSE 0 END) as rated,
                           AVG(satisfaction_score) as avg_satisfaction
                    FROM conversations 
                    WHERE created_at >= $1 AND created_at <= $2
                `, [effectiveStartDate, effectiveEndDate]);

                reportData.conversations = convResult.rows[0];
            }

            const reportTitle = title || `${type.replace('_', ' ')} - ${new Date(effectiveStartDate).toLocaleDateString()} to ${new Date(effectiveEndDate).toLocaleDateString()}`;

            const result = await query(`
                INSERT INTO reports (report_type, title, officer_id, region, start_date, end_date, report_data, status, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', NOW())
                RETURNING *
            `, [type, reportTitle, officerId, region, effectiveStartDate, effectiveEndDate, JSON.stringify(reportData)]);

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

// Download report as CSV
router.get('/:id/download', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await query('SELECT * FROM reports WHERE id = $1', [id]);
        const report = result.rows[0];

        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        const data = report.report_data;
        let csv = 'Metric,Value\n';
        
        // Flatten the JSON report data into CSV rows
        if (data.visits) {
            csv += `Total Visits,${data.visits.total || 0}\n`;
            csv += `Completed Visits,${data.visits.completed || 0}\n`;
            csv += `Total Minutes,${data.visits.total_minutes || 0}\n`;
        }
        if (data.conversations) {
            csv += `Total Conversations,${data.conversations.total_conversations || 0}\n`;
            csv += `Average Satisfaction,${data.conversations.avg_satisfaction || 0}\n`;
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="report_${id}.csv"`);
        res.status(200).send(csv);
    } catch (error) {
        logger.error('Download report error:', error);
        res.status(500).json({ success: false, error: 'Failed to download report' });
    }
});

// Download report as PDF
router.get('/:id/download/pdf', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await query('SELECT * FROM reports WHERE id = $1', [id]);
        const report = result.rows[0];

        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="report_${id}.pdf"`);

        doc.pipe(res);

        // Header
        doc.fontSize(20).fillColor('#2c3e50').text('Agricultural Extension Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(14).fillColor('#34495e').text(report.title || 'Activity Report', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor('#7f8c8d').text(`Generated: ${new Date(report.created_at).toLocaleString()}`, { align: 'center' });
        doc.moveDown(2);

        // Report Details
        doc.fontSize(12).fillColor('#2c3e50').text('Report Details', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#34495e');
        doc.text(`Report Type: ${report.report_type}`);
        doc.text(`Status: ${report.status}`);
        doc.text(`Period: ${report.start_date ? new Date(report.start_date).toLocaleDateString() : 'N/A'} - ${report.end_date ? new Date(report.end_date).toLocaleDateString() : 'N/A'}`);
        doc.moveDown(1);

        // Visit Data
        const data = report.report_data as any;
        if (data.visits) {
            doc.fontSize(12).fillColor('#2c3e50').text('Visit Statistics', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#34495e');
            doc.text(`Total Visits: ${data.visits.total || 0}`);
            doc.text(`Completed Visits: ${data.visits.completed || 0}`);
            doc.text(`Total Minutes: ${data.visits.total_minutes || 0}`);
            doc.moveDown(1);
        }

        // Conversation Data
        if (data.conversations) {
            doc.fontSize(12).fillColor('#2c3e50').text('Conversation Statistics', { underline: true });
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#34495e');
            doc.text(`Total Conversations: ${data.conversations.total_conversations || 0}`);
            doc.text(`Rated Conversations: ${data.conversations.rated || 0}`);
            doc.text(`Average Satisfaction: ${data.conversations.avg_satisfaction ? data.conversations.avg_satisfaction.toFixed(1) + '/5' : 'N/A'}`);
            doc.moveDown(1);
        }

        // Footer
        doc.moveDown(2);
        doc.fontSize(8).fillColor('#95a5a6').text('Agricultural Extension Decision Support System', { align: 'center' });

        doc.end();
    } catch (error) {
        logger.error('Download PDF error:', error);
        res.status(500).json({ success: false, error: 'Failed to download PDF' });
    }
});

// Download report as Excel
router.get('/:id/download/excel', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const result = await query('SELECT * FROM reports WHERE id = $1', [id]);
        const report = result.rows[0];

        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        const data = report.report_data as any;
        const wb = XLSX.utils.book_new();

        // Summary Sheet
        const summaryData = [
            ['Agricultural Extension Report'],
            [''],
            ['Report Title', report.title || 'Activity Report'],
            ['Report Type', report.report_type],
            ['Status', report.status],
            ['Generated', new Date(report.created_at).toLocaleString()],
            ['Period Start', report.start_date ? new Date(report.start_date).toLocaleDateString() : 'N/A'],
            ['Period End', report.end_date ? new Date(report.end_date).toLocaleDateString() : 'N/A'],
        ];
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

        // Visits Sheet
        if (data.visits) {
            const visitsData = [
                ['Visit Statistics'],
                [''],
                ['Metric', 'Value'],
                ['Total Visits', data.visits.total || 0],
                ['Completed Visits', data.visits.completed || 0],
                ['Total Minutes', data.visits.total_minutes || 0],
            ];
            const visitsSheet = XLSX.utils.aoa_to_sheet(visitsData);
            XLSX.utils.book_append_sheet(wb, visitsSheet, 'Visits');
        }

        // Conversations Sheet
        if (data.conversations) {
            const convData = [
                ['Conversation Statistics'],
                [''],
                ['Metric', 'Value'],
                ['Total Conversations', data.conversations.total_conversations || 0],
                ['Rated Conversations', data.conversations.rated || 0],
                ['Average Satisfaction', data.conversations.avg_satisfaction || 0],
            ];
            const convSheet = XLSX.utils.aoa_to_sheet(convData);
            XLSX.utils.book_append_sheet(wb, convSheet, 'Conversations');
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="report_${id}.xlsx"`);
        XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    } catch (error) {
        logger.error('Download Excel error:', error);
        res.status(500).json({ success: false, error: 'Failed to download Excel' });
    }
});

router.post("/:id/share", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { isPublic, expiresAt, permissions } = req.body;
        const createdBy = req.user?.id;

        const shareLink = await shareService.createShare({
            entityType: "report",
            entityId: id,
            createdBy,
            isPublic,
            expiresAt: expiresAt ? new Date(expiresAt) : undefined,
            permissions,
        });

        res.status(201).json({
            success: true,
            data: shareLink,
        });
    } catch (error) {
        logger.error("Error creating report share:", error);
        res.status(500).json({
            success: false,
            error: "Failed to create share link",
        });
    }
});

export default router;
