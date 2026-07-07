import { AgentOrchestrator } from './agentOrchestrator';
import { AIProviderFactory } from './aiProvider/aiProvider';
import { logger } from '../utils/logger';
import { notificationService } from './notificationService';
import { tavilyService } from './tavilyService';

export interface SocialMediaPost {
    platform: 'twitter' | 'reddit' | 'youtube';
    content: string;
    timestamp: string;
    author: string;
    url: string;
}

export class SocialIntelligenceAgent {
    public readonly agentId = 'agent_social_intel';

    constructor() {
        this.register();
    }

    private register() {
        AgentOrchestrator.getInstance().registerAgent({
            agentId: this.agentId,
            name: 'Social Intelligence Agent',
            capabilities: ['social_monitoring', 'sentiment_analysis', 'trend_detection'],
            maxConcurrentTasks: 3
        });
    }

    /**
     * Start a monitoring pipeline that fetches data from platforms, analyzes them via LLM,
     * and sets up alerts for trending topics.
     */
    async executeMonitoringPipeline() {
        try {
            logger.info('Starting Social Intelligence monitoring pipeline...');
            
            // 1. Fetch mock data (simulating scraping Twitter/Reddit/YouTube)
            const posts = await this.fetchRecentPosts();
            
            // 2. Evaluate data quality & relevance
            const relevantPosts = await this.evaluateDataReliability(posts);
            
            // 3. Analyze for emerging patterns
            const analysisResult = await this.analyzeTrends(relevantPosts);
            
            // 4. Dispatch alerts for critical findings
            if (analysisResult.hasCriticalAlerts) {
                await this.dispatchAlerts(analysisResult.summary);
            }

            logger.info('Completed Social Intelligence monitoring pipeline.');
            return analysisResult;
        } catch (error) {
            logger.error('Error in Social Intelligence pipeline:', error);
            throw error;
        }
    }

    private async fetchRecentPosts(): Promise<SocialMediaPost[]> {
        if (!tavilyService.isConfigured()) {
            logger.warn('Tavily is not configured. Falling back to mock data for social intelligence.');
            return [
                { platform: 'twitter', content: 'Farmers in Rift Valley are reporting a new type of fall armyworm that resists usual pesticides.', timestamp: new Date().toISOString(), author: '@AgriKen', url: 'https://twitter.com/AgriKen/status/123' },
                { platform: 'reddit', content: 'Did anyone hear about the new fertilizer subsidies announced today?', timestamp: new Date().toISOString(), author: 'u/farmer_joe', url: 'https://reddit.com/r/farming/123' },
            ];
        }

        const queries = [
            'site:twitter.com "maize prices" OR "crop disease" OR "fall armyworm" Kenya',
            'site:reddit.com/r/farming OR /r/agriculture "new pest" OR "crop disease" OR "yield"'
        ];

        const posts: SocialMediaPost[] = [];

        for (const query of queries) {
            const result = await tavilyService.search(query, 5);
            if (result && result.results) {
                result.results.forEach(r => {
                    let platform: 'twitter' | 'reddit' | 'youtube' = 'twitter';
                    if (r.url.includes('reddit.com')) platform = 'reddit';
                    else if (r.url.includes('youtube.com')) platform = 'youtube';

                    posts.push({
                        platform,
                        content: r.content,
                        timestamp: new Date().toISOString(),
                        author: 'Unknown (via Web Search)',
                        url: r.url
                    });
                });
            }
        }

        return posts;
    }

    private async evaluateDataReliability(posts: SocialMediaPost[]): Promise<SocialMediaPost[]> {
        // In a real scenario, this would use a fast LLM or heuristic to filter out spam or unreliable sources.
        return posts.filter(post => post.content.length > 20); // Simple mock filter
    }

    private async analyzeTrends(posts: SocialMediaPost[]) {
        const provider = await AIProviderFactory.getPrimaryProvider();
        
        const prompt = `
            Analyze the following social media posts from agricultural communities.
            Identify any emerging patterns across the following categories:
            1. Emerging pest/disease reports
            2. Agricultural policy/regulation changes
            3. Market sentiment and crop price discussions
            4. Weather event impact reports

            Posts:
            ${JSON.stringify(posts, null, 2)}
            
            Provide a JSON output with the following format:
            {
              "summary": "String detailing the main findings",
              "hasCriticalAlerts": boolean (true if there are urgent pests, extreme weather, or drastic price drops),
              "categories": { "pests": [], "policy": [], "market": [], "weather": [] }
            }
        `;

        try {
            const response = await provider.generateText(prompt);
            if (!response.text) {
                throw new Error('Empty response from AI provider');
            }
            // Assuming the LLM returns a valid JSON structure
            const cleanedText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanedText);
            return result;
        } catch (e) {
            logger.warn('Failed to parse AI trend analysis, returning fallback', e);
            return { summary: 'Error analyzing trends.', hasCriticalAlerts: false };
        }
    }

    private async dispatchAlerts(summary: string) {
        logger.warn('ALERT: Critical social intelligence findings detected.');
        await notificationService.send({
            userId: 'admin', // Dispatch to system admins/extension officers
            type: 'warning',
            title: 'Critical Social Trend Alert',
            message: summary,
            channel: 'in_app',
            metadata: { source: 'SocialIntelligenceAgent' }
        });
    }
}

// Instantiate to register with Orchestrator
export const socialIntelligenceAgent = new SocialIntelligenceAgent();
