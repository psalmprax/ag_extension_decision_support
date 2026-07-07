import { Router, Request, Response } from 'express';
import type {
  CountRow,
  PriorityQueueRow,
  RecommendedVisitRow,
  AlertSummaryRow,
  FarmerDetailRow,
  PortfolioExportFarmerRow,
  PortfolioExportVisitRow,
} from '@/types/rowTypes';
import {
  mapCountRow,
  mapPriorityQueueRows,
  mapRecommendedVisitRows,
  mapAlertSummaryRows,
  mapFarmerDetailRow,
  mapPortfolioExportFarmerRows,
  mapPortfolioExportVisitRows,
} from '@/types/dtos';
import { query, getPool } from '@/services/databaseService';
import { cacheGet, cacheSet } from '@/services/cacheService';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';
import * as XLSX from 'xlsx';
import { safeError } from '@/utils/safeResponse';

const router = Router();

// Apply authentication to all portfolio routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

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
            query<CountRow>('SELECT COUNT(*) as count FROM farmers WHERE user_id = $1', [oId]),
            query<CountRow>("SELECT COUNT(*) as count FROM visits WHERE officer_id = $1 AND status = 'scheduled'", [oId]),
            query<CountRow>("SELECT COUNT(*) as count FROM visits WHERE officer_id = $1 AND status = 'scheduled' AND scheduled_at < NOW()", [oId]),
            query<CountRow>("SELECT COUNT(*) as count FROM visits WHERE officer_id = $1 AND status = 'scheduled' AND scheduled_at > NOW() AND scheduled_at < NOW() + INTERVAL '7 days'", [oId]),
            query<CountRow>(`
                SELECT COUNT(*) as count FROM visits v
                JOIN farmers f ON f.id = v.farmer_id
                WHERE v.officer_id = $1
                AND v.follow_up_required = true
                AND v.completed_at > NOW() - INTERVAL '30 days'
            `, [oId])
        ]);

        // Get priority queue (farmers needing attention)
        const priorityQueue = await query<PriorityQueueRow>(`
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
                totalFarmers: mapCountRow(totalFarmers.rows[0]).count,
                pendingVisits: mapCountRow(pendingVisits.rows[0]).count,
                overdueVisits: mapCountRow(overdueVisits.rows[0]).count,
                upcomingVisits: mapCountRow(upcomingVisits.rows[0]).count,
                highPriority: mapCountRow(highPriority.rows[0]).count,
            },
            priorityQueue: mapPriorityQueueRows(priorityQueue.rows),
            recentVisits: [],
        };

        await cacheSet(cacheKey, JSON.stringify({ success: true, data: portfolio }), 300);
        res.json({ success: true, data: portfolio });
    } catch (error) {
        logger.error('Portfolio error:', error);
        safeError(res, 500, 'Failed to get portfolio');
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
        const recommendedVisits = await query<RecommendedVisitRow>(`
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
                   45 as estimatedtime
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
        const alerts = await query<AlertSummaryRow>(`
            SELECT type, severity, description, location
            FROM alerts
            WHERE is_active = true
            ORDER BY severity DESC, triggered_at DESC
            LIMIT 5
        `);

        const recommendations = {
            date: targetDate,
            recommendedVisits: mapRecommendedVisitRows(recommendedVisits.rows),
            alerts: mapAlertSummaryRows(alerts.rows),
        };

        res.json({ success: true, data: recommendations });
    } catch (error) {
        logger.error('Recommendations error:', error);
        safeError(res, 500, 'Failed to get recommendations');
    }
});

// Update visit status
// Visit updates handled by /api/v1/visits/:id (visits.ts) — duplicate removed

// Get farmer details for visit
router.get('/farmers/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const pool = getPool();

        let farmer: FarmerDetailRow | null = null;
        if (pool) {
            const result = await query<FarmerDetailRow>(`
                SELECT f.id,
                       f.first_name,
                       f.last_name,
                       f.phone,
                       f.village,
                       f.district,
                       f.region,
                       f.location_lat,
                       f.location_lng,
                       f.farm_size_hectares,
                       f.crops,
                       f.language_preference,
                       (SELECT MAX(v.completed_at) FROM visits v WHERE v.farmer_id = f.id AND v.status = 'completed') as last_visit
                FROM farmers f
                WHERE f.id = $1
            `, [id]);
            farmer = result.rows[0] ?? null;
        }

        if (!farmer) {
            return res.status(404).json({ success: false, error: 'Farmer not found' });
        }

        const dto = mapFarmerDetailRow(farmer);
        res.json({
            success: true,
            data: {
                id: dto.id,
                name: `${dto.firstName} ${dto.lastName}`,
                location: {
                    lat: dto.locationLat,
                    lng: dto.locationLng,
                    village: dto.village,
                    district: dto.district,
                },
                farmSize: dto.farmSizeHectares,
                crops: dto.crops,
                lastVisit: dto.lastVisit,
                contact: {
                    phone: dto.phone,
                    preferredLanguage: dto.languagePreference,
                },
            },
        });
    } catch (error) {
        logger.error('Get farmer error:', error);
        safeError(res, 500, 'Failed to get farmer');
    }
});

