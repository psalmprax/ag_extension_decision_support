/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { query, getPool } from '@/services/databaseService';
import { cacheGet, cacheSet } from '@/services/cacheService';
import { logger } from '@/utils/logger';
import { authorize } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';
import { getPrincipalTenantId } from '@/services/dataGovernanceService';

const router = Router();

const PERCENTAGE_MULTIPLIER = 100;

// Apply authentication to all analytics routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

// Helper to safely execute database queries with fallback
async function getFromDB(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
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

function parseIntCount(rows: Record<string, unknown>[]): number {
    return parseInt((rows[0] as Record<string, unknown>)?.count as string || '0');
}

function computeGrowth(current: number, previous: number): number {
    return previous > 0 ? ((current - previous) / previous * PERCENTAGE_MULTIPLIER) : 0;
}

const EMPTY_TENANT_ID = '00000000-0000-0000-0000-000000000000';

async function getAnalyticsTenantId(req: Request): Promise<string | null> {
    if (process.env.NODE_ENV === 'test') return null;
    return req.user?.userId ? getPrincipalTenantId(req.user.userId) : null;
}

async function getSafeAnalyticsTenantId(req: Request): Promise<string> {
    const tenantId = await getAnalyticsTenantId(req);
    return tenantId || EMPTY_TENANT_ID;
}

function tenantPredicate(tenantId: string | null, alias: string): string {
    if (!tenantId) return '';
    if (!/^[0-9a-f-]{36}$/i.test(tenantId)) return ' AND 1 = 0';
    if (alias === 'f' || alias === 'u') return ` AND ${alias}.tenant_id = '${tenantId}'`;
    return ` AND EXISTS (SELECT 1 FROM farmers scoped_f WHERE scoped_f.id = ${alias}.farmer_id AND scoped_f.tenant_id = '${tenantId}')`;
}

interface UserScope {
    isOfficer: boolean;
    isManager: boolean;
    officerId: string | null;
    managerRegion: string | null;
    tenantId: string | null;
}

function tenantFilter(user: UserScope, alias: string): string {
    if (!user.tenantId) return '';
    if (!/^[0-9a-f-]{36}$/i.test(user.tenantId)) return ' AND 1 = 0';
    if (alias === 'f') return ` AND f.tenant_id = '${user.tenantId}'`;
    return ` AND EXISTS (SELECT 1 FROM farmers scoped_f WHERE scoped_f.id = ${alias}.farmer_id AND scoped_f.tenant_id = '${user.tenantId}')`;
}

function buildScopeFilter(user: UserScope, column = 'assigned_officer_id', alias = 'f'): { whereClause: string; params: unknown[] } {
    const tenantClause = tenantFilter(user, alias);
    if (user.isOfficer) {
        return { whereClause: `AND ${alias}.${column} = $1${tenantClause}`, params: [user.officerId] };
    }
    if (user.isManager) {
        const regionClause = alias === 'f'
            ? 'AND f.region = $1'
            : `AND EXISTS (SELECT 1 FROM farmers scoped_region WHERE scoped_region.id = ${alias}.farmer_id AND scoped_region.region = $1)`;
        return { whereClause: `${regionClause}${tenantClause}`, params: [user.managerRegion] };
    }
    return { whereClause: tenantClause, params: [] };
}

function buildCacheKey(user: UserScope): string {
    const tenant = user.tenantId || 'legacy';
    if (user.isOfficer) return `analytics:dashboard:${tenant}:${user.officerId}`;
    if (user.isManager) return `analytics:dashboard:${tenant}:region:${user.managerRegion || 'unknown'}`;
    return `analytics:dashboard:${tenant}:global`;
}

async function fetchOverviewCounts(user: UserScope) {
    const farmerScope = buildScopeFilter(user, 'assigned_officer_id', 'f');
    const visitScope = buildScopeFilter(user, 'officer_id', 'v');
    const conversationScope = buildScopeFilter(user, 'officer_id', 'c');
    const [farmersCount, officersCount, activeConversations, recentVisits, avgSatisfactionResult, resolvedQueries] = await Promise.all([
        getFromDB(`SELECT COUNT(*) as count FROM farmers f WHERE f.is_active = true ${farmerScope.whereClause}`, farmerScope.params),
        getFromDB(`SELECT COUNT(*) as count FROM users u WHERE u.role = 'extension_officer' AND u.is_active = true${user.tenantId ? ` AND u.tenant_id = '${user.tenantId}'` : ''}`),
        getFromDB(`SELECT COUNT(*) as count FROM chat_conversations c WHERE c.status = 'active' ${conversationScope.whereClause}`, conversationScope.params),
        getFromDB(`SELECT COUNT(*) as count FROM visits v WHERE v.created_at > NOW() - INTERVAL '30 days' ${visitScope.whereClause}`, visitScope.params),
        getFromDB(`SELECT AVG(c.satisfaction_score) as avg FROM chat_conversations c WHERE c.satisfaction_score IS NOT NULL ${conversationScope.whereClause}`, conversationScope.params),
        getFromDB(`SELECT COUNT(*) as count FROM chat_conversations c WHERE c.status = 'resolved' ${conversationScope.whereClause}`, conversationScope.params),
    ]);
    return { farmersCount, officersCount, activeConversations, recentVisits, avgSatisfactionResult, resolvedQueries };
}

async function fetchGeography(user: UserScope) {
    const sf = buildScopeFilter(user, 'assigned_officer_id', 'f');
    return getFromDB(`
        SELECT f.region, COUNT(DISTINCT f.id) as farmers, COUNT(DISTINCT u.id) as officers 
        FROM farmers f 
        LEFT JOIN users u ON u.region = f.region AND u.role = 'extension_officer' 
        WHERE 1=1 ${sf.whereClause}
        GROUP BY f.region ORDER BY farmers DESC LIMIT 10
    `, sf.params);
}

async function fetchCropDistribution(user: UserScope) {
    const sf = buildScopeFilter(user, 'assigned_officer_id', 'f');
    const cropsData = await getFromDB(`
        SELECT unnest(crops) as crop, COUNT(*) as count 
        FROM farmers f WHERE f.crops IS NOT NULL ${sf.whereClause}
        GROUP BY crop ORDER BY count DESC
    `, sf.params);
    const totalCropCount = cropsData.reduce((sum: number, row: Record<string, unknown>) => sum + parseInt(row.count as string), 0);
    return cropsData.slice(0, 5).map((row: Record<string, unknown>) => ({
        name: row.crop as string,
        percentage: totalCropCount > 0 ? Math.round((parseInt(row.count as string) / totalCropCount) * PERCENTAGE_MULTIPLIER) : 0
    }));
}

async function fetchRecentActivity(user: UserScope) {
    const visitScope = buildScopeFilter(user, 'officer_id', 'v');
    const conversationScope = buildScopeFilter(user, 'officer_id', 'c');
    return getFromDB(`
        (SELECT 'visit' as type, 'Visit completed in ' || COALESCE(f.village, f.region) as description, NOW() - v.created_at as time_diff
         FROM visits v JOIN farmers f ON f.id = v.farmer_id
         WHERE v.status = 'completed' ${visitScope.whereClause}
         ORDER BY v.completed_at DESC LIMIT 3)
        UNION ALL
        (SELECT 'query' as type, 'New query from ' || f.first_name || ' ' || f.last_name as description, NOW() - c.started_at as time_diff
         FROM chat_conversations c JOIN farmers f ON f.id = c.farmer_id
         WHERE 1=1 ${conversationScope.whereClause}
         ORDER BY c.started_at DESC LIMIT 2)
        ORDER BY time_diff LIMIT 5
    `, visitScope.params.length > 0 ? visitScope.params : conversationScope.params);
}

async function fetchTrendData(user: UserScope) {
    const farmerScope = buildScopeFilter(user, 'assigned_officer_id', 'f');
    const conversationScope = buildScopeFilter(user, 'officer_id', 'c');
    const visitScope = buildScopeFilter(user, 'officer_id', 'v');
    const [lastMonthFarmers, lastMonthConversations, lastMonthVisits, lastMonthSatisfactionResult] = await Promise.all([
        getFromDB(`SELECT COUNT(*) as count FROM farmers f WHERE f.created_at > NOW() - INTERVAL '60 days' AND f.created_at < NOW() - INTERVAL '30 days' ${farmerScope.whereClause}`, farmerScope.params),
        getFromDB(`SELECT COUNT(*) as count FROM chat_conversations c WHERE c.started_at > NOW() - INTERVAL '60 days' AND c.started_at < NOW() - INTERVAL '30 days' ${conversationScope.whereClause}`, conversationScope.params),
        getFromDB(`SELECT COUNT(*) as count FROM visits v WHERE v.created_at > NOW() - INTERVAL '60 days' AND v.created_at < NOW() - INTERVAL '30 days' ${visitScope.whereClause}`, visitScope.params),
        getFromDB(`SELECT AVG(c.satisfaction_score) as avg FROM chat_conversations c WHERE c.satisfaction_score IS NOT NULL AND c.created_at > NOW() - INTERVAL '60 days' AND c.created_at < NOW() - INTERVAL '30 days' ${conversationScope.whereClause}`, conversationScope.params),
    ]);
    return { lastMonthFarmers, lastMonthConversations, lastMonthVisits, lastMonthSatisfactionResult };
}

async function fetchPriorityQueue(user: UserScope) {
    const scope = buildScopeFilter(user, 'assigned_officer_id', 'f');
    return getFromDB(`
        SELECT f.id as farmer_id, f.first_name || ' ' || f.last_name as name,
            'Scheduled consultation' as reason, 'medium' as severity, f.crops[1] as crop
        FROM farmers f JOIN visits v ON v.farmer_id = f.id
        WHERE v.status = 'scheduled' ${scope.whereClause}
        ORDER BY v.scheduled_at ASC LIMIT 5
    `, scope.params);
}

// Dashboard overview - fetches real data from database
router.get('/dashboard', async (req: Request, res: Response) => {
    try {
        const { userId, role } = req.user as Record<string, unknown>;
        const tenantId = await getPrincipalTenantId(String(userId));
        if (!tenantId && process.env.NODE_ENV !== 'test') {
            return res.status(403).json({ success: false, error: 'Tenant membership required' });
        }
        const user: UserScope = {
            isOfficer: role === 'extension_officer',
            isManager: role === 'regional_manager',
            officerId: role === 'extension_officer' ? String(userId) : null,
            managerRegion: null,
            tenantId,
        };

        if (user.isManager) {
            const manager = await getFromDB("SELECT region FROM users WHERE id = $1", [userId]);
            user.managerRegion = manager[0]?.region as string | null;
        }

        const cacheKey = buildCacheKey(user);
        const cached = await cacheGet(cacheKey);
        if (cached) return res.json(JSON.parse(cached));

        const [overviewData, geography, top5Crops, recentActivity, trendData, priorityQueueData] = await Promise.all([
            fetchOverviewCounts(user),
            fetchGeography(user),
            fetchCropDistribution(user),
            fetchRecentActivity(user),
            fetchTrendData(user),
            fetchPriorityQueue(user),
        ]);

        const { farmersCount, officersCount, activeConversations, recentVisits, avgSatisfactionResult, resolvedQueries } = overviewData;
        const { lastMonthFarmers, lastMonthConversations, lastMonthVisits, lastMonthSatisfactionResult } = trendData;

        const currentFarmers = parseIntCount(farmersCount);
        const currentConversations = parseIntCount(activeConversations);
        const currentVisits = parseIntCount(recentVisits);
        const currentSatisfaction = parseFloat((avgSatisfactionResult[0] as Record<string, unknown>)?.avg as string || '0');

        const dashboard = {
            overview: {
                totalFarmers: currentFarmers,
                totalOfficers: parseIntCount(officersCount),
                activeConversations: currentConversations,
                visitsThisMonth: currentVisits,
                avgSatisfaction: Math.round(currentSatisfaction * 10) / 10,
                queriesResolved: parseIntCount(resolvedQueries),
                avgConversationsPerFarmer: currentFarmers > 0 ? Math.round((currentConversations / currentFarmers) * 10) / 10 : 0
            },
            trends: {
                farmersGrowth: Math.round(computeGrowth(currentFarmers, parseIntCount(lastMonthFarmers)) * 10) / 10,
                conversationsGrowth: Math.round(computeGrowth(currentConversations, parseIntCount(lastMonthConversations)) * 10) / 10,
                visitsGrowth: Math.round(computeGrowth(currentVisits, parseIntCount(lastMonthVisits)) * 10) / 10,
                satisfactionChange: Math.round((currentSatisfaction - parseFloat((lastMonthSatisfactionResult[0] as Record<string, unknown>)?.avg as string || '0')) * 10) / 10,
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
        const { userId } = req.user as Record<string, unknown>;
        const tenantId = await getSafeAnalyticsTenantId(req);
        const tenantClause = ` AND tenant_id = '${tenantId}'`;

        const farmerResult = await getFromDB(`
            SELECT crops, farm_size_hectares, vital_score, yield_history,
                   soil_moisture, temperature, ph_level, ai_confidence
            FROM farmers
            WHERE user_id = $1
              ${tenantClause}
            LIMIT 1
        `, [userId]);
        
        if (farmerResult.length === 0) {
            logger.info(`No farmer profile found for user_id: ${userId}. Returning an honest empty state.`);
            return res.json({
                success: true,
                data: null,
                meta: { state: 'no_profile' },
            });
        }
        
        const farmer = farmerResult[0];

        // Fetch next visit date
        const nextVisitResult = await getFromDB(`
            SELECT scheduled_at 
            FROM visits 
            WHERE farmer_id = (SELECT id FROM farmers WHERE user_id = $1${tenantClause})
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
              AND (affected_farmers @> ARRAY[(SELECT id FROM farmers WHERE user_id = $1${tenantClause})::uuid])
        `, [userId]);

        // Fetch AI tips count (resolved conversations)
        const aiTipsCountResult = await getFromDB(`
            SELECT COUNT(*) as count 
            FROM chat_conversations 
            WHERE farmer_id = (SELECT id FROM farmers WHERE user_id = $1${tenantClause})
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
                alertsCount: parseInt(String(alertsCountResult[0]?.count || '0')),
                aiTipsCount: parseInt(String(aiTipsCountResult[0]?.count || '0'))
            }
        });
    } catch (error) {
        logger.error('Farmer stats error:', error);
        safeError(res, 500, 'Failed to fetch farmer stats');
    }
});

function formatPerformanceMetrics(results: Record<string, unknown>[][], days: number) {
    const [responseTimeResult, resolutionResult, satisfactionResult, followUpResult, fcrResult] = results;
    const totalConversations = parseInt((resolutionResult[0]?.total as string) || '0');
    const resolvedConversations = parseInt((resolutionResult[0]?.resolved as string) || '0');

    return {
        avgResponseTime: Math.round(parseFloat(responseTimeResult[0]?.avg_minutes as string || '0') * 10) / 10,
        resolutionRate: totalConversations > 0 ? Math.round((resolvedConversations / totalConversations) * PERCENTAGE_MULTIPLIER) : 0,
        satisfactionScore: Math.round(parseFloat((satisfactionResult[0]?.avg as string) || '0') * 10) / 10,
        followUpRate: Math.round(parseInt((followUpResult[0]?.count as string) || '0') / days * PERCENTAGE_MULTIPLIER),
        firstContactResolution: Math.round(parseInt((fcrResult[0]?.count as string) || '0') / (totalConversations || 1) * PERCENTAGE_MULTIPLIER),
    };
}

function formatTimelineData(timelineData: Record<string, unknown>[]) {
    return timelineData.length > 0 ? timelineData.map((row: Record<string, unknown>) => ({
        date: row.date,
        visits: parseInt(row.visits as string) || 0,
        queries: parseInt(row.queries as string) || 0,
        satisfaction: 0, 
    })) : [];
}

function formatOfficerData(officerData: Record<string, unknown>[]) {
    return officerData.length > 0 ? officerData.map((row: Record<string, unknown>) => ({
        officerId: row.officer_id,
        name: row.name,
        visits: parseInt(row.visits as string) || 0,
        queries: parseInt(row.queries as string) || 0,
        satisfaction: Math.round(parseFloat(row.satisfaction as string || '0') * 10) / 10 || 0,
    })) : [];
}

// Performance metrics
router.get('/performance', async (req: Request, res: Response) => {
    try {
        const tenantId = await getSafeAnalyticsTenantId(req);
        const { period = 'month', officerId, region } = req.query;
        const visitTenant = tenantPredicate(tenantId, 'v');
        const conversationTenant = tenantPredicate(tenantId, 'c');
        const days = period === 'week' ? 7 : period === 'month' ? 30 : 90;

        const cacheKey = `analytics:performance:${tenantId || 'legacy'}:${period}:${officerId || 'all'}:${region || 'all'}`;
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
                FROM visits v
                WHERE v.status = 'completed' AND v.started_at > NOW() - INTERVAL '${days} days'${visitTenant}
            `),
            getFromDB(`
                SELECT COUNT(*) as total,
                       COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved
                FROM chat_conversations c
                WHERE c.started_at > NOW() - INTERVAL '${days} days'${conversationTenant}
            `),
            getFromDB(`
                SELECT AVG(satisfaction_score) as avg
                FROM chat_conversations c
                WHERE c.satisfaction_score IS NOT NULL
                AND c.created_at > NOW() - INTERVAL '${days} days'${conversationTenant}
            `),
            getFromDB(`
                SELECT COUNT(*) as count
                FROM visits v
                WHERE v.follow_up_required = true
                AND v.created_at > NOW() - INTERVAL '${days} days'${visitTenant}
            `),
            getFromDB(`
                SELECT COUNT(*) as count
                FROM chat_conversations c
                WHERE c.status = 'resolved'
                AND c.started_at > NOW() - INTERVAL '${days} days'${conversationTenant}
            `),
            getFromDB(`
                SELECT DATE(created_at) as date,
                       COUNT(*) FILTER (WHERE status = 'completed') as visits,
                       COUNT(*) FILTER (WHERE type = 'query') as queries
                FROM (
                    SELECT v.created_at, 'visit' as type, v.status FROM visits v WHERE 1 = 1${visitTenant}
                    UNION ALL
                    SELECT c.started_at, 'query', c.status FROM chat_conversations c WHERE 1 = 1${conversationTenant}
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
                WHERE u.role = 'extension_officer' AND u.is_active = true${tenantPredicate(tenantId, 'u')}
                GROUP BY u.id, u.first_name, u.last_name
                ORDER BY visits DESC
                LIMIT 10
            `)
        ]);

        const performance = {
            metrics: formatPerformanceMetrics([responseTimeResult, resolutionResult, satisfactionResult, followUpResult, fcrResult], days),
            timeline: formatTimelineData(timelineData),
            byOfficer: formatOfficerData(officerData),
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
        const tenantId = await getSafeAnalyticsTenantId(req);
        const conversationTenant = tenantPredicate(tenantId, 'c');
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
            getFromDB(`SELECT COUNT(*) as count FROM chat_conversations c WHERE c.started_at > NOW() - INTERVAL '${days} days'${conversationTenant}`),
            getFromDB(`SELECT COUNT(*) as count FROM chat_conversations c WHERE c.status = 'resolved' AND c.started_at > NOW() - INTERVAL '${days} days'${conversationTenant}`),
            getFromDB(`SELECT COUNT(*) as count FROM chat_conversations c WHERE c.status = 'pending' AND c.started_at > NOW() - INTERVAL '${days} days'${conversationTenant}`),
            getFromDB(`
                SELECT COALESCE(c.category, 'Other') as name, COUNT(*) as count
                FROM chat_conversations c
                WHERE c.started_at > NOW() - INTERVAL '${days} days'${conversationTenant}
                GROUP BY c.category
                ORDER BY count DESC
            `),
            getFromDB(`
                SELECT language, COUNT(*) as count
                FROM chat_conversations c
                WHERE c.started_at > NOW() - INTERVAL '${days} days'${conversationTenant}
                GROUP BY language
                ORDER BY count DESC
            `),
            getFromDB(`
                SELECT AVG(EXTRACT(EPOCH FROM (ended_at - started_at)) / 60) as avg_minutes
                FROM chat_conversations c
                WHERE c.status = 'resolved' AND c.ended_at IS NOT NULL AND c.started_at > NOW() - INTERVAL '${days} days'${conversationTenant}
            `),
            getFromDB(`
                SELECT LOWER(m.content) as keyword, COUNT(*) as count
                FROM chat_messages m
                JOIN chat_conversations c ON c.id = m.conversation_id
                WHERE m.role = 'farmer' AND m.created_at > NOW() - INTERVAL '${days} days'${conversationTenant}
                GROUP BY LOWER(m.content)
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
                percentage: total > 0 ? Math.round((parseInt(row.count as string) / total) * PERCENTAGE_MULTIPLIER) : 0
            })),
            languages: languageData.map((row: Record<string, unknown>) => ({
                name: row.name as string || 'en',
                count: parseInt(row.count as string),
                percentage: total > 0 ? Math.round((parseInt(row.count as string) / total) * PERCENTAGE_MULTIPLIER) : 0
            })),
            avgResolutionTime: Math.round(parseFloat(avgResolutionTime[0]?.avg_minutes as string || '0') * 10) / 10 || 0,
            topKeywords: topKeywords.map((k: Record<string, unknown>) => k.keyword),
        };

        res.json({ success: true, data: queries });
    } catch (error) {
        logger.error('Query analytics error:', error);
        safeError(res, 500, 'Failed to fetch query analytics');
    }
});

function formatChatbotConversations(conversations: Record<string, unknown>[]) {
    return {
        total: parseInt((conversations[0]?.total as string) || '0'),
        completed: parseInt((conversations[0]?.completed as string) || '0'),
        active: parseInt((conversations[0]?.active as string) || '0'),
        abandoned: parseInt((conversations[0]?.abandoned as string) || '0'),
    };
}

function formatChatbotEngagement(engagement: Record<string, unknown>) {
    return {
        avgMessagesPerConversation: Math.round(parseFloat(engagement.avg_messages as string || '0') * 10) / 10,
        voiceUsage: parseInt(engagement.voice_usage as string || '0'),
        textUsage: parseInt(engagement.text_usage as string || '0'),
    };
}

function formatChatbotResponseMetrics(response: Record<string, unknown>, conversations: Record<string, unknown>[], total: number) {
    return {
        avgFirstResponseTime: Math.round(parseFloat(response.avg_first_response as string || '0') / 60 * 10) / 10, // in minutes
        avgResolutionTime: Math.round(parseFloat(response.avg_resolution as string || '0') / 60 * 10) / 10, // in minutes
        escalationRate: Math.round((parseInt(conversations[0]?.escalated as string || '0') / total) * PERCENTAGE_MULTIPLIER),
    };
}

function formatChatbotLanguages(languageData: Record<string, unknown>[], total: number) {
    return languageData.map((row: Record<string, unknown>) => ({
        language: row.language || 'en',
        count: parseInt(row.count as string),
        percentage: total > 0 ? Math.round((parseInt(row.count as string) / total) * PERCENTAGE_MULTIPLIER) : 0
    }));
}

// Chatbot metrics
router.get('/chatbot', async (req: Request, res: Response) => {
    try {
        const tenantId = await getSafeAnalyticsTenantId(req);
        const conversationTenant = tenantPredicate(tenantId, 'c');
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
                FROM chat_conversations c
                WHERE c.started_at > NOW() - INTERVAL '${days} days'${conversationTenant}
            `),
            getFromDB(`
                SELECT language, COUNT(*) as count
                FROM chat_conversations c
                WHERE c.started_at > NOW() - INTERVAL '${days} days'${conversationTenant}
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
                    WHERE c.started_at > NOW() - INTERVAL '${days} days'${conversationTenant}
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
                    WHERE c.status = 'resolved' AND c.started_at > NOW() - INTERVAL '${days} days'${conversationTenant}
                ) reply_stats
                WHERE first_reply IS NOT NULL
            `)
        ]);

        const total = parseInt((conversations[0]?.total as string) || '1');
        const engagement = engagementMetrics[0] || {};
        const response = responseMetrics[0] || {};

        const chatbot = {
            conversations: formatChatbotConversations(conversations),
            engagement: formatChatbotEngagement(engagement),
            responseMetrics: formatChatbotResponseMetrics(response, conversations, total),
            languages: formatChatbotLanguages(languageData, total),
        };

        res.json({ success: true, data: chatbot });
    } catch (error) {
        logger.error('Chatbot analytics error:', error);
        safeError(res, 500, 'Failed to fetch chatbot analytics');
    }
});

export default router;
