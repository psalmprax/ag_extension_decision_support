/* eslint-disable @typescript-eslint/no-explicit-any */
import { v5 as uuidv5 } from 'uuid';
import { logger } from '../../utils/logger';
import { VectorService } from '../vectorService';
import { TropicalKnowledgeSourceService } from './tropicalKnowledgeSources';
import { faostatService } from './faostatService';
import { acquireKnowledgeSyncLock, isKnowledgeSyncLocked } from './knowledgeSyncLock';

/**
 * Orchestrates syncing of all external data sources into the knowledge base.
 * The lightweight sync runs on startup; full sync can be triggered via API.
 */
export class KnowledgeSyncInProgressError extends Error {
    constructor() {
        super('Knowledge sync is already in progress');
        this.name = 'KnowledgeSyncInProgressError';
    }
}

type FaostatDataStatus = 'api' | 'historical_fallback' | 'mixed' | 'unavailable';
interface KnowledgeSyncResult {
    tropicalSources: number;
    tropicalArticles: number;
    faostatArticles: number;
    totalEmbeddings: number;
    faostatDataStatus: FaostatDataStatus;
}

function getFaostatDataStatus(sources: Set<string>): FaostatDataStatus {
    if (sources.size === 0) return 'unavailable';
    if (sources.size > 1) return 'mixed';
    return sources.has('FAOSTAT API') ? 'api' : 'historical_fallback';
}

export class KnowledgeSyncOrchestrator {
    private static syncInProgress = false;
    private static lastSyncAt: string | null = null;

    /**
     * Run a full sync of all data sources.
     * Repeated syncs update the same FAOSTAT article for each source and country.
     */
    static async syncAll(): Promise<KnowledgeSyncResult> {
        if (this.syncInProgress) {
            throw new KnowledgeSyncInProgressError();
        }

        this.syncInProgress = true;
        const results: KnowledgeSyncResult = {
            tropicalSources: 0, tropicalArticles: 0, faostatArticles: 0, totalEmbeddings: 0,
            faostatDataStatus: 'unavailable',
        };

        try {
            const lock = await acquireKnowledgeSyncLock();
            if (!lock) throw new KnowledgeSyncInProgressError();
            try {
                lock.assertHeld();
                logger.info('[KnowledgeSync] Seeding tropical knowledge sources...');
                results.tropicalSources = await TropicalKnowledgeSourceService.seedSourcesFromStatic();
                lock.assertHeld();

                logger.info('[KnowledgeSync] Syncing curated tropical articles...');
                const tropicalResult = await TropicalKnowledgeSourceService.syncCuratedArticles();
                lock.assertHeld();
                results.tropicalArticles = tropicalResult.synced;
                results.totalEmbeddings += tropicalResult.synced;

                logger.info('[KnowledgeSync] Fetching FAOSTAT crop production data...');
                const faostatArticles = await faostatService.generateCountryArticles();
                lock.assertHeld();
                results.faostatDataStatus = getFaostatDataStatus(new Set(faostatArticles.map(article => article.source)));
                for (const article of faostatArticles) {
                    lock.assertHeld();
                    await VectorService.upsertDocument(
                        uuidv5(`faostat:${article.source}:${article.title}`, uuidv5.URL),
                        article.content,
                        {
                            title: article.title,
                            category: article.category,
                            tags: ['faostat', 'production', 'statistics'],
                            crops: article.crops,
                            regions: article.regions,
                            source: article.source,
                            sourceUrl: article.sourceUrl,
                            contentType: 'text'
                        }
                    );
                    lock.assertHeld();
                    results.faostatArticles++;
                    results.totalEmbeddings++;
                }
            } finally {
                await lock.release();
            }
            this.lastSyncAt = new Date().toISOString();
            logger.info(`[KnowledgeSync] Complete. Sources: ${results.tropicalSources}, Articles: ${results.tropicalArticles + results.faostatArticles}, Embeddings: ${results.totalEmbeddings}`);
        } catch (error) {
            logger.error(`[KnowledgeSync] Error: ${error instanceof Error ? error.message : "Unknown error"}`);
            throw error;
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

    static async getStatus(): Promise<{ inProgress: boolean; lastSyncAt: string | null; lastSyncScope: 'process' }> {
        return {
            inProgress: this.syncInProgress || await isKnowledgeSyncLocked(),
            lastSyncAt: this.lastSyncAt,
            lastSyncScope: 'process',
        };
    }
}