function buildSummarySheet(farmers: PortfolioExportFarmerRow[], oId: string) {
    const summaryData: (string | number)[][] = [
        ['Portfolio Summary'],
        [''],
        ['Extension Officer', oId],
        ['Export Date', new Date().toLocaleString()],
        [''],
        ['Metric', 'Value'],
        ['Total Farmers', farmers.length],
        ['Farmers with Visits', farmers.filter(f => parseInt(f.total_visits, 10) > 0).length],
        ['Total Visits', farmers.reduce((sum, f) => sum + parseInt(f.total_visits, 10), 0)],
    ];
    return XLSX.utils.aoa_to_sheet(summaryData);
}

function buildFarmersSheet(farmers: PortfolioExportFarmerRow[]) {
    const farmerRows: (string | number)[][] = [
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
            farmer.farm_size_hectares != null ? Number(farmer.farm_size_hectares) : 0,
            (farmer.crops || []).join(', '),
            Number(farmer.total_visits) || 0,
            farmer.last_visit_date ? new Date(farmer.last_visit_date).toLocaleDateString() : 'Never'
        ]);
    }
    return XLSX.utils.aoa_to_sheet(farmerRows);
}

function buildVisitsSheet(visits: PortfolioExportVisitRow[]) {
    const visitsRows: (string | number)[][] = [
        ['Farmer Name', 'Village', 'Scheduled Date', 'Type', 'Notes']
    ];
    for (const visit of visits) {
        visitsRows.push([
            `${visit.first_name} ${visit.last_name}`,
            visit.village || '',
            visit.scheduled_at ? new Date(visit.scheduled_at).toLocaleString() : '',
            visit.type || visit.visit_type || 'routine',
            visit.notes || ''
        ]);
    }
    return XLSX.utils.aoa_to_sheet(visitsRows);
}

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
        const farmersResult = await query<PortfolioExportFarmerRow>(`
            SELECT f.id,
                   f.first_name,
                   f.last_name,
                   f.phone,
                   f.village,
                   f.district,
                   f.region,
                   f.farm_size_hectares,
                   f.crops,
                   (SELECT COUNT(*) FROM visits v WHERE v.farmer_id = f.id AND v.status = 'completed') as total_visits,
                   (SELECT MAX(v.completed_at) FROM visits v WHERE v.farmer_id = f.id AND v.status = 'completed') as last_visit_date
            FROM farmers f
            WHERE f.user_id = $1
            ORDER BY f.last_name, f.first_name
        `, [oId]);

        const farmers = farmersResult.rows;
        const wb = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(wb, buildSummarySheet(farmers, oId as string), 'Summary');
        XLSX.utils.book_append_sheet(wb, buildFarmersSheet(farmers), 'Farmers');

        // Get upcoming visits
        const visitsResult = await query<PortfolioExportVisitRow>(`
            SELECT v.id,
                   v.officer_id,
                   v.farmer_id,
                   v.visit_type,
                   v.status,
                   v.scheduled_at,
                   v.notes,
                   f.first_name,
                   f.last_name,
                   f.village
            FROM visits v
            JOIN farmers f ON f.id = v.farmer_id
            WHERE v.officer_id = $1 AND v.status = 'scheduled' AND v.scheduled_at > NOW()
            ORDER BY v.scheduled_at
            LIMIT 50
        `, [oId]);

        XLSX.utils.book_append_sheet(wb, buildVisitsSheet(visitsResult.rows), 'Upcoming Visits');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="portfolio_${oId}_${new Date().toISOString().split('T')[0]}.xlsx"`);
        res.send(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
    } catch (error) {
        logger.error('Export portfolio error:', error);
        safeError(res, 500, 'Failed to export portfolio');
    }
});

export default router;
