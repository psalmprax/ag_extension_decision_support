import { Router, Request, Response } from 'express';
import { KnowledgeService } from '@/services/knowledgeService';
import type {
  KnowledgeArticleForVector,
} from '@/types/rowTypes';
import { getPrisma } from '@/services/prismaService';
import { logger } from '@/utils/logger';
import { authorize, UserRole } from '@/middleware/authorize';
import { VectorService } from '@/services/vectorService';
import { safeError } from '@/utils/safeResponse';
import { parseSynthesizeVisitResponse } from '@/schemas/synthesizeVisitResponse';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const knowledgeAdminRoles: UserRole[] = ['admin', 'regional_manager', 'extension_officer'];

async function upsertVector(article: KnowledgeArticleForVector): Promise<void> {
    await VectorService.upsertDocument(article.id, article.content, {
        title: article.title,
        category: article.category,
        tags: article.tags,
        crops: article.crops,
        regions: article.regions,
        source: article.source,
        sourceUrl: article.sourceUrl,
        contentType: article.contentType
    });
}

// Configure upload for knowledge ingestion
const knowledgeStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const uploadDir = path.join(__dirname, '../../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const knowledgeFileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = ['text/plain', 'text/markdown', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.md') || file.originalname.endsWith('.txt')) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only PDF, TXT, and MD files are allowed.'));
    }
};

const knowledgeUpload = multer({
    storage: knowledgeStorage,
    fileFilter: knowledgeFileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }
});

async function extractContentFromFile(filePath: string, ext: string): Promise<string | null> {
    if (ext === '.pdf') {
        // @ts-expect-error pdf-parse has no TypeScript types
        const pdfParse = await import('pdf-parse');
        const buffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse.default(buffer);
        return pdfData.text;
    } else if (ext === '.txt' || ext === '.md') {
        return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
}

async function processKnowledgeIngestion(req: Request, res: Response) {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const { title, category = 'General', crops, regions, tags } = req.body;
    const filePath = req.file.path;
    const ext = path.extname(req.file.originalname).toLowerCase();

    const content = await extractContentFromFile(filePath, ext);

    if (content === null) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(400).json({ success: false, error: 'Unsupported file type. Only .pdf, .txt, and .md files are supported.' });
    }

    if (!content || content.trim().length === 0) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return res.status(400).json({ success: false, error: 'The uploaded file contains no readable text.' });
    }

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    const prisma = getPrisma();
    const articleId = uuidv4();
    const articleTitle = title || path.basename(req.file.originalname, ext).replace(/[-_]/g, ' ');
    const articleCrops = crops ? crops.split(',').map((c: string) => c.trim()) : [];
    const articleRegions = regions ? regions.split(',').map((r: string) => r.trim()) : ['tropical'];
    const articleTags = tags ? tags.split(',').map((t: string) => t.trim()) : [];
    const summary = content.substring(0, 300).trim() + (content.length > 300 ? '...' : '');

    const article = await prisma.knowledgeArticle.create({
        data: {
            id: articleId,
            title: articleTitle,
            content,
            contentType: 'text',
            summary,
            category,
            tags: articleTags,
            crops: articleCrops,
            regions: articleRegions,
            source: 'Dynamic Ingestion',
            sourceUrl: `/uploads/${req.file.filename}`
        }
    });

    await upsertVector(article);

    return res.status(201).json({
        success: true,
        data: {
            id: article.id,
            title: article.title,
            category: article.category,
            crops: article.crops,
            regions: article.regions,
            tags: article.tags,
            summary: article.summary
        },
    });
}

