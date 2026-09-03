import { Router, Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { bulkOperationsService } from '@/services/bulkOperationsService';
import { safeError } from '@/utils/safeResponse';

const router = Router();

/**
 * @openapi
 * /api/farmers/export:
 *   get:
 *     summary: Export farmers to CSV
 *     tags: [Farmers]
 *     parameters:
 *       - in: query
 *         name: region
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: CSV export
 *         content:
 *           text/csv:
 *             schema: { type: string }
 */
router.get('/export', async (req: Request, res: Response) => {
    try {
        const { region, search } = req.query;
        const { userId: _userId, role: _role } = req.user as Record<string, unknown>;
const userId = String(_userId);
const role = String(_role);

        const csvData = await bulkOperationsService.exportFarmersToCSV(
            { region: region as string, search: search as string },
            userId,
            role
        );

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="farmers_export.csv"');
        res.send(csvData);
    } catch (error) {
        logger.error('Export farmers error:', error);
        safeError(res, 500, 'Failed to export farmers');
    }
});

/**
 * @openapi
 * /api/farmers/import:
 *   post:
 *     summary: Import farmers from CSV
 *     tags: [Farmers]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV file containing farmer data
 *     responses:
 *       200:
 *         description: Import result
 */
router.post('/import', async (req: Request, res: Response) => {
    try {
        // Note: File upload middleware should be added to handle multipart/form-data
        // For now, assuming CSV content is sent in request body
        const csvData = req.body.csv || req.body;
        const { userId: _userId, role: _role } = req.user as Record<string, unknown>;
const userId = String(_userId);
const role = String(_role);

        if (!csvData || typeof csvData !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'CSV data is required'
            });
        }

        const result = await bulkOperationsService.importFarmersFromCSV(
            csvData,
            userId,
            role
        );

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Import farmers error:', error);
        safeError(res, 500, 'Failed to import farmers');
    }
});

export default router;
