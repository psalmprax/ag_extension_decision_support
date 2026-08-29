import { Router, Request, Response } from 'express';
import { query, getPool } from '@/services/databaseService';
import type {
  ReportListRow,
  VisitStatsRow,
  ConversationStatsRow,
} from '@/types/rowTypes';
import {
  mapReportListRow,
  mapReportListRows,
  mapVisitStatsRow,
  mapConversationStatsRow,
  type VisitStatsDTO,
  type ConversationStatsDTO,
} from '@/types/dtos';
import { logger } from '@/utils/logger';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { usageService } from '../services/usageService';
import PDFDocument from 'pdfkit';
import type PDFKit from 'pdfkit';
import * as XLSX from 'xlsx';
import { safeError } from '@/utils/safeResponse';
import { getPrincipalTenantId } from '@/services/dataGovernanceService';

const router = Router();

// Apply authentication to all reporting routes
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

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

// Download report as CSV
router.get('/:id/download', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const scope = await getReportScope(req, 2);
        if (!scope) return res.status(403).json({ success: false, error: 'Tenant membership required' });
        const result = await query<ReportListRow>(`SELECT * FROM reports WHERE id = $1${scope.clause}`, [id, ...scope.params]);
        const report: ReportListRow | undefined = result.rows[0];

        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        const data = report.content as ReportContent;
        let csv = 'Metric,Value\n';

        // Flatten the JSON report data into CSV rows
        if (data.visits) {
            csv += `Total Visits,${data.visits.total || 0}\n`;
            csv += `Completed Visits,${data.visits.completed || 0}\n`;
            csv += `Total Minutes,${data.visits.totalMinutes || 0}\n`;
        }
        if (data.conversations) {
            csv += `Total Conversations,${data.conversations.totalConversations || 0}\n`;
            csv += `Average Satisfaction,${data.conversations.avgSatisfaction || 0}\n`;
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="report_${id}.csv"`);
        res.status(200).send(csv);
    } catch (error) {
        logger.error('Download report error:', error);
        safeError(res, 500, 'Failed to download report');
    }
});

function drawDiseaseDiagnosisHeader(doc: PDFKit.PDFDocument, report: ReportListRow, data: ReportContent) {
    // Elegant Dark Green Header
    doc.rect(0, 0, doc.page.width, 110).fill('#1b5e20');

    doc.fillColor('#ffffff')
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('Agricultural Decision-Support System', 50, 30);

    doc.fontSize(13)
       .font('Helvetica')
       .text('Plant Pathology & Leaf Diagnosis Report', 50, 60);

    // Decorative separator
    doc.rect(0, 110, doc.page.width, 5).fill('#81c784');

    doc.y = 135;

    // Report Title & Metadata Section
    doc.fillColor('#1b5e20')
       .fontSize(15)
       .font('Helvetica-Bold')
       .text(report.title || 'Plant Pathology Scan', 50, doc.y);
    doc.moveDown(0.5);

    const crop = data.metadata?.cropType || 'Unspecified Crop';
    const generatedDate = new Date(report.created_at).toLocaleString();

    // Draw Metadata Table
    const startY = doc.y;
    doc.fontSize(9)
       .fillColor('#455a64')
       .font('Helvetica-Bold')
       .text('Target Crop:', 50, startY)
       .font('Helvetica')
       .text(crop.toUpperCase(), 150, startY)
       .font('Helvetica-Bold')
       .text('Analysis Date:', 300, startY)
       .font('Helvetica')
       .text(generatedDate, 400, startY);

    doc.moveDown(1.5);

    // Overall Health Banner
    const health = data.overallHealth || 'healthy';
    let bannerBg = '#e8f5e9';
    let bannerText = '#1b5e20';
    if (health === 'stressed') {
        bannerBg = '#fff3e0';
        bannerText = '#e65100';
    } else if (health === 'diseased') {
        bannerBg = '#ffebee';
        bannerText = '#b71c1c';
    }

    doc.rect(50, doc.y, doc.page.width - 100, 45).fill(bannerBg);

    const bannerY = doc.y + 15;
    doc.fillColor(bannerText)
       .fontSize(11)
       .font('Helvetica-Bold')
       .text(`OVERALL CROP HEALTH STATUS:  ${health.toUpperCase()}`, 70, bannerY);

    if (data.confidence) {
        doc.font('Helvetica')
           .fontSize(9)
           .text(`Confidence Score: ${(data.confidence * 100).toFixed(1)}%`, doc.page.width - 200, bannerY, { align: 'right' });
    }

    doc.y = bannerY + 45;
}

function drawDiseasePathologies(doc: PDFKit.PDFDocument, data: ReportContent) {
    doc.fillColor('#263238')
       .fontSize(13)
       .font('Helvetica-Bold')
       .text('Detected Pathologies & Issues', 50, doc.y);

    doc.moveDown(0.5);

    if (data.diseases && data.diseases.length > 0) {
        data.diseases.forEach((dis, idx) => {
            const disY = doc.y;

            doc.rect(50, disY, doc.page.width - 100, 140).stroke('#cfd8dc');

            doc.fillColor('#b71c1c')
               .fontSize(11)
               .font('Helvetica-Bold')
               .text(`${idx + 1}. ${dis.disease}`, 65, disY + 12);

            doc.fillColor('#455a64')
               .fontSize(9)
               .font('Helvetica-Bold')
               .text(`Severity: ${dis.severity?.toUpperCase() || 'MODERATE'}`, doc.page.width - 250, disY + 12)
               .text(`Confidence: ${dis.confidence}%`, doc.page.width - 150, disY + 12);

            doc.fillColor('#263238')
               .font('Helvetica')
               .fontSize(9)
               .text(dis.description || 'No description provided.', 65, disY + 32, { width: doc.page.width - 130 });

            const listY = disY + 65;
            doc.fillColor('#1b5e20')
               .font('Helvetica-Bold')
               .fontSize(9)
               .text('Observed Symptoms:', 65, listY)
               .text('Recommended Treatments:', 300, listY);

            doc.fillColor('#37474f')
               .font('Helvetica')
               .fontSize(8);

            const symptoms = (dis.symptoms || []).slice(0, 3);
            symptoms.forEach((sym: string, sIdx: number) => {
                doc.text(`• ${sym}`, 65, listY + 15 + (sIdx * 10), { width: 220 });
            });

            const treatments = (dis.treatment || []).slice(0, 3);
            treatments.forEach((treat: string, tIdx: number) => {
                doc.text(`• ${treat}`, 300, listY + 15 + (tIdx * 10), { width: 250 });
            });

            doc.y = disY + 155;
        });
    } else {
        doc.fillColor('#455a64')
           .font('Helvetica-Oblique')
           .fontSize(10)
           .text('No active crop diseases or visual pathogens detected in this sample.', 60, doc.y);
        doc.moveDown(1);
    }
}

function generateDiseaseDiagnosisPDF(doc: PDFKit.PDFDocument, report: ReportListRow, data: ReportContent) {
    drawDiseaseDiagnosisHeader(doc, report, data);
    drawDiseasePathologies(doc, data);

    // Nutrient Deficiencies
    if (data.nutrientDeficiencies && data.nutrientDeficiencies.length > 0) {
        doc.fillColor('#263238')
           .font('Helvetica-Bold')
           .fontSize(12)
           .text('Nutrient & Chemical Observations', 50, doc.y);
        doc.moveDown(0.5);

        data.nutrientDeficiencies.forEach((def: string) => {
            doc.fillColor('#e65100')
               .font('Helvetica-Bold')
               .fontSize(9)
               .text('⚠  POTENTIAL NUTRIENT DEFICIENCY: ', 65, doc.y)
               .font('Helvetica')
               .fillColor('#37474f')
               .text(def, doc.x + 5, doc.y);
            doc.moveDown(0.3);
        });
        doc.moveDown(0.5);
    }

    // General Recommendations
    if (data.recommendations && data.recommendations.length > 0) {
        doc.fillColor('#1b5e20')
           .font('Helvetica-Bold')
           .fontSize(12)
           .text('Agronomic Advisory & Actions', 50, doc.y);
        doc.moveDown(0.5);

        doc.fillColor('#37474f')
           .font('Helvetica')
           .fontSize(9);

        data.recommendations.forEach((rec: string) => {
            doc.text(`✓   ${rec}`, 65, doc.y);
            doc.moveDown(0.4);
        });
    }

    // Footer
    doc.fontSize(8)
       .fillColor('#95a5a6')
       .text('This pathology analysis represents an AI-assisted diagnostic estimate and should be validated through direct agronomic inspection.', 50, doc.page.height - 40, { align: 'center', width: doc.page.width - 100 });
}

function drawSoilDiagnosticHeader(doc: PDFKit.PDFDocument, report: ReportListRow, data: ReportContent) {
    // Elegant Earth Brown Header
    doc.rect(0, 0, doc.page.width, 110).fill('#3e2723');

    doc.fillColor('#ffffff')
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('Agricultural Decision-Support System', 50, 30);

    doc.fontSize(13)
       .font('Helvetica')
       .text('High-Fidelity Soil Diagnostics & Advisory Report', 50, 60);

    // Decorative separator
    doc.rect(0, 110, doc.page.width, 5).fill('#8d6e63');

    doc.y = 135;

    // Report Title & Metadata Section
    doc.fillColor('#3e2723')
       .fontSize(15)
       .font('Helvetica-Bold')
       .text(report.title || 'Soil Diagnostics Scan', 50, doc.y);
    doc.moveDown(0.5);

    const crop = data.metadata?.cropType || 'General Suitability';
    const generatedDate = new Date(report.created_at).toLocaleString();

    // Draw Metadata Table
    const startY = doc.y;
    doc.fontSize(9)
       .fillColor('#455a64')
       .font('Helvetica-Bold')
       .text('Target Crop Focus:', 50, startY)
       .font('Helvetica')
       .text(crop.toUpperCase(), 170, startY)
       .font('Helvetica-Bold')
       .text('Diagnostics Date:', 300, startY)
       .font('Helvetica')
       .text(generatedDate, 410, startY);

    doc.moveDown(1.5);

    // Overall Health Score Bar
    const score = data.overallHealthScore;
    let scoreColor = '#1b5e20'; // Green
    let scoreBg = '#e8f5e9';
    if (score === null || score === undefined) {
        scoreColor = '#616161';
        scoreBg = '#f5f5f5';
    } else if (score < 50) {
        scoreColor = '#b71c1c'; // Red
        scoreBg = '#ffebee';
    } else if (score < 80) {
        scoreColor = '#e65100'; // Orange
        scoreBg = '#fff3e0';
    }

    doc.rect(50, doc.y, doc.page.width - 100, 45).fill(scoreBg);

    const bannerY = doc.y + 15;
    doc.fillColor(scoreColor)
       .fontSize(11)
       .font('Helvetica-Bold')
       .text(`SOIL DIAGNOSTIC QUALITY RATING:  ${score === null || score === undefined ? 'UNAVAILABLE' : `${score} / 100`}`, 70, bannerY);

    if (data.confidence) {
        doc.font('Helvetica')
           .fontSize(9)
           .text(`Confidence Score: ${(data.confidence * 100).toFixed(1)}%`, doc.page.width - 200, bannerY, { align: 'right' });
    }

    doc.y = bannerY + 45;
}

function drawSoilPhysicalAttributes(doc: PDFKit.PDFDocument, data: ReportContent) {
    doc.fillColor('#263238')
       .fontSize(13)
       .font('Helvetica-Bold')
       .text('Estimated Soil Physical Attributes', 50, doc.y);
    doc.moveDown(0.5);

    const tableY = doc.y;
    doc.rect(50, tableY, doc.page.width - 100, 80).stroke('#d7ccc8');

    doc.fontSize(9).fillColor('#3e2723');
    doc.font('Helvetica-Bold').text('Estimated Texture:', 65, tableY + 12)
       .font('Helvetica').fillColor('#37474f').text(data.texture || 'N/A', 170, tableY + 12);

    doc.font('Helvetica-Bold').fillColor('#3e2723').text('Moisture Class:', 300, tableY + 12)
       .font('Helvetica').fillColor('#37474f').text(data.estimatedMoisture || 'N/A', 410, tableY + 12);

    doc.font('Helvetica-Bold').fillColor('#3e2723').text('Drainage Class:', 65, tableY + 35)
       .font('Helvetica').fillColor('#37474f').text(data.drainageClass || 'N/A', 170, tableY + 35);

    doc.font('Helvetica-Bold').fillColor('#3e2723').text('Soil Observations:', 65, tableY + 58)
       .font('Helvetica').fillColor('#37474f').text(data.colorDiscoloration || 'N/A', 170, tableY + 58, { width: doc.page.width - 240 });

    doc.y = tableY + 95;
}

function drawSoilNPKProfile(doc: PDFKit.PDFDocument, data: ReportContent) {
    doc.fillColor('#263238')
       .fontSize(13)
       .font('Helvetica-Bold')
       .text('Estimated NPK Nutrient Profile', 50, doc.y);
    doc.moveDown(0.5);

    const npkY = doc.y;
    doc.rect(50, npkY, doc.page.width - 100, 45).stroke('#d7ccc8');

    const getNutrientColor = (level: string) => {
        if (!level) return '#757575';
        if (level.toLowerCase() === 'low') return '#b71c1c';
        if (level.toLowerCase() === 'high') return '#e65100';
        return '#2e7d32'; // Optimal
    };

    const nLevel = data.npkDeficiencies?.nitrogen || 'optimal';
    const pLevel = data.npkDeficiencies?.phosphorus || 'optimal';
    const kLevel = data.npkDeficiencies?.potassium || 'optimal';

    doc.fontSize(10);
    doc.font('Helvetica-Bold').fillColor('#3e2723').text('Nitrogen (N):', 70, npkY + 16)
       .fillColor(getNutrientColor(nLevel)).text(nLevel.toUpperCase(), 160, npkY + 16);

    doc.font('Helvetica-Bold').fillColor('#3e2723').text('Phosphorus (P):', 230, npkY + 16)
       .fillColor(getNutrientColor(pLevel)).text(pLevel.toUpperCase(), 330, npkY + 16);

    doc.font('Helvetica-Bold').fillColor('#3e2723').text('Potassium (K):', 390, npkY + 16)
       .fillColor(getNutrientColor(kLevel)).text(kLevel.toUpperCase(), 490, npkY + 16);

    doc.y = npkY + 65;
}

function generateSoilDiagnosticPDF(doc: PDFKit.PDFDocument, report: ReportListRow, data: ReportContent) {
    drawSoilDiagnosticHeader(doc, report, data);
    drawSoilPhysicalAttributes(doc, data);
    drawSoilNPKProfile(doc, data);

    // Crop Suitability
    if (data.cropSuitability && data.cropSuitability.length > 0) {
        doc.fillColor('#263238')
           .fontSize(12)
           .font('Helvetica-Bold')
           .text('Target Crop Suitability', 50, doc.y);
        doc.moveDown(0.5);

        doc.fillColor('#37474f')
           .font('Helvetica')
           .fontSize(9)
           .text(`Based on soil attributes, these crops are highly recommended:  ${data.cropSuitability.join(', ')}`, 65, doc.y, { width: doc.page.width - 130 });
        doc.moveDown(1.2);
    }

    // Amendments & Soil Management
    if (data.recommendations && data.recommendations.length > 0) {
        doc.fillColor('#3e2723')
           .font('Helvetica-Bold')
           .fontSize(12)
           .text('Soil Amendments & Management Advisory', 50, doc.y);
        doc.moveDown(0.5);

        doc.fillColor('#37474f')
           .font('Helvetica')
           .fontSize(9);

        data.recommendations.forEach((rec: string) => {
            doc.text(`✓   ${rec}`, 65, doc.y, { width: doc.page.width - 130 });
            doc.moveDown(0.4);
        });
    }

    // Footer
    doc.fontSize(8)
       .fillColor('#95a5a6')
       .text('This soil analysis represents an AI-assisted diagnostic estimate and should be validated through direct soil core sampling.', 50, doc.page.height - 40, { align: 'center', width: doc.page.width - 100 });
}

function drawGeneralReportDetails(doc: PDFKit.PDFDocument, report: ReportListRow, data: ReportContent) {
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
    doc.text(`Report Type: ${report.type}`);
    doc.text(`Status: ${report.status}`);
    const rawStartDate = data.metadata?.startDate;
    const rawEndDate = data.metadata?.endDate;
    const startDateStr = rawStartDate ? new Date(rawStartDate).toLocaleDateString() : 'N/A';
    const endDateStr = rawEndDate ? new Date(rawEndDate).toLocaleDateString() : 'N/A';
    doc.text(`Period: ${startDateStr} - ${endDateStr}`);
    doc.moveDown(1);

    // Visit Data
    if (data.visits) {
        doc.fontSize(12).fillColor('#2c3e50').text('Visit Statistics', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#34495e');
        doc.text(`Total Visits: ${data.visits.total || 0}`);
        doc.text(`Completed Visits: ${data.visits.completed || 0}`);
        doc.text(`Total Minutes: ${data.visits.totalMinutes || 0}`);
        doc.moveDown(1);
    }

    // Conversation Data
    if (data.conversations) {
        doc.fontSize(12).fillColor('#2c3e50').text('Conversation Statistics', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#34495e');
        doc.text(`Total Conversations: ${data.conversations.totalConversations || 0}`);
        doc.text(`Rated Conversations: ${data.conversations.rated || 0}`);
        doc.text(`Average Satisfaction: ${data.conversations.avgSatisfaction ? Number(data.conversations.avgSatisfaction).toFixed(1) + '/5' : 'N/A'}`);
        doc.moveDown(1);
    }

    // Footer
    doc.moveDown(2);
    doc.fontSize(8).fillColor('#95a5a6').text('Agricultural Extension Decision Support System', { align: 'center' });
}

// Download report as PDF
router.get('/:id/download/pdf', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const scope = await getReportScope(req, 2);
        if (!scope) return res.status(403).json({ success: false, error: 'Tenant membership required' });
        const result = await query<ReportListRow>(`SELECT * FROM reports WHERE id = $1${scope.clause}`, [id, ...scope.params]);
        const report: ReportListRow | undefined = result.rows[0];

        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="report_${id}.pdf"`);

        doc.pipe(res);

        const data = report.content as ReportContent;

        // Custom router for visual diagnostics PDF
        if (report.type === 'disease_diagnosis') {
            generateDiseaseDiagnosisPDF(doc, report, data);
            doc.end();
            return;
        }

        if (report.type === 'soil_diagnostic') {
            generateSoilDiagnosticPDF(doc, report, data);
            doc.end();
            return;
        }

        drawGeneralReportDetails(doc, report, data);
        doc.end();
    } catch (error) {
        logger.error('Download PDF error:', error);
        safeError(res, 500, 'Failed to download PDF');
    }
});

