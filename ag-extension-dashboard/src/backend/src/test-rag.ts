/* eslint-disable @typescript-eslint/no-explicit-any */
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';
import { initializeDatabase } from '@/services/databaseService';
import { VectorService } from '@/services/vectorService';
import { KnowledgeService } from '@/services/knowledgeService';

import { mockKnowledgeArticles } from '@/routes/knowledge';


async function testRAG() {
    console.log('--- Starting RAG Verification ---');
    
    // Initialize services
    AIProviderFactory.initialize();
    await initializeDatabase();
    
    // Seed vector store
    console.log('\n1. Seeding Vector Store...');
    await VectorService.seedKnowledge(mockKnowledgeArticles);
    console.log('Seeding complete.');
    
    try {
        console.log('\n2. Testing Vector Search (Query: "maize diseases")...');
        const searchResults = await KnowledgeService.searchKnowledge('maize diseases', 2);
        searchResults.forEach((res: any, i) => {
            console.log(`[Result ${i+1}] ${res.id}: ${(res.content || '').substring(0, 50)}... (Score: ${res.score?.toFixed(4) || 'N/A'})`);
        });
        
        console.log('\n3. Testing RAG Answer (Reasoning)...');
        const ragResult = await KnowledgeService.askQuestion('test-user', 'What are common maize diseases and how to prevent them?');
        console.log('Answer:', ragResult.answer);
        console.log('Visuals:', JSON.stringify(ragResult.visuals, null, 2));
        console.log('Context Items Used:', ragResult.contextUsed.length);
        
        console.log('\n--- RAG Verification Complete ---');
    } catch (error) {
        console.error('RAG Verification Failed:', error);
    }
}

testRAG();