// Synthesize a field visit from raw notes (returns summary, crop health, actions)
router.post('/synthesize-visit', async (req: Request, res: Response) => {
  try {
    const { farmerId, farmerName, crop, region, notes, visitType } = req.body as {
      farmerId?: string;
      farmerName?: string;
      crop?: string;
      region?: string;
      notes?: string;
      visitType?: string;
    };
    const user = (req as Request & { user?: Record<string, unknown> }).user;
    const userId = (user?.userId || user?.id) as string | undefined;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    if (!notes) {
      return res.status(400).json({ success: false, error: 'Visit notes are required' });
    }

    const prompt = `You are an agricultural extension officer. Synthesize the following field visit notes into a structured summary.

Farmer: ${farmerName ?? 'Unknown'}${farmerId ? ` (id: ${farmerId})` : ''}
Region: ${region ?? 'Unknown'}
Crop: ${crop ?? 'Unknown'}
Visit type: ${visitType ?? 'routine'}

Raw notes:
"""
${notes}
"""

Respond with valid JSON only (no markdown, no commentary). Schema:
{
  "summary": "2-3 sentence overview of the visit",
  "cropHealth": { "status": "good" | "fair" | "poor", "notes": "brief crop condition assessment" },
  "actions": [ { "priority": "high" | "medium" | "low", "description": "concrete next step" } ],
  "followUpDate": "ISO date string or null"
}`;

    // Free-tier users (farmers) route to the freebuff best-effort provider;
    // officers and admins continue to use the primary/fallback chain. The
    // freebuff provider is already wired into the fallback chain via
    // AIProviderFactory.getWithFallback, so the 'preferredProvider' hint is
    // forwarded through KnowledgeService.askQuestion options to nudge the
    // cascade toward the community proxy first when role === 'farmer'.
    const isFreeTier = (user as Record<string, unknown> | undefined)?.role === 'farmer';
    const preferredProvider = isFreeTier ? 'freebuff' : undefined;
    const result = await KnowledgeService.askQuestion(userId, prompt, undefined, { preferredProvider });

    const rawAnswer = (result.answer ?? '').trim();
    const summaryFallback = rawAnswer || 'Visit recorded.';
    const parsed = parseSynthesizeVisitResponse(rawAnswer, summaryFallback);

    res.json({
      success: true,
      data: {
        summary: parsed.summary,
        cropHealth: parsed.cropHealth,
        actions: parsed.actions,
        followUpDate: parsed.followUpDate,
        cached: result.cached ?? false,
      },
    });
  } catch (error) {
    logger.error('Synthesize visit error:', error);
    if (!res.headersSent) {
      safeError(res, 500, 'Failed to synthesize visit');
    }
  }
});

/**
 * @swagger
 * /api/v1/knowledge/ingest:
 *   post:
 *     summary: Ingest and vectorize a PDF, TXT, or MD file
 *     security:
 *       - BearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: file
 *         type: file
 *       - in: formData
 *         name: title
 *         type: string
 *       - in: formData
 *         name: category
 *         type: string
 *       - in: formData
 *         name: crops
 *         type: string
 *       - in: formData
 *         name: regions
 *         type: string
 *       - in: formData
 *         name: tags
 *         type: string
 *     responses:
 *       201:
 *         description: Document ingested
 */
router.post('/ingest', authorize(knowledgeAdminRoles), knowledgeUpload.single('file'), async (req: Request, res: Response) => {
    try {
        await processKnowledgeIngestion(req, res);
    } catch (error) {
        logger.error('Document ingestion error:', error);
        safeError(res, 500, 'Failed to ingest document');
    }
});

// RAG v2 bootstrap
router.post('/ragv2/bootstrap', async (_req: Request, res: Response) => {
    try {
        const { RAGV2Service } = await import('@/services/ragV2Service');
        await RAGV2Service.initializeSchema();
        const chunks = await RAGV2Service.chunkAllArticles();
        const graph = await RAGV2Service.buildKnowledgeGraph();
        res.json({
            success: true,
            data: {
                chunks: chunks.chunks,
                articles: chunks.total,
                entities: graph.entities,
                relationships: graph.relationships
            }
        });
    } catch (error) {
        logger.error('RAG v2 bootstrap error:', error);
        safeError(res, 500, 'Failed to bootstrap RAG v2');
    }
});

export default router;
