import { AIProviderFactory, AIRouter } from '@/services/aiProvider/aiProvider';


async function testALFA() {
    console.log('--- Starting ALFA Layer Verification ---');
    
    // Initialize factory (manually for test)
    AIProviderFactory.initialize();
    
    try {
        console.log('\n1. Testing Primary Provider (Azure OpenAI Mock)...');
        const primaryResult = await AIRouter.routeRequest('generate', {
            prompt: 'Test prompt for primary provider',
            options: { temperature: 0.1 }
        });
        console.log('Result:', primaryResult.text);
        console.log('Provider:', primaryResult.model);
        
        console.log('\n2. Testing Embedding (Azure OpenAI Mock)...');
        const embeddingResult = await AIRouter.routeRequest('embed', {
            text: 'Test embedding text'
        });
        console.log('Embedding size:', embeddingResult.embedding.length);
        
        console.log('\n3. Testing Reasoning (Analysis)...');
        const reasoningResult = await AIRouter.routeRequest('reason', {
            context: 'Maize is a major staple crop.',
            query: 'What are common maize pests?'
        });
        console.log('Answer:', reasoningResult.answer);
        console.log('Confidence:', reasoningResult.confidence);
        
        console.log('\n--- ALFA Layer Verification Complete ---');
    } catch (error) {
        console.error('ALFA Verification Failed:', error);
    }
}

testALFA();
