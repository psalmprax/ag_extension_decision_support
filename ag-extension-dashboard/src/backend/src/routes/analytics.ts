/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { query, getPool } from '@/services/databaseService';
import { cacheGet, cacheSet } from '@/services/cacheService';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';

const router = Router();

// Apply authentication to all analytics routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

// Helper to safely execute database queries with fallback
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getFromDB(sql: string, params: unknown[] = []): Promise<any[]> {
    try {
        const pool = getPool();
        if (!pool) {
            logger.warn('Database not available, using fallback');
            return [];
        }
        const result = await query(sql, params);
        return result.rows || [];
    } catch (error) {
        logger.error('Database query error:', error);
        return [];
    }
}

// Dashboard overview - fetches real data from database
router.get('/dashboard', async (req: Request, res: Response) => {
    try {
        const { userId, role } = req.user as any;
        const isOfficer = role === 'extension_officer';
        const isManager = role === 'regional_manager';
        const officerId = isOfficer ? userId : null;
        
        // Fetch manager region if needed
        let managerRegion = null;
        if (isManager) {
            const manager = await getFromDB("SELECT region FROM users WHERE id = $1", [userId]);
            managerRegion = manager[0]?.region;
        }

        // Try to get cached data first - user-specific for officers/managers
        const cacheKey = isOfficer ? `analytics:dashboard:${userId}` : isManager ? `analytics:dashboard:region:${managerRegion || 'unknown'}` : 'analytics:dashboard:global';
        const cached = await cacheGet(cacheKey);
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        // Fetch real data from database
        const [
            farmersCount,
            officersCount,
            activeConversations,
            recentVisits,
            avgSatisfactionResult,
            resolvedQueries
        ] = await Promise.all([
            getFromDB(
                isOfficer 
                ? "SELECT COUNT(*) as count FROM farmers WHERE is_active = true AND assigned_officer_id = $1" 
                : isManager
                ? "SELECT COUNT(*) as count FROM farmers WHERE is_active = true AND region = $1"
                : "SELECT COUNT(*) as count FROM farmers WHERE is_active = true",
                isOfficer ? [officerId] : isManager ? [managerRegion] : []
            ),
            getFromDB("SELECT COUNT(*) as count FROM users WHERE role = 'extension_officer' AND is_active = true"),
            getFromDB(
                isOfficer
                ? "SELECT COUNT(*) as count FROM chat_conversations WHERE status = 'active' AND officer_id = $1"
                : isManager
                ? "SELECT COUNT(*) as count FROM chat_conversations c JOIN farmers f ON f.id = c.farmer_id WHERE c.status = 'active' AND f.region = $1"
                : "SELECT COUNT(*) as count FROM chat_conversations WHERE status = 'active'",
                isOfficer ? [officerId] : isManager ? [managerRegion] : []
            ),
            getFromDB(
                isOfficer
                ? "SELECT COUNT(*) as count FROM visits WHERE created_at > NOW() - INTERVAL '30 days' AND officer_id = $1"
                : isManager
                ? "SELECT COUNT(*) as count FROM visits v JOIN farmers f ON f.id = v.farmer_id WHERE v.created_at > NOW() - INTERVAL '30 days' AND f.region = $1"
                : "SELECT COUNT(*) as count FROM visits WHERE created_at > NOW() - INTERVAL '30 days'",
                isOfficer ? [officerId] : isManager ? [managerRegion] : []
            ),
            getFromDB(
                isOfficer
                ? "SELECT AVG(satisfaction_score) as avg FROM chat_conversations WHERE satisfaction_score IS NOT NULL AND officer_id = $1"
                : isManager
                ? "SELECT AVG(satisfaction_score) as avg FROM chat_conversations c JOIN farmers f ON f.id = c.farmer_id WHERE c.satisfaction_score IS NOT NULL AND f.region = $1"
                : "SELECT AVG(satisfaction_score) as avg FROM chat_conversations WHERE satisfaction_score IS NOT NULL",
                isOfficer ? [officerId] : isManager ? [managerRegion] : []
            ),
            getFromDB(
                isOfficer
                ? "SELECT COUNT(*) as count FROM chat_conversations WHERE status = 'resolved' AND officer_id = $1"
                : isManager
                ? "SELECT COUNT(*) as count FROM chat_conversations c JOIN farmers f ON f.id = c.farmer_id WHERE c.status = 'resolved' AND f.region = $1"
                : "SELECT COUNT(*) as count FROM chat_conversations WHERE status = 'resolved'",
                isOfficer ? [officerId] : isManager ? [managerRegion] : []
            )
        ]);

        const currentFarmers = parseInt((farmersCount[0] as any)?.count || '0');

        // Return real empty state when database is empty — no mock fallback

        // Get regional data
        const geography = await getFromDB(`
            SELECT f.region, 
                   COUNT(DISTINCT f.id) as farmers, 
                   COUNT(DISTINCT u.id) as officers 
            FROM farmers f 
            LEFT JOIN users u ON u.region = f.region AND u.role = 'extension_officer' 
            ${isOfficer ? 'WHERE f.assigned_officer_id = $1' : isManager ? 'WHERE f.region = $1' : ''}
            GROUP BY f.region
            ORDER BY farmers DESC
            LIMIT 10
        `, isOfficer ? [officerId] : isManager ? [managerRegion] : []);

        // Get crop distribution
        const cropsData = await getFromDB(`
            SELECT unnest(crops) as crop, COUNT(*) as count 
            FROM farmers 
            WHERE crops IS NOT NULL ${isOfficer ? 'AND assigned_officer_id = $1' : isManager ? 'AND region = $1' : ''}
            GROUP BY crop 
            ORDER BY count DESC
        `, isOfficer ? [officerId] : isManager ? [managerRegion] : []);

        // Calculate crop percentages
        const totalCropCount = cropsData.reduce((sum: number, row: Record<string, unknown>) => sum + parseInt(row.count as string), 0);
        const top5Crops = cropsData.slice(0, 5).map((row: Record<string, unknown>) => ({
            name: row.crop as string,
            percentage: totalCropCount > 0 ? Math.round((parseInt(row.count as string) / totalCropCount) * 100) : 0
        }));

        // Get recent activity from visits and conversations
        const recentActivity = await getFromDB(`
            (SELECT 'visit' as type, 
                    'Visit completed in ' || COALESCE(f.village, f.region) as description,
                    NOW() - v.created_at as time_diff
             FROM visits v
             JOIN farmers f ON f.id = v.farmer_id
             WHERE v.status = 'completed' ${isOfficer ? 'AND v.officer_id = $1' : ''}
             ORDER BY v.completed_at DESC
             LIMIT 3)
            UNION ALL
            (SELECT 'query' as type,
                    'New query from ' || f.first_name || ' ' || f.last_name as description,
                    NOW() - c.started_at as time_diff
             FROM chat_conversations c
             JOIN farmers f ON f.id = c.farmer_id
             WHERE 1=1 ${isOfficer ? 'AND c.officer_id = $1' : ''}
             ORDER BY c.started_at DESC
             LIMIT 2)
            ORDER BY time_diff
            LIMIT 5
        `, isOfficer ? [officerId] : []);

        // Get trends (comparing to last month)
        const [
            lastMonthFarmers,
            lastMonthConversations,
            lastMonthVisits,
            lastMonthSatisfactionResult
        ] = await Promise.all([
            getFromDB(
                isOfficer
                ? "SELECT COUNT(*) as count FROM farmers WHERE created_at > NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days' AND assigned_officer_id = $1"
                : "SELECT COUNT(*) as count FROM farmers WHERE created_at > NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days'",
                isOfficer ? [officerId] : []
            ),
            getFromDB(
                isOfficer
                ? "SELECT COUNT(*) as count FROM chat_conversations WHERE started_at > NOW() - INTERVAL '60 days' AND started_at < NOW() - INTERVAL '30 days' AND officer_id = $1"
                : "SELECT COUNT(*) as count FROM chat_conversations WHERE started_at > NOW() - INTERVAL '60 days' AND started_at < NOW() - INTERVAL '30 days'",
                isOfficer ? [officerId] : []
            ),
            getFromDB(
                isOfficer
                ? "SELECT COUNT(*) as count FROM visits WHERE created_at > NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days' AND officer_id = $1"
                : "SELECT COUNT(*) as count FROM visits WHERE created_at > NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days'",
                isOfficer ? [officerId] : []
            ),
            getFromDB(
                isOfficer
                ? "SELECT AVG(satisfaction_score) as avg FROM chat_conversations WHERE satisfaction_score IS NOT NULL AND created_at > NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days' AND officer_id = $1"
                : "SELECT AVG(satisfaction_score) as avg FROM chat_conversations WHERE satisfaction_score IS NOT NULL AND created_at > NOW() - INTERVAL '60 days' AND created_at < NOW() - INTERVAL '30 days'",
                isOfficer ? [officerId] : []
            )
        ]);

        const lastFarmers = parseInt((lastMonthFarmers[0] as any)?.count || '0');
        const farmersGrowth = lastFarmers > 0 ? ((currentFarmers - lastFarmers) / lastFarmers * 100) : 0;

        const currentConversations = parseInt((activeConversations[0] as any)?.count || '0');
        const lastConversations = parseInt((lastMonthConversations[0] as any)?.count || '0');
        const conversationsGrowth = lastConversations > 0 ? ((currentConversations - lastConversations) / lastConversations * 100) : 0;

        const currentVisits = parseInt((recentVisits[0] as any)?.count || '0');
        const lastVisits = parseInt((lastMonthVisits[0] as any)?.count || '0');
        const visitsGrowth = lastVisits > 0 ? ((currentVisits - lastVisits) / lastVisits * 100) : 0;

        const currentSatisfaction = parseFloat((avgSatisfactionResult[0] as any)?.avg || '0');
        const lastSatisfaction = parseFloat((lastMonthSatisfactionResult[0] as any)?.avg || '0');
        const satisfactionChange = lastSatisfaction > 0 ? (currentSatisfaction - lastSatisfaction) : 0;

        // Build response with real data
        const priorityQueueData = await getFromDB(`
            SELECT f.id as farmer_id, 
                    f.first_name || ' ' || f.last_name as name,
                    'Scheduled consultation' as reason,
                    'medium' as severity,
                    f.crops[1] as crop
            FROM farmers f
            JOIN visits v ON v.farmer_id = f.id
            WHERE v.status = 'scheduled'
            ORDER BY v.scheduled_at ASC
            LIMIT 5
        `);

        const dashboard = {
            overview: {
                totalFarmers: currentFarmers,
                totalOfficers: parseInt((officersCount[0] as any)?.count || '0'),
                activeConversations: currentConversations,
                visitsThisMonth: currentVisits,
                avgSatisfaction: Math.round(currentSatisfaction * 10) / 10,
                queriesResolved: parseInt((resolvedQueries[0] as any)?.count || '0'),
                avgConversationsPerFarmer: currentFarmers > 0 ? Math.round((currentConversations / currentFarmers) * 10) / 10 : 0
            },
            trends: {
                farmersGrowth: Math.round(farmersGrowth * 10) / 10,
                conversationsGrowth: Math.round(conversationsGrowth * 10) / 10,
                visitsGrowth: Math.round(visitsGrowth * 10) / 10,
                satisfactionChange: Math.round(satisfactionChange * 10) / 10,
            },
            geography: geography.map((row: Record<string, unknown>) => ({
                region: (row.region as string) || 'Unknown',
                farmers: parseInt(row.farmers as string) || 0,
                officers: parseInt(row.officers as string) || 0,
            })),
            priorityQueue: priorityQueueData.map((row: Record<string, unknown>) => ({
                farmerId: row.farmer_id as string,
                name: row.name as string,
                reason: row.reason as string,
                severity: row.severity as string,
                crop: row.crop as string
            })),
            crops: top5Crops,
            recentActivity: recentActivity || []
        };

        // Cache for 5 minutes
        await cacheSet(cacheKey, JSON.stringify({ success: true, data: dashboard }), 300);

        res.json({ success: true, data: dashboard });
    } catch (error) {
        logger.error('Dashboard analytics error:', error);
        safeError(res, 500, 'Failed to fetch dashboard data');
    }
});

