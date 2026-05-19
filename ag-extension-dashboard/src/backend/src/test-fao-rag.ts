/* eslint-disable @typescript-eslint/no-explicit-any */
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';
import { initializeDatabase, query } from '@/services/databaseService';
import { KnowledgeService } from '@/services/knowledgeService';
import { faoKnowledgeService } from '@/services/data/faoKnowledgeService';
import { logger } from '@/utils/logger';

const faoMockArticles = [
    {
        title: "Sustainable Maize Production and Fall Armyworm Control in East Africa",
        content: `Maize is the primary staple food for over 300 million people in Sub-Saharan Africa. However, its production is constantly threatened by climate change, declining soil fertility, and pests. Among these, the Fall Armyworm (Spodoptera frugiperda) has emerged as a devastating threat since its introduction to the continent in 2016.

To manage Fall Armyworm sustainably, farmers are urged to adopt Integrated Pest Management (IPM) strategies rather than relying solely on chemical pesticides. IPM practices include early planting, which allows the crop to establish before pest populations peak, and frequent monitoring (at least twice a week) to detect egg masses and early-instar larvae. Handpicking egg masses and crushing them is highly effective for smallholder farmers.

Furthermore, the 'Push-Pull' technology, developed by ICIPE and partners, is highly recommended. This strategy involves intercropping maize with silverleaf desmodium (which repels or 'pushes' the armyworm moth away) and planting Napier grass or Brachiaria around the field border (which attracts or 'pulls' the moth to lay its eggs on a plant that does not support its survival). Desmodium also fixes nitrogen in the soil and suppresses the parasitic Striga weed, making it a triple-win for farmers in East Africa.`,
        crops: ["maize"],
        regions: ["East Africa", "Kenya", "Uganda", "Tanzania"]
    },
    {
        title: "Cassava Mosaic Disease Prevention and Soil Nutrient Management",
        content: `Cassava is a resilient root crop that serves as an essential food security crop across Africa, particularly during droughts. Despite its hardiness, cassava yields are severely limited by diseases, with Cassava Mosaic Disease (CMD) being the most widespread. CMD is caused by geminiviruses transmitted by the whitefly (Bemisia tabaci) and through the vegetative propagation of infected stem cuttings.

The primary defense against CMD is the cultivation of virus-resistant or virus-tolerant cassava varieties developed by IITA and national partners (such as the 'Kibandameno' or 'Mkombozi' improved varieties). Farmers must select disease-free planting materials (cuttings) obtained from certified sources or healthy parent plants showing no leaf symptoms.

Soil fertility is also key to maximizing cassava root yield. Although cassava can grow in poor soils, it responds exceptionally well to potassium (K) and nitrogen (N) applications. A balanced application of organic compost combined with mineral fertilizer (NPK 17:17:17) at planting dramatically increases starch accumulation. Furthermore, practice crop rotation with legumes like cowpeas or groundnuts to naturally replenish soil nitrogen, ensuring long-term soil health.`,
        crops: ["cassava"],
        regions: ["East Africa", "West Africa", "Nigeria", "Kenya"]
    }
];

async function testFaoRAG() {
    console.log('--- STARTING FAO RAG PIPELINE VERIFICATION ---');
    
    try {
        // 1. Initializing Services
        logger.info('Initializing AI Router and Database Connection...');
        AIProviderFactory.initialize();
        await initializeDatabase();
        logger.info('Services initialized successfully.');

        // 2. Clear old FAO records to prevent duplicate seeds
        logger.info('Clearing old FAO agronomic knowledge entries...');
        await query("DELETE FROM knowledge_articles WHERE source = 'FAO / CGIAR Manuals'");
        logger.info('Old records cleared.');

        // 3. Ingest and Segment FAO Articles
        console.log('\n--- STEP 1: INGESTING FAO ARTICLES ---');
        logger.info(`Starting ingestion of ${faoMockArticles.length} unstructured articles...`);
        await faoKnowledgeService.ingestAgronomicData(faoMockArticles);
        logger.info('Ingestion and embedding storage completed.');

        // 4. Verify Chunks in DB
        console.log('\n--- STEP 2: VERIFYING DATABASE CHUNKS ---');
        const dbResult = await query(
            "SELECT id, title, char_length(content) as content_length, crops, regions FROM knowledge_articles WHERE source = 'FAO / CGIAR Manuals' ORDER BY title ASC"
        );
        logger.info(`Found ${dbResult.rows.length} chunked segments in the database:`);
        dbResult.rows.forEach((row: any, i: number) => {
            console.log(`  [Chunk ${i + 1}] ID: ${row.id} | Length: ${row.content_length} chars`);
            console.log(`            Title: "${row.title}"`);
            console.log(`            Crops: [${row.crops.join(', ')}] | Regions: [${row.regions.join(', ')}]`);
        });

        // 5. Test Semantic Vector Search
        console.log('\n--- STEP 3: TESTING SEMANTIC VECTOR SEARCH ---');
        const queryTerm = 'Push-Pull technology for armyworm';
        logger.info(`Querying database for semantic match: "${queryTerm}"`);
        const searchResults = await KnowledgeService.searchKnowledge(queryTerm, 2);
        
        console.log(`Semantic Vector Search Results (Limit 2):`);
        searchResults.forEach((res: any, i) => {
            console.log(`  [Result ${i + 1}] ID: ${res.id}`);
            console.log(`             Score: ${res.score?.toFixed(5) || 'N/A'}`);
            console.log(`             Title: "${res.title}"`);
            console.log(`             Content: "${(res.content || '').substring(0, 150)}..."`);
        });

        // 6. Test End-to-End RAG QA
        console.log('\n--- STEP 4: TESTING E2E RAG QUESTION ANSWERING ---');
        const userQuestion = 'How can I sustainably control Fall Armyworm in my maize farm in East Africa?';
        logger.info(`Asking RAG Engine: "${userQuestion}"`);
        
        const ragResult = await KnowledgeService.askQuestion(
            '00000000-0000-0000-0000-000000000001', // Use the seeded regional officer ID from test_phase1
            userQuestion
        );

        console.log('\n================ RAG RESPONSE ================');
        console.log('ANSWER:');
        console.log(ragResult.answer);
        console.log('\nREASONING PROCESS:');
        console.log(ragResult.reasoning);
        console.log('\nVISUAL CITATIONS & GRAPHICS:');
        console.log(JSON.stringify(ragResult.visuals, null, 2));
        console.log('\nCITATIONS & CONTEXT ITEMS USED:', ragResult.contextUsed.length);
        console.log('==============================================');

        console.log('\n✅ --- FAO RAG PIPELINE VERIFICATION SUCCESSFUL ---');
    } catch (error: any) {
        logger.error('❌ FAO RAG Pipeline Verification Failed:', error);
        process.exit(1);
    }
}

testFaoRAG();
