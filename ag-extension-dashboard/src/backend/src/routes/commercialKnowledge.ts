/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Response } from 'express';
import { KnowledgeService } from '@/services/knowledgeService';
import { TropicalKnowledgeSourceService } from '@/services/data/tropicalKnowledgeSources';
import { NasaPowerService } from '@/services/data/nasaPowerService';
import { WeatherService } from '@/services/weatherService';
import { FAOService } from '@/services/faoService';
import { marketPriceService } from '@/services/marketPriceService';
import { usageService } from '@/services/usageService';
import { authenticateCommercialAccess, apiClientService, CommercialAuthRequest } from '@/services/apiClientService';
import { logger } from '@/utils/logger';

const router = Router();

router.get('/catalog', (_req, res) => {
    res.json({
        success: true,
        data: {
            products: [
                {
                    id: 'knowledge-search-api',
                    name: 'Tropical Knowledge Search API',
                    endpoint: 'GET /api/v1/commercial/knowledge/search',
                    authentication: 'x-api-key or Bearer JWT',
                    billableUnit: '1 unit per request'
                },
                {
                    id: 'knowledge-ask-api',
                    name: 'Source-Backed Advisory API',
                    endpoint: 'POST /api/v1/commercial/knowledge/ask',
                    authentication: 'x-api-key or Bearer JWT',
                    billableUnit: '1 unit per request'
                },
                {
                    id: 'live-context-api',
                    name: 'Live Agricultural Context API',
                    endpoint: 'GET /api/v1/commercial/knowledge/live-context',
                    authentication: 'x-api-key or Bearer JWT',
                    billableUnit: '1 unit per request'
                }
            ],
            sources: TropicalKnowledgeSourceService.listSources()
        }
    });
});

router.use(authenticateCommercialAccess);

async function meter(req: CommercialAuthRequest, res: Response, endpoint: string, metadata: any = {}): Promise<boolean> {
    const auth = req.commercialAuth!;
    if (auth.type === 'api_key') {
        const usage = await apiClientService.checkAndRecordUsage(auth.clientId!, auth.apiKeyId, endpoint, 1, metadata);
        if (!usage.allowed) {
            res.status(402).json({ success: false, error: 'API quota exceeded', details: usage });
            return false;
        }
        (req as any).commercialUsage = usage;
        return true;
    }

    if (auth.role !== 'admin') {
        const limit = await usageService.checkLimit(auth.userId, 'ai_chat');
        if (!limit.allowed) {
            res.status(402).json({ success: false, error: 'Subscription API usage limit exceeded', details: limit });
            return false;
        }
    }
    await usageService.incrementUsage(auth.userId, 'ai_chat');
    (req as any).commercialUsage = { metered: true, usageType: 'ai_chat', units: 1 };
    return true;
}

router.get('/search', async (req: CommercialAuthRequest, res: Response) => {
    try {
        const { q, category, crop, limit = '5' } = req.query;
        if (!q) return res.status(400).json({ success: false, error: 'q is required' });
        if (!await meter(req, res, 'commercial.knowledge.search', { q, category, crop })) return;

        const articles = await KnowledgeService.searchKnowledge(q as string, parseInt(limit as string), {
            category: category as string | undefined,
            crop: crop as string | undefined
        });
        res.json({ success: true, data: { query: q, articles, billing: (req as any).commercialUsage } });
    } catch (error) {
        logger.error('Commercial search API failed:', error);
        res.status(500).json({ success: false, error: 'Commercial search failed' });
    }
});

router.post('/ask', async (req: CommercialAuthRequest, res: Response) => {
    try {
        const { question, attachments } = req.body;
        if (!question) return res.status(400).json({ success: false, error: 'question is required' });
        if (!await meter(req, res, 'commercial.knowledge.ask', { question })) return;

        const answer = await KnowledgeService.askQuestion(req.commercialAuth!.userId, question, attachments);
        res.json({ success: true, data: { ...answer, billing: (req as any).commercialUsage } });
    } catch (error) {
        logger.error('Commercial ask API failed:', error);
        res.status(500).json({ success: false, error: 'Commercial ask failed' });
    }
});

router.get('/live-context', async (req: CommercialAuthRequest, res: Response) => {
    try {
        const { location = 'Kenya', region = 'Kenya', crop, lat, lng } = req.query;
        if (!await meter(req, res, 'commercial.knowledge.live_context', { location, region, crop, lat, lng })) return;

        const context: any = { location, region, crop, generatedAt: new Date().toISOString(), sources: [] };
        const [weather, alerts, prices] = await Promise.allSettled([
            WeatherService.getByLocation(location as string),
            FAOService.getDiseaseAlerts(region as string, crop as string | undefined),
            marketPriceService.getLatestPrices()
        ]);

        if (weather.status === 'fulfilled') { context.weather = weather.value; context.sources.push('weather_forecast'); }
        if (alerts.status === 'fulfilled') { context.diseaseAlerts = alerts.value; context.sources.push('fao_disease_alerts'); }
        if (prices.status === 'fulfilled') { context.marketPrices = prices.value; context.sources.push('market_prices'); }

        if (lat && lng) {
            try {
                const nasa = new NasaPowerService();
                context.agroclimate = await nasa.getAgroclimateSummary(parseFloat(lat as string), parseFloat(lng as string), 7);
                context.sources.push('nasa_power');
            } catch (error) {
                context.agroclimateError = (error as Error).message;
            }
        }

        res.json({ success: true, data: { ...context, billing: (req as any).commercialUsage } });
    } catch (error) {
        logger.error('Commercial live-context API failed:', error);
        res.status(500).json({ success: false, error: 'Commercial live-context failed' });
    }
});

export default router;