// Farmer-specific stats for their mobile/personal dashboard
router.get('/farmer-stats', async (req: Request, res: Response) => {
    try {
        const { userId } = req.user as any;
        
        const farmerResult = await getFromDB(`
            SELECT crops, farm_size_hectares, vital_score, yield_history, 
                   soil_moisture, temperature, ph_level, ai_confidence
            FROM farmers 
            WHERE user_id = $1 
            LIMIT 1
        `, [userId]);
        
        if (farmerResult.length === 0) {
            logger.warn(`No farmer profile found for user_id: ${userId}. Providing simulation fallback.`);
            const fallbackData = {
                crops: ['Maize', 'Soybeans'],
                farmSize: 0,
                vitalScore: 0,
                yieldHistory: [],
                soilMoisture: 'N/A',
                avgTemp: 'N/A',
                phLevel: 'N/A',
                aiConfidence: 'N/A',
                nextVisitDate: 'None',
                alertsCount: 0,
                aiTipsCount: 0,
                isSimulated: true
            };
            return res.json({ success: true, data: fallbackData });
        }
        
        const farmer = farmerResult[0];

        // Fetch next visit date
        const nextVisitResult = await getFromDB(`
            SELECT scheduled_at 
            FROM visits 
            WHERE farmer_id = (SELECT id FROM farmers WHERE user_id = $1)
              AND status = 'scheduled'
              AND scheduled_at > NOW()
            ORDER BY scheduled_at ASC
            LIMIT 1
        `, [userId]);

        // Fetch alerts count
        const alertsCountResult = await getFromDB(`
            SELECT COUNT(*) as count 
            FROM alerts 
            WHERE is_active = true 
              AND (affected_farmers @> ARRAY[(SELECT id FROM farmers WHERE user_id = $1)::uuid])
        `, [userId]);

        // Fetch AI tips count (resolved conversations)
        const aiTipsCountResult = await getFromDB(`
            SELECT COUNT(*) as count 
            FROM chat_conversations 
            WHERE farmer_id = (SELECT id FROM farmers WHERE user_id = $1)
              AND status = 'resolved'
        `, [userId]);
        
        res.json({
            success: true,
            data: {
                crops: farmer.crops || [],
                farmSize: farmer.farm_size_hectares || 0,
                vitalScore: farmer.vital_score || 0,
                yieldHistory: farmer.yield_history || [],
                soilMoisture: farmer.soil_moisture ? `${farmer.soil_moisture}%` : 'N/A',
                avgTemp: farmer.temperature ? `${farmer.temperature}°C` : 'N/A',
                phLevel: farmer.ph_level ? `${farmer.ph_level}` : 'N/A',
                aiConfidence: farmer.ai_confidence ? `${farmer.ai_confidence}%` : 'N/A',
                nextVisitDate: nextVisitResult[0]?.scheduled_at || 'None',
                alertsCount: parseInt(alertsCountResult[0]?.count || '0'),
                aiTipsCount: parseInt(aiTipsCountResult[0]?.count || '0')
            }
        });
    } catch (error) {
        logger.error('Farmer stats error:', error);
        safeError(res, 500, 'Failed to fetch farmer stats');
    }
});

