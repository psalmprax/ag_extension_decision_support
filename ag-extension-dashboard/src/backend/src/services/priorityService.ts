import { PrismaClient } from '@prisma/client';
import { getPrisma } from './prismaService';
import { FAOService } from './faoService';
import { WeatherService } from './weatherService';
import { logger } from '@/utils/logger';

export interface PriorityScore {
    farmerId: string;
    score: number; // 0-100
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: {
        diseaseAlerts: number;
        weatherRisk: number;
        visitRecency: number;
        vitalScore: number;
    };
    reasons: string[];
    recommendedAction: string;
}

export class PriorityService {
    private prisma: PrismaClient;

    constructor() {
        this.prisma = getPrisma();
    }

    /**
     * Calculate a comprehensive urgency score for a farmer
     */
    async calculateUrgencyScore(farmerId: string): Promise<PriorityScore> {
        try {
            const farmer = await this.prisma.farmer.findUnique({
                where: { id: farmerId },
                include: {
                    visits: {
                        where: { status: 'completed' },
                        orderBy: { completedAt: 'desc' },
                        take: 1
                    }
                }
            });

            if (!farmer) {
                logger.warn(`Farmer ${farmerId} not found during priority calculation`);
                throw new Error(`Farmer ${farmerId} not found`);
            }

            // 1. Disease Alerts Signal (Weight: 40%) - Robust check for crops
            let diseaseScore = 0;
            let relevantAlerts: any[] = [];
            
            try {
                const region = farmer.region || 'Kenya';
                const alerts = await FAOService.getDiseaseAlerts(region);
                
                // Ensure farmer.crops is an array and handle case-insensitive matching safely
                const farmerCrops = Array.isArray(farmer.crops) ? farmer.crops : [];
                
                relevantAlerts = alerts.filter(a => 
                    a.crop && farmerCrops.some(c => a.crop.toLowerCase().includes(c.toLowerCase()))
                );
                
                diseaseScore = Math.min(relevantAlerts.length * 25, 100);
            } catch (err) {
                logger.error(`Failed to process disease alerts for farmer ${farmerId}:`, err);
            }
            const diseaseWeight = 0.4;

            // 2. Weather Risk Signal (Weight: 30%)
            let weatherScore = 0;
            const reasons: string[] = [];
            
            try {
                const location = farmer.village || farmer.region || 'Kenya';
                const weather = await WeatherService.getByLocation(`${location}, Kenya`);
                const riskConditions = ['Thunderstorm', 'Heavy rain', 'Violent rain showers', 'Thunderstorm with hail'];
                
                if (weather && weather.condition) {
                    if (riskConditions.includes(weather.condition)) {
                        weatherScore = 100;
                        reasons.push(`Extreme weather detected: ${weather.condition}`);
                    } else if (weather.condition.toLowerCase().includes('rain')) {
                        weatherScore = 50;
                        reasons.push(`Moderate weather risk: ${weather.condition}`);
                    }
                }
            } catch (err) {
                logger.warn(`Could not fetch weather for priority calculation: ${err}`);
            }
            const weatherWeight = 0.3;

            // 3. Visit Recency Signal (Weight: 20%)
            let recencyScore = 0;
            const lastVisit = farmer.visits[0];
            if (!lastVisit) {
                recencyScore = 100; // Never visited
                reasons.push('No recorded visits - initial assessment required');
            } else {
                const daysSinceVisit = Math.floor((Date.now() - new Date(lastVisit.completedAt!).getTime()) / (1000 * 60 * 60 * 24));
                if (daysSinceVisit > 30) {
                    recencyScore = Math.min((daysSinceVisit - 30) * 2, 100);
                    reasons.push(`Overdue for visit (${daysSinceVisit} days since last visit)`);
                }
            }
            const recencyWeight = 0.2;

            // 4. Vital Score Signal (Weight: 10%)
            // Low vital score (health) increases priority
            const vitalScoreValue = farmer.vitalScore ? Number(farmer.vitalScore) : 70;
            const vitalScoreMetric = Math.max(0, 100 - vitalScoreValue);
            if (vitalScoreValue < 50) {
                reasons.push(`Low farm health recorded (Vital Score: ${vitalScoreValue}%)`);
            }
            const vitalWeight = 0.1;

            // Add disease reasons
            relevantAlerts.forEach(a => {
                reasons.push(`Active ${a.severity} alert: ${a.title}`);
            });

            // Calculate final weighted score
            const finalScore = Math.round(
                (diseaseScore * diseaseWeight) +
                (weatherScore * weatherWeight) +
                (recencyScore * recencyWeight) +
                (vitalScoreMetric * vitalWeight)
            );

            // Determine level
            let level: PriorityScore['level'] = 'low';
            if (finalScore >= 80) level = 'critical';
            else if (finalScore >= 60) level = 'high';
            else if (finalScore >= 30) level = 'medium';

            // Recommended Action
            let recommendedAction = 'Continue routine monitoring';
            if (level === 'critical') recommendedAction = 'Immediate emergency field visit required';
            else if (level === 'high') recommendedAction = 'Prioritize for visit within 48 hours';
            else if (level === 'medium') recommendedAction = 'Schedule follow-up call or visit this week';

            return {
                farmerId,
                score: finalScore,
                level,
                factors: {
                    diseaseAlerts: diseaseScore,
                    weatherRisk: weatherScore,
                    visitRecency: recencyScore,
                    vitalScore: vitalScoreMetric
                },
                reasons: reasons.length > 0 ? reasons : ['Stable environment'],
                recommendedAction
            };

        } catch (error) {
            logger.error(`Error calculating priority for farmer ${farmerId}:`, error);
            throw error;
        }
    }
}

export const priorityService = new PriorityService();