// Download report as Excel
router.get('/:id/download/excel', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const scope = await getReportScope(req, 2);
        if (!scope) return res.status(403).json({ success: false, error: 'Tenant membership required' });
        const result = await query<ReportListRow>(`SELECT * FROM reports WHERE id = $1${scope.clause}`, [id, ...scope.params]);
        const report: ReportListRow | undefined = result.rows[0];

        if (!report) {
            return res.status(404).json({ success: false, error: 'Report not found' });
        }

        const data = report.content as ReportContent;
        const wb = XLSX.utils.book_new();

        // Summary Sheet
        const summaryData = [
            ['Agricultural Extension Report'],
            [''],
            ['Report Title', report.title || 'Activity Report'],
            ['Report Type', report.type],
            ['Status', report.status],
            ['Generated', new Date(report.created_at).toLocaleString()],
            ['Period Start', data.metadata?.startDate ? new Date(data.metadata.startDate).toLocaleDateString() : 'N/A'],
            ['Period End', data.metadata?.endDate ? new Date(data.metadata.endDate).toLocaleDateString() : 'N/A'],
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
                ['Total Minutes', data.visits.totalMinutes || 0],
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
                ['Total Conversations', data.conversations.totalConversations || 0],
                ['Rated Conversations', data.conversations.rated || 0],
                ['Average Satisfaction', data.conversations.avgSatisfaction || 0],
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
        safeError(res, 500, 'Failed to download Excel');
    }
});

import { createShareRoute } from './shareRouteFactory';
router.use(createShareRoute('report'));

export default router;
