import { Router, Response } from 'express';
import { query, getPool } from '@/services/databaseService';
import type {
  ReportListRow,
  VisitStatsRow,
  ConversationStatsRow,
} from '@/types/rowTypes';
import {
  mapReportListRow,
  mapVisitStatsRow,
  mapConversationStatsRow,
  type VisitStatsDTO,
  type ConversationStatsDTO,
} from '@/types/dtos';
import { logger } from '@/utils/logger';
import { AuthRequest } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { usageService } from '../../services/usageService';
import { safeError } from '@/utils/safeResponse';

const router = Router();

interface ReportContent {
  visits?: VisitStatsDTO;
  conversations?: ConversationStatsDTO;
  metadata?: {
    region?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    officerId?: string | null;
    cropType?: string | null;
  };
  // Disease diagnosis fields
  overallHealth?: 'healthy' | 'stressed' | 'diseased' | 'unknown';
  confidence?: number;
  reviewStatus?: 'ready' | 'needs_expert_review';
  provenance?: {
    evidenceStatus: 'verified_source' | 'no_verified_source';
    source: string;
    sourceUrl: string | null;
    sourceTimestamp: string | null;
    provider: string | null;
    model: string | null;
    generatedAt: string;
  };
  diseases?: Array<{
    disease: string;
    severity?: string;
    confidence?: number;
    reviewStatus?: 'ready' | 'needs_expert_review';
    provenance?: ReportContent['provenance'];
    description?: string;
    symptoms?: string[];
    treatment?: string[];
  }>;
  nutrientDeficiencies?: string[];
  recommendations?: string[];
  // Soil diagnostic fields
  overallHealthScore?: number | null;
  texture?: string;
  estimatedMoisture?: string;
  drainageClass?: string;
  colorDiscoloration?: string;
  npkDeficiencies?: {
    nitrogen?: string;
    phosphorus?: string;
    potassium?: string;
  };
  cropSuitability?: string[];
}

async function generateReportData(type: string, effectiveStartDate: string, effectiveEndDate: string, officerId: string | undefined, region: string | undefined, title: string | undefined, req: AuthRequest, res: Response) {
    const reportData: Partial<ReportContent> = {};
    if (type === 'visit_summary' || type === 'activity_report') {
        const visitResult = await query<VisitStatsRow>(`
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                   SUM(duration_minutes) as total_minutes
            FROM visits
            WHERE scheduled_at >= $1 AND scheduled_at <= $2
            ${officerId ? 'AND officer_id = $3' : ''}
        `, [effectiveStartDate, effectiveEndDate, officerId].filter(Boolean));

        if (visitResult.rows[0]) {
            reportData.visits = mapVisitStatsRow(visitResult.rows[0]);
        }
    }

    if (type === 'impact_metrics' || type === 'activity_report') {
        const convResult = await query<ConversationStatsRow>(`
            SELECT COUNT(*) as total_conversations,
                   SUM(CASE WHEN satisfaction_score IS NOT NULL THEN 1 ELSE 0 END) as rated,
                   AVG(satisfaction_score) as avg_satisfaction
            FROM conversations
            WHERE created_at >= $1 AND created_at <= $2
        `, [effectiveStartDate, effectiveEndDate]);

        if (convResult.rows[0]) {
            reportData.conversations = mapConversationStatsRow(convResult.rows[0]);
        }
    }

    const reportTitle = title || `${type.replace('_', ' ')} - ${new Date(effectiveStartDate).toLocaleDateString()} to ${new Date(effectiveEndDate).toLocaleDateString()}`;

    // Combine all metadata into the content JSONB column as per schema
    const fullReportContent: ReportContent = {
        ...reportData,
        metadata: {
            region,
            startDate: effectiveStartDate,
            endDate: effectiveEndDate,
            officerId
        }
    };

    const reportAuthorId = officerId || req.user!.userId;
    const authorTenant = await query<{ tenant_id: string | null }>(
        'SELECT tenant_id FROM users WHERE id = $1 LIMIT 1',
        [reportAuthorId]
    );
    const result = await query<ReportListRow>(`
        INSERT INTO reports (type, title, generated_by, content, status, tenant_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, 'completed', $5, NOW(), NOW())
        RETURNING *
    `, [type, reportTitle, reportAuthorId, JSON.stringify(fullReportContent), authorTenant.rows[0]?.tenant_id ?? null]);

    await usageService.incrementUsage(req.user!.userId, 'report');

    const created = result.rows[0] ? mapReportListRow(result.rows[0]) : null;
    // Flatten the response: fullReportContent fields (visits, conversations,
    // metadata, plus disease/soil diagnostics) live at `data.*` alongside
    // the DTO metadata, rather than nested under `data.data.*`.
    // DTO fields are spread LAST so they win on any future key collision
    // with ReportContent (e.g. if a future schema adds a `metadata.id`).
    return res.status(201).json({
        success: true,
        data: {
            ...fullReportContent,
            id: created?.id,
            type: created?.type,
            title: created?.title,
            generatedAt: created?.generatedAt,
            status: created?.status,
        },
    });
}

// Generate report
router.post('/generate', checkUsageLimit('report'), async (req: AuthRequest, res: Response) => {
    try {
        const { type, startDate, endDate, officerId, region, title } = req.body;
        const pool = getPool();

        if (!pool) {
            return res.status(503).json({ success: false, error: 'Database connection unavailable' });
        }

        // Use default date range if not provided (last 30 days)
        const effectiveStartDate = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const effectiveEndDate = endDate || new Date().toISOString();

        await generateReportData(type, effectiveStartDate, effectiveEndDate, officerId, region, title, req, res);
    } catch (error) {
        logger.error('Generate report error:', error);
        safeError(res, 500, 'Failed to generate report');
    }
});

export default router;
