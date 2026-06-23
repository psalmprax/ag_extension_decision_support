/* eslint-disable @typescript-eslint/no-explicit-any */
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

    private async calculateDiseaseScore(farmer: Record<string, any>): Promise<{ score: number; relevantAlerts: Record<string, any>[] }> {
        let score = 0;
        let relevantAlerts: Record<string, any>[] = [];
        try {
            const region = farmer.region || 'Kenya';
            const alerts = await FAOService.getDiseaseAlerts(region);
            const farmerCrops = Array.isArray(farmer.crops) ? farmer.crops : [];
            relevantAlerts = alerts.filter(a => 
                a.crop && farmerCrops.some((c: string) => a.crop.toLowerCase().includes(c.toLowerCase()))
            );
            score = Math.min(relevantAlerts.length * 25, 100);
        } catch (err) {
            logger.error(`Failed to process disease alerts for farmer ${farmer.id}:`, err);
        }
        return { score, relevantAlerts };
    }

    private async calculateWeatherScore(farmer: Record<string, any>, reasons: string[]): Promise<number> {
        let score = 0;
        try {
            const location = farmer.village || farmer.region || 'Kenya';
            const weather = await WeatherService.getByLocation(`${location}, Kenya`);
            const riskConditions = ['Thunderstorm', 'Heavy rain', 'Violent rain showers', 'Thunderstorm with hail'];
            
            if (weather && weather.condition) {
                if (riskConditions.includes(weather.condition)) {
                    score = 100;
                    reasons.push(`Extreme weather detected: ${weather.condition}`);
                } else if (weather.condition.toLowerCase().includes('rain')) {
                    score = 50;
                    reasons.push(`Moderate weather risk: ${weather.condition}`);
                }
            }
        } catch (err) {
            logger.warn(`Could not fetch weather for priority calculation: ${err}`);
        }
        return score;
    }

    private calculateRecencyScore(farmer: Record<string, any>, reasons: string[]): number {
        const lastVisit = farmer.visits?.[0];
        if (!lastVisit) {
            reasons.push('No recorded visits - initial assessment required');
            return 100; // Never visited
        }
        
        const daysSinceVisit = Math.floor((Date.now() - new Date(lastVisit.completedAt!).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceVisit > 30) {
            reasons.push(`Overdue for visit (${daysSinceVisit} days since last visit)`);
            return Math.min((daysSinceVisit - 30) * 2, 100);
        }
        return 0;
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

            const reasons: string[] = [];

            // 1. Disease Alerts Signal (Weight: 40%)
            const { score: diseaseScore, relevantAlerts } = await this.calculateDiseaseScore(farmer);
            const diseaseWeight = 0.4;
            relevantAlerts.forEach(a => reasons.push(`Active ${a.severity} alert: ${a.title}`));

            // 2. Weather Risk Signal (Weight: 30%)
            const weatherScore = await this.calculateWeatherScore(farmer, reasons);
            const weatherWeight = 0.3;

            // 3. Visit Recency Signal (Weight: 20%)
            const recencyScore = this.calculateRecencyScore(farmer, reasons);
            const recencyWeight = 0.2;

            // 4. Vital Score Signal (Weight: 10%)
            const vitalScoreValue = farmer.vitalScore ? Number(farmer.vitalScore) : 70;
            const vitalScoreMetric = Math.max(0, 100 - vitalScoreValue);
            if (vitalScoreValue < 50) {
                reasons.push(`Low farm health recorded (Vital Score: ${vitalScoreValue}%)`);
            }
            const vitalWeight = 0.1;

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
