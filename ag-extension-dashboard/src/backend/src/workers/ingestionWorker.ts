import { config } from '../config';
import { logger } from '../utils/logger';
import { StealthScraperService } from '../services/stealthScraperService';
import { VectorService } from '../services/vectorService';

interface ScrapeTask {
    niche: string;
    platform: string;
    crop: string;
    category: string;
}

const INGESTION_TASKS: ScrapeTask[] = [
    // CABI Plantwise (Pest & Disease)
    { niche: 'maize fall armyworm', platform: 'cabi_plantwise', crop: 'maize', category: 'pest_and_disease' },
    { niche: 'maize stalk borer', platform: 'cabi_plantwise', crop: 'maize', category: 'pest_and_disease' },
    { niche: 'cassava mosaic disease', platform: 'cabi_plantwise', crop: 'cassava', category: 'pest_and_disease' },
    { niche: 'cassava brown streak', platform: 'cabi_plantwise', crop: 'cassava', category: 'pest_and_disease' },
    { niche: 'banana bunchy top', platform: 'cabi_plantwise', crop: 'banana', category: 'pest_and_disease' },
    { niche: 'rice blast disease', platform: 'cabi_plantwise', crop: 'rice', category: 'pest_and_disease' },
    { niche: 'beans anthracnose', platform: 'cabi_plantwise', crop: 'beans', category: 'pest_and_disease' },

    // FAO Crop Guides (Agronomy & Yield)
    { niche: 'maize planting guide', platform: 'fao_crop_guides', crop: 'maize', category: 'agronomy_and_yield' },
    { niche: 'maize fertilizer management', platform: 'fao_crop_guides', crop: 'maize', category: 'agronomy_and_yield' },
    { niche: 'cassava spacing and planting', platform: 'fao_crop_guides', crop: 'cassava', category: 'agronomy_and_yield' },
    { niche: 'rice water management', platform: 'fao_crop_guides', crop: 'rice', category: 'agronomy_and_yield' },
    { niche: 'cocoa tree pruning shade control', platform: 'fao_crop_guides', crop: 'cocoa', category: 'agronomy_and_yield' },

    // IITA (Cassava & Yam)
    { niche: 'cassava seed systems', platform: 'iita_agronomy', crop: 'cassava', category: 'agronomy_and_yield' },
    { niche: 'yam production guidance', platform: 'iita_agronomy', crop: 'yam', category: 'agronomy_and_yield' },

    // FEWS NET (Climate & Outlook)
    { niche: 'East Africa weather drought', platform: 'fews_net', crop: 'All', category: 'climate_and_weather' },
    { niche: 'Southern Africa agricultural outlook', platform: 'fews_net', crop: 'All', category: 'climate_and_weather' },

    // AfricaRice
    { niche: 'rice agronomy Africa', platform: 'africarice', crop: 'rice', category: 'agronomy_and_yield' }
];

let ingestionTimer: NodeJS.Timeout | null = null;
let isIngesting = false;

/**
 * Normalizes a string to be URL/database ID safe
 */
function slugify(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

/**
 * Runs the batch ingestion process
 */
export async function runBatchIngestion(): Promise<void> {
    if (!config.ingestion.enabled) {
        logger.info('Batch Ingestion is disabled in config.');
        return;
    }

    if (isIngesting) {
        logger.warn('Batch Ingestion is already running. Skipping trigger.');
        return;
    }

    isIngesting = true;
    logger.info(`Starting Batch Ingestion crawl for ${INGESTION_TASKS.length} tasks...`);

    try {
        for (let i = 0; i < INGESTION_TASKS.length; i++) {
            const task = INGESTION_TASKS[i];
            logger.info(`[Ingestion ${i + 1}/${INGESTION_TASKS.length}] Crawling "${task.niche}" on "${task.platform}"...`);

            try {
                const results = await StealthScraperService.scrapeKnowledge(task.niche, task.platform, 'Global Tropics');
                logger.info(`Fetched ${results.length} articles for "${task.niche}"`);

                for (const item of results) {
                    const docId = `ingested-${task.platform}-${slugify(item.topic)}`;
                    
                    // Construct content payload
                    const content = `Scientific Topic: ${item.topic}\n` +
                        `Platform: ${task.platform}\n` +
                        `Crop Focus: ${task.crop}\n` +
                        `Category: ${task.category}\n` +
                        `Summary: ${item.summary || 'No summary available.'}\n` +
                        `Associated Keywords: ${item.keywords.join(', ')}`;

                    const metadata = {
                        title: `Validated Guidance: ${item.topic}`,
                        category: task.category,
                        tags: item.keywords,
                        crops: [task.crop],
                        regions: ['Global Tropics'],
                        source: task.platform,
                        sourceUrl: item.url || null,
                        contentType: 'text'
                    };

                    await VectorService.upsertDocument(docId, content, metadata);
                }
            } catch (taskErr) {
                const message = taskErr instanceof Error ? taskErr.message : String(taskErr);
                logger.error(`Error processing ingestion task "${task.niche}" on "${task.platform}": ${message}`);
            }

            // Introduce a short delay between platform requests to avoid rate limits
            if (i < INGESTION_TASKS.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
        logger.info('Batch Ingestion crawl completed successfully.');
    } catch (error) {
        logger.error('Critical failure in Batch Ingestion process:', error);
    } finally {
        isIngesting = false;
    }
}

/**
 * Initializes and schedules the Ingestion Worker
 */
export function startIngestionWorker(): void {
    if (!config.ingestion.enabled) {
        logger.info('Ingestion worker is disabled in configurations.');
        return;
    }

    const intervalMs = config.ingestion.schedule === 'daily'
        ? 24 * 60 * 60 * 1000 // 1 day
        : 7 * 24 * 60 * 60 * 1000; // 7 days

    logger.info(`Starting Ingestion Worker. Schedule: ${config.ingestion.schedule.toUpperCase()} (${intervalMs}ms)`);

    // Run first ingestion crawl in background after 30 seconds to allow DB startup
    setTimeout(() => {
        logger.info('Triggering initial Ingestion crawl...');
        runBatchIngestion().catch(err => logger.error('Initial ingestion failed:', err));
    }, 30000);

    // Set recurring timer
    if (ingestionTimer) {
        clearInterval(ingestionTimer);
    }
    ingestionTimer = setInterval(() => {
        logger.info(`Recurring Ingestion trigger started (${config.ingestion.schedule})...`);
        runBatchIngestion().catch(err => logger.error('Recurring ingestion failed:', err));
    }, intervalMs);
}

// Auto-start the ingestion worker
setTimeout(() => {
    startIngestionWorker();
}, 15000); // Wait 15 seconds for database to initialize
