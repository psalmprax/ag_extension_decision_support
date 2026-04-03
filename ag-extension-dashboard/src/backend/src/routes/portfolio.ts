/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { query, getPool } from '@/services/databaseService';
import { cacheGet, cacheSet } from '@/services/cacheService';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';
import * as XLSX from 'xlsx';

const router = Router();

// Apply authentication to all portfolio routes
router.use(authorize('admin', 'regional_manager', 'extension_officer', 'farmer'));

// Portfolio overview for extension officer
router.get('/', async (req: Request, res: Response) => {
    try {
        const { officerId } = req.query;
        const oId = officerId || 'current';

        const cacheKey = 'portfolio:' + oId;
        const cached = await cacheGet(cacheKey);
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }

        // Get portfolio summary
        const [
            totalFarmers,
            pendingVisits,
            overdueVisits,
            upcomingVisits,
            highPriority
        ] = await Promise.all([
            query('SELECT COUNT(*) as count FROM farmers WHERE user_id = $1', [oId]),
            query("SELECT COUNT(*) as count FROM visits WHERE officer_id = $1 AND status = 'scheduled'", [oId]),
            query("SELECT COUNT(*) as count FROM visits WHERE officer_id = $1 AND status = 'scheduled' AND scheduled_at < NOW()", [oId]),
            query("SELECT COUNT(*) as count FROM visits WHERE officer_id = $1 AND status = 'scheduled' AND scheduled_at > NOW() AND scheduled_at < NOW() + INTERVAL '7 days'", [oId]),
            query(`
                SELECT COUNT(*) as count FROM visits v
                JOIN farmers f ON f.id = v.farmer_id
                WHERE v.officer_id = $1 
                AND v.follow_up_required = true
                AND v.completed_at > NOW() - INTERVAL '30 days'
            `, [oId])
        ]);

        // Get priority queue (farmers needing attention)
        const priorityQueue = await query(`
            SELECT f.id as farmer_id, 
                   f.first_name || ' ' || f.last_name as name,
                   'Follow-up required' as reason,
                   CASE 
                       WHEN EXISTS (SELECT 1 FROM alerts a WHERE a.is_active = true AND f.region = ANY(a.affected_regions)) THEN 'high'
                       WHEN v.follow_up_required THEN 'medium'
                       ELSE 'low'
                   END as severity,
                   f.crops[1] as crop
            FROM farmers f
            LEFT JOIN LATERAL (
                SELECT v.created_at, v.follow_up_required
                FROM visits v 
                WHERE v.farmer_id = f.id AND v.status = 'completed'
                ORDER BY v.completed_at DESC
                LIMIT 1
            ) v ON true
            WHERE f.user_id = $1
            ORDER BY v.created_at ASC NULLS FIRST
            LIMIT 10
        `, [oId]);

        const portfolio = {
            summary: {
                totalFarmers: parseInt(totalFarmers.rows[0]?.count || '0'),
                pendingVisits: parseInt(pendingVisits.rows[0]?.count || '0'),
                overdueVisits: parseInt(overdueVisits.rows[0]?.count || '0'),
                upcomingVisits: parseInt(upcomingVisits.rows[0]?.count || '0'),
                highPriority: parseInt(highPriority.rows[0]?.count || '0'),
            },
            priorityQueue: priorityQueue.rows.map((row: any) => ({
                farmerId: row.farmer_id,
                name: row.name,
                reason: row.reason,
                severity: row.severity,
                crop: row.crop,
            })),
            recentVisits: [],
        };

        await cacheSet(cacheKey, JSON.stringify({ success: true, data: portfolio }), 300);
        res.json({ success: true, data: portfolio });
    } catch (error) {
        logger.error('Portfolio error:', error);
        res.status(500).json({ success: false, error: 'Failed to get portfolio' });
    }
});

// Get prioritized recommendations
router.get('/recommendations', async (req: Request, res: Response) => {
    try {
        const { officerId, date } = req.query;
        const oId = officerId || 'current';
        const targetDate = date || new Date().toISOString().split('T')[0];

        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }

        // Get recommended visits based on priority
        const recommendedVisits = await query(`
            SELECT f.id as farmer_id,
                   f.first_name || ' ' || f.last_name as name,
                   f.location_lat as lat,
                   f.location_lng as lng,
                   CASE 
                       WHEN EXISTS (SELECT 1 FROM alerts a WHERE a.is_active = true) THEN 'Disease alert'
                       WHEN v.follow_up_required THEN 'Follow-up required'
                       ELSE 'Routine check'
                   END as reason,
                   1 as priority,
                   45 as estimatedTime
            FROM farmers f
            LEFT JOIN LATERAL (
                SELECT v.follow_up_required, v.completed_at
                FROM visits v 
                WHERE v.farmer_id = f.id AND v.status = 'completed'
                ORDER BY v.completed_at DESC
                LIMIT 1
            ) v ON true
            WHERE f.user_id = $1
            ORDER BY v.completed_at ASC NULLS FIRST
            LIMIT 10
        `, [oId]);

        // Get active alerts
        const alerts = await query(`
            SELECT type, severity, description, location
            FROM alerts
            WHERE is_active = true
            ORDER BY severity DESC, triggered_at DESC
            LIMIT 5
        `);

        const recommendations = {
            date: targetDate,
            recommendedVisits: recommendedVisits.rows.map((row: any) => ({
                farmerId: row.farmer_id,
                name: row.name,
                location: { lat: row.lat, lng: row.lng },
                reason: row.reason,
                priority: row.priority,
                estimatedTime: row.estimatedtime,
            })),
            alerts: alerts.rows.map((row: any) => ({
                type: row.type,
                severity: row.severity,
                location: row.location,
                description: row.description,
            })),
        };

        res.json({ success: true, data: recommendations });
    } catch (error) {
        logger.error('Recommendations error:', error);
        res.status(500).json({ success: false, error: 'Failed to get recommendations' });
    }
});

