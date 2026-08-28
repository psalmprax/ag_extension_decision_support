import { Router, Response } from 'express';
import {
  authenticateCommercialAccess,
  apiClientService,
  CommercialAuthRequest,
} from '@/services/apiClientService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';

const router = Router();

/**
 * Local seed knowledge corpus. Responses must expose seed-only provenance until authorised feeds are configured.
 */
interface KnowledgeArticle {
    id: string;
    title: string;
    summary: string;
    content: string;
    category: string;
    source: string;
    confidence: number;
}

const SEED_ARTICLES: KnowledgeArticle[] = [
    {
        id: 'c-001',
        title: 'Drip irrigation water savings',
        summary: 'Drip systems cut water use by 30–50% versus flood irrigation.',
        content: 'Drip irrigation delivers water directly to the root zone, reducing evaporation losses. Best paired with mulched beds and pressure-compensating emitters. Typical payback period for smallholder farms is 2-3 seasons.',
        category: 'irrigation',
        source: 'FAO',
        confidence: 0.94,
    },
    {
        id: 'c-002',
        title: 'Integrated pest management for fall armyworm',
        summary: 'Combine pheromone traps with targeted biopesticide sprays.',
        content: 'Scout weekly. Deploy pheromone traps at 4 per hectare. Apply Bacillus thuringiensis or neem-based biopesticides at early larval stages. Avoid broad-spectrum pyrethroids — they harm beneficial insects.',
        category: 'pest-management',
        source: 'ICIPE',
        confidence: 0.91,
    },
    {
        id: 'c-003',
        title: 'Maize streak virus prevention',
        summary: 'Plant resistant varieties and control leafhoppers early.',
        content: 'Use certified seed of streak-resistant varieties. Rogue infected plants within 2 weeks of detection. Manage leafhopper vectors with border-row refugia and spot treatments.',
        category: 'disease-management',
        source: 'CIMMYT',
        confidence: 0.88,
    },
];

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
        const results = SEED_ARTICLES.filter(a => {
            const matchesQ = !q || `${a.title} ${a.summary} ${a.content}`.toLowerCase().includes(q);
            const matchesCategory = !category || a.category === category;
            return matchesQ && matchesCategory;
        });

        const context = {
            location: (req.query.location as string) || null,
            region: (req.query.region as string) || null,
            crop: (req.query.crop as string) || null,
            generatedAt: new Date().toISOString(),
            sources: Array.from(new Set(results.map(r => r.source))),
            corpusStatus: 'seed_only' as const,
            corpusSize: SEED_ARTICLES.length,
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

        const article = SEED_ARTICLES.find(a => a.id === req.params.id);
        if (!article) {
            return res.status(404).json({ success: false, error: 'Article not found' });
        }
        return res.json({ success: true, data: article });
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
