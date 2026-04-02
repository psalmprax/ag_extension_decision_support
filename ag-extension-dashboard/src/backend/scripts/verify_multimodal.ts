import { initializeDatabase } from '../src/services/databaseService';
import { AIProviderFactory } from '../src/services/aiProvider/aiProvider';
import { KnowledgeService } from '../src/services/knowledgeService';
import { logger } from '../src/utils/logger';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function verify() {
    logger.info('Initializing services for verification...');
    await initializeDatabase();
    AIProviderFactory.initialize();

    const query = "How can I identify fall armyworm? Are there any videos?";
    logger.info(`Running verification query: "${query}"`);

    try {
        const response = await KnowledgeService.askQuestion('test-user', query);
        
        logger.info('--- Verification Result ---');
        logger.info(`Answer: ${response.answer}`);
        logger.info(`Context used from ${response.contextUsed.length} sources.`);
        
        if (response.visuals) {
            logger.info('Visuals Found:');
            if (response.visuals.images?.length) {
                logger.info(`- Images: ${response.visuals.images.length}`);
                response.visuals.images.forEach((img: any) => logger.info(`  * ${img.url} (${img.caption})`));
            }
            if (response.visuals.videos?.length) {
                logger.info(`- Videos: ${response.visuals.videos.length}`);
                response.visuals.videos.forEach((vid: any) => logger.info(`  * ${vid.url} (${vid.caption})`));
            }
            if (response.visuals.kpis?.length) {
                logger.info(`- KPIs: ${response.visuals.kpis.length}`);
            }
            if (response.visuals.charts?.length) {
                logger.info(`- Charts: ${response.visuals.charts.length}`);
            }
        } else {
            logger.warn('No visuals returned in response.');
        }
        logger.info('---------------------------');

        // Test fuzzy matching (semantic cache)
        const similarQuery = "tell me about identifying fall armyworm and show me a video";
        logger.info(`Running fuzzy match query: "${similarQuery}"`);
        const cachedResponse = await KnowledgeService.askQuestion('test-user', similarQuery);
        
        if (cachedResponse.answer === response.answer) {
            logger.info('Fuzzy matching successful! (Cache hit or exact same logic)');
        } else {
            logger.info('Fuzzy matching returned a different response (Intent check required)');
        }

    } catch (error) {
        logger.error('Verification failed:', error);
    }
}

verify().then(() => process.exit(0));