// Update visit status
// Visit updates handled by /api/v1/visits/:id (visits.ts) — duplicate removed

// Get farmer details for visit
router.get('/farmers/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const pool = getPool();

        let farmer = null;
        if (pool) {
            const result = await query(`
                SELECT f.*, 
                       (SELECT MAX(v.completed_at) FROM visits v WHERE v.farmer_id = f.id AND v.status = 'completed') as last_visit
                FROM farmers f 
                WHERE f.id = $1
            `, [id]);
            farmer = result.rows[0];
        }

        if (!farmer) {
            return res.status(404).json({ success: false, error: 'Farmer not found' });
        }

        res.json({
            success: true,
            data: {
                id: farmer.id,
                name: farmer.first_name + ' ' + farmer.last_name,
                location: {
                    lat: farmer.location_lat,
                    lng: farmer.location_lng,
                    village: farmer.village,
                    district: farmer.district,
                },
                farmSize: farmer.farm_size_hectares,
                crops: farmer.crops,
                lastVisit: farmer.last_visit,
                contact: {
                    phone: farmer.phone,
                    preferredLanguage: farmer.language_preference,
                },
            },
        });
    } catch (error) {
        logger.error('Get farmer error:', error);
        res.status(500).json({ success: false, error: 'Failed to get farmer' });
    }
});

// Export portfolio as Excel
router.get('/export/excel', async (req: Request, res: Response) => {
    try {
        const { officerId } = req.query;
        const oId = officerId || 'current';
        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }

        // Get all farmers for this officer
        const farmersResult = await query(`
            SELECT f.*, 
                   (SELECT COUNT(*) FROM visits v WHERE v.farmer_id = f.id AND v.status = 'completed') as total_visits,
                   (SELECT MAX(v.completed_at) FROM visits v WHERE v.farmer_id = f.id AND v.status = 'completed') as last_visit_date
            FROM farmers f 
            WHERE f.user_id = $1
            ORDER BY f.last_name, f.first_name
        `, [oId]);

        const farmers = farmersResult.rows;
        const wb = XLSX.utils.book_new();

        // Summary sheet
        const summaryData = [
            ['Portfolio Summary'],
            [''],
            ['Extension Officer', oId],
            ['Export Date', new Date().toLocaleString()],
            [''],
            ['Metric', 'Value'],
            ['Total Farmers', farmers.length],
            ['Farmers with Visits', farmers.filter((f: any) => f.total_visits > 0).length],
            ['Total Visits', farmers.reduce((sum: number, f: any) => sum + parseInt(f.total_visits || '0'), 0)],
        ];
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

        // Farmers list sheet
        const farmerRows = [
            ['First Name', 'Last Name', 'Phone', 'Village', 'District', 'Region', 'Farm Size (ha)', 'Crops', 'Total Visits', 'Last Visit']
        ];
        for (const farmer of farmers) {
            farmerRows.push([
                farmer.first_name || '',
                farmer.last_name || '',
                farmer.phone || '',
                farmer.village || '',
                farmer.district || '',
                farmer.region || '',
                farmer.farm_size_hectares || 0,
                (farmer.crops || []).join(', '),
                farmer.total_visits || 0,
                farmer.last_visit_date ? new Date(farmer.last_visit_date).toLocaleDateString() : 'Never'
            ]);
        }
        const farmerSheet = XLSX.utils.aoa_to_sheet(farmerRows);
        XLSX.utils.book_append_sheet(wb, farmerSheet, 'Farmers');

        // Get upcoming visits
        const visitsResult = await query(`
            SELECT v.*, f.first_name, f.last_name, f.village
            FROM visits v
            JOIN farmers f ON f.id = v.farmer_id
            WHERE v.officer_id = $1 AND v.status = 'scheduled' AND v.scheduled_at > NOW()
            ORDER BY v.scheduled_at
            LIMIT 50
        `, [oId]);

        const visitsRows = [
            ['Farmer Name', 'Village', 'Scheduled Date', 'Type', 'Notes']
        ];
        for (const visit of visitsResult.rows) {
            visitsRows.push([
                `${visit.first_name} ${visit.last_name}`,
                visit.village || '',
                visit.scheduled_at ? new Date(visit.scheduled_at).toLocaleString() : '',
                visit.type || 'routine',
                visit.notes || ''
            ]);
        }
        const visitsSheet = XLSX.utils.aoa_to_sheet(visitsRows);
        XLSX.utils.book_append_sheet(wb, visitsSheet, 'Upcoming Visits');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="portfolio_${oId}_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    } catch (error) {
        logger.error('Export portfolio error:', error);
        res.status(500).json({ success: false, error: 'Failed to export portfolio' });
    }
});

export default router;