// Performance metrics
router.get('/performance', async (req: Request, res: Response) => {
    try {
        const { period = 'month', officerId, region } = req.query;
        const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;

        const cacheKey = `analytics:performance:${period}:${officerId || 'all'}:${region || 'all'}`;
        const cached = await cacheGet(cacheKey);
        if (cached) {
            return res.json(JSON.parse(cached));
        }

        // Get performance metrics from database
        const [
            responseTimeResult,
            resolutionResult,
            satisfactionResult,
            followUpResult,
            fcrResult,
            timelineData,
            officerData
        ] = await Promise.all([
            getFromDB(`
                SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60) as avg_minutes
                FROM visits 
                WHERE status = 'completed' AND started_at > NOW() - INTERVAL '${days} days'
            `),
            getFromDB(`
                SELECT COUNT(*) as total,
                       COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved
                FROM chat_conversations 
                WHERE started_at > NOW() - INTERVAL '${days} days'
            `),
            getFromDB(`
                SELECT AVG(satisfaction_score) as avg
                FROM chat_conversations 
                WHERE satisfaction_score IS NOT NULL 
                AND created_at > NOW() - INTERVAL '${days} days'
            `),
            getFromDB(`
                SELECT COUNT(*) as count
                FROM visits 
                WHERE follow_up_required = true 
                AND created_at > NOW() - INTERVAL '${days} days'
            `),
            getFromDB(`
                SELECT COUNT(*) as count
                FROM chat_conversations 
                WHERE status = 'resolved' 
                AND started_at > NOW() - INTERVAL '${days} days'
            `),
            getFromDB(`
                SELECT DATE(created_at) as date,
                       COUNT(*) FILTER (WHERE status = 'completed') as visits,
                       COUNT(*) FILTER (WHERE type = 'query') as queries
                FROM (
                    SELECT created_at, 'visit' as type, status FROM visits
                    UNION ALL
                    SELECT started_at, 'query', status FROM chat_conversations
                ) combined
                WHERE created_at > NOW() - INTERVAL '${days} days'
                GROUP BY DATE(created_at)
                ORDER BY date
            `),
            getFromDB(`
                SELECT u.id as officer_id, 
                       u.first_name || ' ' || u.last_name as name,
                       COUNT(v.id) as visits,
                       COUNT(c.id) as queries,
                       AVG(c.satisfaction_score) as satisfaction
                FROM users u
                LEFT JOIN visits v ON v.officer_id = u.id AND v.status = 'completed' AND v.created_at > NOW() - INTERVAL '${days} days'
                LEFT JOIN chat_conversations c ON c.officer_id = u.id AND c.created_at > NOW() - INTERVAL '${days} days'
                WHERE u.role = 'extension_officer' AND u.is_active = true
                GROUP BY u.id, u.first_name, u.last_name
                ORDER BY visits DESC
                LIMIT 10
            `)
        ]);

        const totalConversations = parseInt((resolutionResult[0]?.total as string) || '0');
        const resolvedConversations = parseInt((resolutionResult[0]?.resolved as string) || '0');

        const performance = {
            metrics: {
                avgResponseTime: Math.round(parseFloat(responseTimeResult[0]?.avg_minutes || '0') * 10) / 10,
                resolutionRate: totalConversations > 0 ? Math.round((resolvedConversations / totalConversations) * 100) : 0,
                satisfactionScore: Math.round(parseFloat((satisfactionResult[0]?.avg as string) || '0') * 10) / 10,
                followUpRate: Math.round(parseInt((followUpResult[0]?.count as string) || '0') / days * 100),
                firstContactResolution: Math.round(parseInt((fcrResult[0]?.count as string) || '0') / (totalConversations || 1) * 100),
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            timeline: timelineData.length > 0 ? timelineData.map((row: any) => ({
                date: row.date,
                visits: parseInt(row.visits) || 0,
                queries: parseInt(row.queries) || 0,
                satisfaction: 0, 
            })) : [],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            byOfficer: officerData.length > 0 ? officerData.map((row: any) => ({
                officerId: row.officer_id,
                name: row.name,
                visits: parseInt(row.visits) || 0,
                queries: parseInt(row.queries) || 0,
                satisfaction: Math.round(parseFloat(row.satisfaction || '0') * 10) / 10 || 0,
            })) : [],
        };

        await cacheSet(cacheKey, JSON.stringify({ success: true, data: performance }), 300);

        res.json({ success: true, data: performance });
    } catch (error) {
        logger.error('Performance analytics error:', error);
        safeError(res, 500, 'Failed to fetch performance data');
    }
});

// Query analytics
router.get('/queries', async (req: Request, res: Response) => {
    try {
        const { period = 'month' } = req.query;
        const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;

        const [
            totalQueries,
            resolvedQueries,
            pendingQueries,
            categoryData,
            languageData,
            avgResolutionTime,
            topKeywords
        ] = await Promise.all([
            getFromDB(`SELECT COUNT(*) as count FROM chat_conversations WHERE started_at > NOW() - INTERVAL '${days} days'`),
            getFromDB(`SELECT COUNT(*) as count FROM chat_conversations WHERE status = 'resolved' AND started_at > NOW() - INTERVAL '${days} days'`),
            getFromDB(`SELECT COUNT(*) as count FROM chat_conversations WHERE status = 'pending' AND started_at > NOW() - INTERVAL '${days} days'`),
            getFromDB(`
                SELECT COALESCE(c.category, 'Other') as name, COUNT(*) as count
                FROM chat_conversations c
                WHERE c.started_at > NOW() - INTERVAL '${days} days'
                GROUP BY c.category
                ORDER BY count DESC
            `),
            getFromDB(`
                SELECT language, COUNT(*) as count
                FROM chat_conversations
                WHERE started_at > NOW() - INTERVAL '${days} days'
                GROUP BY language
                ORDER BY count DESC
            `),
            getFromDB(`
                SELECT AVG(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60) as avg_minutes
                FROM chat_conversations 
                WHERE status = 'resolved' AND ended_at IS NOT NULL AND started_at > NOW() - INTERVAL '${days} days'
            `),
            getFromDB(`
                SELECT LOWER(content) as keyword, COUNT(*) as count
                FROM chat_messages
                WHERE role = 'farmer' AND created_at > NOW() - INTERVAL '${days} days'
                GROUP BY LOWER(content)
                ORDER BY count DESC
                LIMIT 10
            `)
        ]);

        const total = parseInt((totalQueries[0]?.count as string) || '0');

        const queries = {
            total,
            resolved: parseInt((resolvedQueries[0]?.count as string) || '0'),
            pending: parseInt((pendingQueries[0]?.count as string) || '0'),
            categories: categoryData.map((row: Record<string, unknown>) => ({
                name: row.name as string,
                count: parseInt(row.count as string),
                percentage: total > 0 ? Math.round((parseInt(row.count as string) / total) * 100) : 0
            })),
            languages: languageData.map((row: Record<string, unknown>) => ({
                name: row.name as string || 'en',
                count: parseInt(row.count as string),
                percentage: total > 0 ? Math.round((parseInt(row.count as string) / total) * 100) : 0
            })),
            avgResolutionTime: Math.round(parseFloat(avgResolutionTime[0]?.avg_minutes || '0') * 10) / 10 || 0,
            topKeywords: topKeywords.map((k: any) => k.keyword),
        };

        res.json({ success: true, data: queries });
    } catch (error) {
        logger.error('Query analytics error:', error);
        safeError(res, 500, 'Failed to fetch query analytics');
    }
});

// Chatbot metrics
router.get('/chatbot', async (req: Request, res: Response) => {
    try {
        const { period = 'month' } = req.query;
        const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;

        const [
            conversations,
            languageData,
            engagementMetrics,
            responseMetrics
        ] = await Promise.all([
            getFromDB(`
                SELECT 
                    COUNT(*) as total,
                    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as completed,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
                    COUNT(CASE WHEN status = 'abandoned' THEN 1 END) as abandoned,
                    COUNT(CASE WHEN officer_id IS NOT NULL THEN 1 END) as escalated
                FROM chat_conversations
                WHERE started_at > NOW() - INTERVAL '${days} days'
            `),
            getFromDB(`
                SELECT language, COUNT(*) as count
                FROM chat_conversations
                WHERE started_at > NOW() - INTERVAL '${days} days'
                GROUP BY language
                ORDER BY count DESC
            `),
            getFromDB(`
                SELECT 
                    AVG(msg_count) as avg_messages,
                    COUNT(CASE WHEN is_voice = true THEN 1 END) as voice_usage,
                    COUNT(CASE WHEN is_voice = false THEN 1 END) as text_usage
                FROM (
                    SELECT c.id, 
                           COUNT(m.id) as msg_count,
                           bool_or(m.is_voice) as is_voice
                    FROM chat_conversations c
                    LEFT JOIN chat_messages m ON m.conversation_id = c.id
                    WHERE c.started_at > NOW() - INTERVAL '${days} days'
                    GROUP BY c.id
                ) stats
            `),
            getFromDB(`
                SELECT 
                    AVG(EXTRACT(EPOCH FROM (first_reply - started_at))) as avg_first_response,
                    AVG(EXTRACT(EPOCH FROM (ended_at - started_at))) as avg_resolution
                FROM (
                    SELECT c.id, c.started_at, c.ended_at,
                           (SELECT MIN(created_at) FROM chat_messages WHERE conversation_id = c.id AND role IN ('assistant', 'officer')) as first_reply
                    FROM chat_conversations c
                    WHERE c.status = 'resolved' AND c.started_at > NOW() - INTERVAL '${days} days'
                ) reply_stats
                WHERE first_reply IS NOT NULL
            `)
        ]);

        const total = parseInt((conversations[0]?.total as string) || '1');
        const engagement = engagementMetrics[0] || {};
        const response = responseMetrics[0] || {};

        const chatbot = {
            conversations: {
                total: parseInt((conversations[0]?.total as string) || '0'),
                completed: parseInt((conversations[0]?.completed as string) || '0'),
                active: parseInt((conversations[0]?.active as string) || '0'),
                abandoned: parseInt((conversations[0]?.abandoned as string) || '0'),
            },
            engagement: {
                avgMessagesPerConversation: Math.round(parseFloat(engagement.avg_messages || '0') * 10) / 10,
                voiceUsage: parseInt(engagement.voice_usage || '0'),
                textUsage: parseInt(engagement.text_usage || '0'),
            },
            responseMetrics: {
                avgFirstResponseTime: Math.round(parseFloat(response.avg_first_response || '0') / 60 * 10) / 10, // in minutes
                avgResolutionTime: Math.round(parseFloat(response.avg_resolution || '0') / 60 * 10) / 10, // in minutes
                escalationRate: Math.round((parseInt(conversations[0]?.escalated || '0') / total) * 100),
            },
            languages: languageData.map((row: any) => ({
                language: row.language || 'en',
                count: parseInt(row.count),
                percentage: total > 0 ? Math.round((parseInt(row.count) / total) * 100) : 0
            })),
        };

        res.json({ success: true, data: chatbot });
    } catch (error) {
        logger.error('Chatbot analytics error:', error);
        safeError(res, 500, 'Failed to fetch chatbot analytics');
    }
});

export default router;
