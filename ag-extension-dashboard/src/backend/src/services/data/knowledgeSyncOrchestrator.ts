/* eslint-disable @typescript-eslint/no-explicit-any */
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';
import { VectorService } from '../vectorService';
import { TropicalKnowledgeSourceService } from './tropicalKnowledgeSources';
import { faostatService } from './faostatService';

/**
 * Orchestrates syncing of all external data sources into the knowledge base.
 * Runs on startup and can be triggered manually via API.
 */
export class KnowledgeSyncOrchestrator {
    private static syncInProgress = false;
    private static lastSyncAt: string | null = null;

    /**
     * Run a full sync of all data sources.
     * Safe to call multiple times — uses ON CONFLICT DO NOTHING.
     */
    static async syncAll(): Promise<{
        tropicalSources: number;
        tropicalArticles: number;
        faostatArticles: number;
        totalEmbeddings: number;
    }> {
        if (this.syncInProgress) {
            logger.info('Knowledge sync already in progress, skipping.');
            return { tropicalSources: 0, tropicalArticles: 0, faostatArticles: 0, totalEmbeddings: 0 };
        }

        this.syncInProgress = true;
        const results = { tropicalSources: 0, tropicalArticles: 0, faostatArticles: 0, totalEmbeddings: 0 };

        try {
            // 1. Seed tropical knowledge source registry
            logger.info('[KnowledgeSync] Seeding tropical knowledge sources...');
            await TropicalKnowledgeSourceService.seedSourcesFromStatic();
            results.tropicalSources = 8; // 8 sources in the static array

            // 2. Sync curated tropical articles (pest mgmt, disease, etc.)
            logger.info('[KnowledgeSync] Syncing curated tropical articles...');
            const tropicalResult = await TropicalKnowledgeSourceService.syncCuratedArticles();
            results.tropicalArticles = tropicalResult.synced;
            results.totalEmbeddings += tropicalResult.synced;

            // 3. Sync FAOSTAT crop production data
            logger.info('[KnowledgeSync] Fetching FAOSTAT crop production data...');
            const faostatArticles = await faostatService.generateCountryArticles();
            for (const article of faostatArticles) {
                await VectorService.upsertDocument(
                    uuidv4(),
                    article.content,
                    {
                        title: article.title,
                        category: article.category,
                        tags: ['faostat', 'production', 'statistics'],
                        crops: article.crops,
                        regions: article.regions,
                        source: 'FAOSTAT API',
                        sourceUrl: 'https://fenixservices.fao.org/faostat/api/v1/en/',
                        contentType: 'text'
                    }
                );
                results.faostatArticles++;
                results.totalEmbeddings++;
            }

            this.lastSyncAt = new Date().toISOString();
            logger.info(`[KnowledgeSync] Complete. Sources: ${results.tropicalSources}, Articles: ${results.tropicalArticles + results.faostatArticles}, Embeddings: ${results.totalEmbeddings}`);
        } catch (error) {
            logger.error(`[KnowledgeSync] Error: ${error instanceof Error ? error.message : "Unknown error"}`);
        } finally {
            this.syncInProgress = false;
        }

        return results;
    }

    /**
     * Sync only the lightweight sources (no external API calls).
     * Safe for startup — fast, no rate limits.
     */
    static async syncLightweight(): Promise<void> {
        try {
            await TropicalKnowledgeSourceService.seedSourcesFromStatic();
            const result = await TropicalKnowledgeSourceService.syncCuratedArticles();
            logger.info(`[KnowledgeSync] Lightweight sync: ${result.synced} curated articles`);
        } catch (error) {
            logger.error(`[KnowledgeSync] Lightweight sync error: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }

    static getStatus(): { inProgress: boolean; lastSyncAt: string | null } {
        return { inProgress: this.syncInProgress, lastSyncAt: this.lastSyncAt };
    }
}
