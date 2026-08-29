import axios from 'axios';
import { logger } from '@/utils/logger';

export interface ScrapedTrend {
    topic: string;
    velocity: number;
    sentiment: string;
    keywords: string[];
    summary?: string;
    url?: string;
}

export class StealthScraperService {
    private static AGENT_URL = process.env.AGENT_ZERO_URL || 'http://ag-agent-zero:8000';

    /**
     * Executes a stealth scrape via the Python Agent Zero.
     */
    static async scrapeKnowledge(niche: string, platform: string, region: string): Promise<ScrapedTrend[]> {
        const agentToken = process.env.AGENT_ZERO_TOKEN;
        if (!agentToken) {
            logger.warn('Stealth scrape aborted: AGENT_ZERO_TOKEN is not configured');
            return [];
        }

        try {
            logger.info(`Triggering stealth scrape for niche: "${niche}" on platform: "${platform}" in region: "${region}"`);
            
            const response = await axios.post(
                `${this.AGENT_URL}/api/execute`,
                {
                    task_type: "stealth_scrape",
                    parameters: {
                        niche,
                        platform,
                        region
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${agentToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000 // Stealth scrapes might take a little time
                }
            );

            if (response.data && response.data.success) {
                return response.data.results as ScrapedTrend[];
            } else {
                logger.warn(`Stealth scrape failed or returned no success: ${JSON.stringify(response.data)}`);
                return [];
            }
        } catch (error) {
            logger.error(`Error executing stealth scrape: ${error instanceof Error ? error.message : "Unknown error"}`);
            return [];
        }
    }
}
