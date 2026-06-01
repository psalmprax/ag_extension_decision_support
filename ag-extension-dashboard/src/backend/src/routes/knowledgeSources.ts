/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { query } from '@/services/databaseService';
import { TropicalKnowledgeSourceService } from '@/services/data/tropicalKnowledgeSources';
import { logger } from '@/utils/logger';
import { authorize, UserRole } from '@/middleware/authorize';
import { safeError } from '@/utils/safeResponse';

const router = Router();

const knowledgeAdminRoles: UserRole[] = ['admin', 'regional_manager', 'extension_officer'];

// All source routes require authentication
router.use(authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']));

// List configured static and dynamic tropical knowledge sources for the Knowledge Base menu
router.get('/', async (_req: Request, res: Response) => {
    try {
        res.json({
            success: true,
            data: {
                sources: await TropicalKnowledgeSourceService.listSources(),
                curatedArticles: TropicalKnowledgeSourceService.listArticleSeeds().map(article => ({
                    id: article.id,
                    title: article.title,
                    category: article.category,
                    crops: article.crops,
                    regions: article.regions,
                    source: article.source,
                    sourceUrl: article.sourceUrl
                }))
            }
        });
    } catch (error) {
        logger.error('Get knowledge sources error:', error);
        safeError(res, 500, 'Failed to load knowledge sources');
    }
});

// Create tropical knowledge source
router.post('/', authorize(knowledgeAdminRoles), async (req: Request, res: Response) => {
    try {
        const { id, name, provider, type, license, url, syncMode, topics, crops, regions, description, priority } = req.body;
        if (!id || !name || !provider || !type || !url || !syncMode) {
            return res.status(400).json({ success: false, error: 'id, name, provider, type, url, and syncMode are required' });
        }

        await query(`
            INSERT INTO tropical_knowledge_sources 
                (id, name, provider, type, license, url, sync_mode, topics, crops, regions, description, priority, is_active)
            VALUES 
                ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                provider = EXCLUDED.provider,
                type = EXCLUDED.type,
                license = EXCLUDED.license,
                url = EXCLUDED.url,
                sync_mode = EXCLUDED.sync_mode,
                topics = EXCLUDED.topics,
                crops = EXCLUDED.crops,
                regions = EXCLUDED.regions,
                description = EXCLUDED.description,
                priority = EXCLUDED.priority,
                updated_at = NOW()
        `, [id, name, provider, type, license, url, syncMode, topics || [], crops || [], regions || [], description, priority || 'medium']);

        res.status(201).json({ success: true, message: 'Tropical knowledge source created/updated successfully' });
    } catch (error) {
        logger.error('Create knowledge source error:', error);
        safeError(res, 500, 'Failed to create knowledge source');
    }
});

// Update tropical knowledge source
router.put('/:id', authorize(knowledgeAdminRoles), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, provider, type, license, url, syncMode, topics, crops, regions, description, priority, isActive } = req.body;

        await query(`
            UPDATE tropical_knowledge_sources
            SET 
                name = COALESCE($1, name),
                provider = COALESCE($2, provider),
                type = COALESCE($3, type),
                license = COALESCE($4, license),
                url = COALESCE($5, url),
                sync_mode = COALESCE($6, sync_mode),
                topics = COALESCE($7, topics),
                crops = COALESCE($8, crops),
                regions = COALESCE($9, regions),
                description = COALESCE($10, description),
                priority = COALESCE($11, priority),
                is_active = COALESCE($12, is_active),
                updated_at = NOW()
            WHERE id = $13
        `, [name, provider, type, license, url, syncMode, topics, crops, regions, description, priority, isActive, id]);

        res.json({ success: true, message: 'Tropical knowledge source updated successfully' });
    } catch (error) {
        logger.error('Update knowledge source error:', error);
        safeError(res, 500, 'Failed to update knowledge source');
    }
});

// Delete tropical knowledge source (soft delete)
router.delete('/:id', authorize(knowledgeAdminRoles), async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await query('UPDATE tropical_knowledge_sources SET is_active = false, updated_at = NOW() WHERE id = $1', [id]);
        res.json({ success: true, message: 'Tropical knowledge source deleted successfully' });
    } catch (error) {
        logger.error('Delete knowledge source error:', error);
        safeError(res, 500, 'Failed to delete knowledge source');
    }
});

// Admin sync endpoint for curated free tropical source-backed articles
router.post('/sync-curated', authorize(knowledgeAdminRoles), async (_req: Request, res: Response) => {
    try {
        const result = await TropicalKnowledgeSourceService.syncCuratedArticles();
        res.json({
            success: true,
            data: result,
            message: `Synced ${result.synced} curated tropical knowledge articles into the vector knowledge base.`
        });
    } catch (error) {
        logger.error('Curated tropical source sync error:', error);
        safeError(res, 500, 'Failed to sync curated tropical sources');
    }
});

export default router;