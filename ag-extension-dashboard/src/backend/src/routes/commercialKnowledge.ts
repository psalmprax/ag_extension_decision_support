import { Router, Response } from 'express';
import {
  authenticateCommercialAccess,
  apiClientService,
  CommercialAuthRequest,
} from '@/services/apiClientService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import { query } from '@/services/databaseService';

const router = Router();

interface CommercialKnowledgeArticle {
    id: string;
    title: string;
    summary: string | null;
    content: string;
    category: string | null;
    source: string | null;
    confidence: number | null;
}

// DB-backed with in-memory fallback — no hard-coded primary source
const FALLBACK_SEED: CommercialKnowledgeArticle[] = [
    { id: 'c-001', title: 'Drip irrigation water savings', summary: 'Drip systems cut water use by 30–50% versus flood irrigation.', content: 'Drip irrigation delivers water directly to the root zone, reducing evaporation losses. Best paired with mulched beds and pressure-compensating emitters.', category: 'irrigation', source: 'FAO', confidence: 0.94 },
    { id: 'c-002', title: 'Integrated pest management for fall armyworm', summary: 'Combine pheromone traps with targeted biopesticide sprays.', content: 'Scout weekly. Deploy pheromone traps at 4 per hectare. Apply Bacillus thuringiensis or neem-based biopesticides at early larval stages.', category: 'pest-management', source: 'ICIPE', confidence: 0.91 },
    { id: 'c-003', title: 'Maize streak virus prevention', summary: 'Plant resistant varieties and control leafhoppers early.', content: 'Use certified seed of streak-resistant varieties. Rogue infected plants within 2 weeks of detection.', category: 'disease-management', source: 'CIMMYT', confidence: 0.88 },
];

async function fetchCommercialArticles(q: string, category?: string): Promise<{ articles: CommercialKnowledgeArticle[]; isFallback: boolean }> {
    try {
        const params: unknown[] = [];
        let where = 'WHERE 1=1';
        if (q) { params.push(`%${q}%`); where += ` AND (title ILIKE $${params.length} OR summary ILIKE $${params.length} OR content ILIKE $${params.length})`; }
        if (category) { params.push(category); where += ` AND category = $${params.length}`; }
        params.push(50);
        const { rows } = await query<CommercialKnowledgeArticle>(
            `SELECT id::text, title, summary, content, category, source, NULL::float as confidence FROM knowledge_articles ${where} ORDER BY updated_at DESC NULLS LAST LIMIT $${params.length}`,
            params
        );
        if (rows.length > 0) return { articles: rows as CommercialKnowledgeArticle[], isFallback: false };
    } catch (err) {
        logger.warn('Commercial knowledge DB lookup failed, using fallback seed:', err);
    }
    const filtered = FALLBACK_SEED.filter(a => {
        const matchesQ = !q || `${a.title} ${a.summary} ${a.content}`.toLowerCase().includes(q);
        const matchesCat = !category || a.category === category;
        return matchesQ && matchesCat;
    });
    return { articles: filtered, isFallback: true };
}

/**
 * GET /api/commercial/knowledge/search — semantic-ish lookup with optional filters.
 */
router.get('/search', authenticateCommercialAccess, async (req: CommercialAuthRequest, res: Response) => {
    try {
        const auth = req.commercialAuth;
        if (auth?.clientId) {
            const allowed = await apiClientService.checkAndRecordUsage(
                auth.clientId,
                auth.apiKeyId,
                '/knowledge/search',
                1,
                { source: 'commercial' }
            );
            if (!allowed) {
                return res.status(429).json({ success: false, error: 'Quota exceeded' });
            }
        }

        const q = ((req.query.q as string) || '').toLowerCase();
        const category = (req.query.category as string) || undefined;
        const { articles: results, isFallback } = await fetchCommercialArticles(q, category);

        const context = {
            location: (req.query.location as string) || null,
            region: (req.query.region as string) || null,
            crop: (req.query.crop as string) || null,
            generatedAt: new Date().toISOString(),
            sources: Array.from(new Set(results.map(r => r.source).filter(Boolean))),
            corpusStatus: isFallback ? 'seed_only' : 'live_db',
            corpusSize: results.length,
        };

        return res.json({ success: true, data: { articles: results, context } });
    } catch (error) {
        logger.error('Commercial knowledge search failed:', error);
        return safeError(res, 500, 'Commercial knowledge search failed');
    }
});

/**
 * GET /api/commercial/knowledge/article/:id — fetch a single article.
 */
router.get('/article/:id', authenticateCommercialAccess, async (req: CommercialAuthRequest, res: Response) => {
    try {
        const auth = req.commercialAuth;
        if (auth?.clientId) {
            const allowed = await apiClientService.checkAndRecordUsage(
                auth.clientId,
                auth.apiKeyId,
                '/knowledge/article',
                1,
                { articleId: req.params.id }
            );
            if (!allowed) {
                return res.status(429).json({ success: false, error: 'Quota exceeded' });
            }
        }

        // Try live DB first
        try {
            const { rows } = await query<CommercialKnowledgeArticle>(
                `SELECT id::text, title, summary, content, category, source, NULL::float as confidence FROM knowledge_articles WHERE id::text = $1 LIMIT 1`,
                [req.params.id]
            );
            if (rows.length > 0) return res.json({ success: true, data: rows[0] });
        } catch (err) {
            logger.warn('Commercial article DB lookup failed:', err);
        }
        const fallback = FALLBACK_SEED.find(a => a.id === req.params.id);
        if (!fallback) return res.status(404).json({ success: false, error: 'Article not found' });
        return res.json({ success: true, data: fallback });
    } catch (error) {
        logger.error('Commercial article fetch failed:', error);
        return safeError(res, 500, 'Commercial article fetch failed');
    }
});

/**
 * GET /api/commercial/knowledge/usage — current period usage for the caller.
 */
router.get('/usage', authenticateCommercialAccess, async (req: CommercialAuthRequest, res: Response) => {
    try {
        const auth = req.commercialAuth;
        if (!auth?.clientId) {
            return res.json({
                success: true,
                data: { clientId: null, role: auth?.role ?? null, used: 0, limit: null },
            });
        }
        const { usageService } = await import('@/services/usageService');
        const usage = await usageService.getUsageStatus(auth.clientId);
        return res.json({ success: true, data: usage });
    } catch (error) {
        logger.error('Commercial usage fetch failed:', error);
        return safeError(res, 500, 'Commercial usage fetch failed');
    }
});

export default router;
