import dotenv from 'dotenv';
import path from 'path';

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { OmniRouteService } from '../services/omniRouteService';

async function runLiveTropicalQueryTest() {
  console.log('--------------------------------------------------');
  console.log('🌾 Testing Live Tropical Agricultural AI Query via OmniRoute / AIHubMix');
  console.log('--------------------------------------------------');
  console.log(`Using AIHUBMIX_API_KEY: ${process.env.AIHUBMIX_API_KEY ? 'CONFIGURED ✅' : 'MISSING ❌'}`);

  const tropicalMessages = [
    {
      role: 'system',
      content:
        'You are an expert tropical agronomist specializing in cassava, maize, legumes, and tropical crop disease management.',
    },
    {
      role: 'user',
      content:
        'My cassava crop leaves show distinct yellow mosaic patterns, leaf distortion, and stunted stem growth in a humid tropical climate. What disease is this, how is it transmitted, and what are the top 3 recommended integrated pest management (IPM) measures?',
    },
  ];

  try {
    console.log('\nSending query to OmniRoute LLM engine...');
    const result = await OmniRouteService.executeWithFailover(tropicalMessages);

    console.log('\n✅ AI DIAGNOSTIC RESPONSE RECEIVED:');
    console.log(`Provider Used: ${result.providerUsed}`);
    console.log(`Model Used: ${result.modelUsed}`);
    console.log('--------------------------------------------------');
    console.log(result.text);
    console.log('--------------------------------------------------');
  } catch (error) {
    console.error('❌ Error executing live query:', error);
  }
}

runLiveTropicalQueryTest();
