import { z } from 'zod';
import { Tool } from './types';
import { tavilyService } from '@/services/tavilyService';
import { FAOService } from '@/services/faoService';
import { WeatherService } from '@/services/weatherService';
import { AIProviderFactory } from '@/services/aiProvider/aiProvider';
import { logger } from '@/utils/logger';

const deepResearchSchema = z.object({
  topic: z.string().describe('Research topic or question'),
  depth: z.enum(['quick', 'standard', 'deep']).default('standard').describe('Research depth level'),
  focus: z.string().optional().describe('Specific focus area (e.g., disease, market, policy)'),
  region: z.string().optional().describe('Geographic region of interest'),
});

async function fetchTavilyResults(topic: string, depth: string, results: Array<{ source: string; data: string }>) {
  let searchDepthCount = 3;
  if (depth === 'deep') searchDepthCount = 10;
  else if (depth === 'standard') searchDepthCount = 5;
  const tavilyResults = await tavilyService.search(topic, searchDepthCount);
  if (tavilyResults) {
    results.push({
      source: 'tavily_web_search',
      data: JSON.stringify(tavilyResults.results?.slice(0, 5).map((r: { title?: string; url?: string; content?: string }) => ({
        title: r.title,
        url: r.url,
        snippet: r.content,
      })) || []),
    });
  }
}

async function fetchFaoAlerts(region: string | undefined, focus: string | undefined, results: Array<{ source: string; data: string }>) {
  if (region || focus?.toLowerCase().includes('disease')) {
    const faoAlerts = await FAOService.getDiseaseAlerts(region || 'global', focus || '');
    if (faoAlerts && faoAlerts.length > 0) {
      results.push({
        source: 'fao_disease_alerts',
        data: JSON.stringify(faoAlerts),
      });
    }
  }
}

async function fetchWeatherContext(region: string | undefined, results: Array<{ source: string; data: string }>) {
  if (region) {
    const weather = await WeatherService.getByLocation(region);
    if (weather) {
      results.push({
        source: 'weather_context',
        data: JSON.stringify(weather),
      });
    }
  }
}

export const deepResearchTool: Tool<typeof deepResearchSchema> = {
  name: 'deep_agricultural_research',
  description: 'Conducts multi-source deep research combining web search, FAO data, weather analysis, and AI synthesis. Use for complex agricultural questions requiring systematic analysis across multiple data sources.',
  schema: deepResearchSchema,
  execute: async ({ topic, depth, focus, region }) => {
    try {
      const results: Array<{ source: string; data: string }> = [];

      await fetchTavilyResults(topic, depth, results);
      await fetchFaoAlerts(region, focus, results);
      await fetchWeatherContext(region, results);

      // Source 4: AI synthesis
      const synthesisPrompt = `Synthesize the following research data on "${topic}" into a comprehensive agricultural analysis.

Research Data:
${results.map(r => `--- ${r.source} ---\n${r.data}`).join('\n\n')}

Provide:
1. Executive Summary (2-3 sentences)
2. Key Findings (bullet points)
3. Risk Assessment (if applicable)
4. Actionable Recommendations
5. Sources consulted`;

      const provider = await AIProviderFactory.getProvider('groq');
      const synthesis = await provider.generateText([
        { role: 'system', content: 'You are an agricultural research analyst. Synthesize multi-source data into clear, actionable insights.' },
        { role: 'user', content: synthesisPrompt }
      ], { maxTokens: 3000, temperature: 0.3 });

      const researchReport = {
        topic,
        depth,
        focus: focus || null,
        region: region || null,
        sourcesConsulted: results.map(r => r.source),
        sourceCount: results.length,
        synthesis: synthesis.text,
        rawSources: results,
        generatedAt: new Date().toISOString(),
      };

      logger.info(`Deep research completed: "${topic}" — ${results.length} sources consulted`);
      return JSON.stringify(researchReport, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: 'Deep research failed',
        details: error instanceof Error ? error.message : String(error),
        topic,
      });
    }
  },
};
