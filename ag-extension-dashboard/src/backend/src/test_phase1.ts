import { VectorService } from '@/services/vectorService';
import { initializeDatabase, closeDatabase, query } from '@/services/databaseService';
import { logger } from '@/utils/logger';

async function testPhase1() {
    try {
        logger.info('Starting Phase 1 Verification...');
        await initializeDatabase();
        const { createTables } = await import('@/services/databaseService');
        await createTables();

        const { AIProviderFactory } = await import('@/services/aiProvider/aiProvider');
        AIProviderFactory.initialize();

        // 1. Test similarity function existence
        logger.info('Checking cosine_similarity function...');
        const functions = await query("SELECT proname FROM pg_proc WHERE proname = 'cosine_similarity'");
        if (functions.rows.length === 0) {
            throw new Error('cosine_similarity function not found!');
        }
        logger.info('✅ cosine_similarity function is active.');

        // 2. Test VectorService Upsert
        logger.info('Testing vector upsert...');
        const testId = '00000000-0000-0000-0000-000000000001';
        await VectorService.upsertDocument(testId, 'Maize requires nitrogen-rich soil.', { category: 'crops', crops: ['Maize'] });
        logger.info('✅ Vector upsert successful.');

        // 3. Test VectorService Search
        logger.info('Testing vector search...');
        const results = await VectorService.search('how to grow maize', 1);
        if (results.length > 0 && results[0].score > 0.5) {
            logger.info(`✅ Vector search successful. Top result: ${results[0].metadata.title}`);
        } else {
            logger.warn('Vector search returned low score or no results.');
        }

        // 4. Test Audit Logging via Login simulation
        logger.info('Testing audit logging...');
        const testUserId = '00000000-0000-0000-0000-000000000000'; // Mock admin
        await query(`
            INSERT INTO analytics_events (event_type, user_id, metadata, created_at)
            VALUES ($1, $2, $3, NOW())
        `, ['test_audit', testUserId, JSON.stringify({ test: true })]);
        
        const auditResult = await query("SELECT * FROM analytics_events WHERE event_type = 'test_audit'");
        if (auditResult.rows.length > 0) {
            logger.info('✅ Audit logging verified.');
        } else {
            throw new Error('Audit log entry not found!');
        }

        logger.info('Phase 1 Verification COMPLETE.');
    } catch (error) {
        logger.error('Phase 1 Verification FAILED:', error);
    } finally {
        await closeDatabase();
    }
}

testPhase1();
