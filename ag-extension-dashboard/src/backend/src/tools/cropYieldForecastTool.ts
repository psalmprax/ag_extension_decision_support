/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';
import { Tool } from './types';
import { WeatherService } from '@/services/weatherService';

const cropYieldForecastSchema = z.object({
  crop: z.string().describe('Crop type (e.g., maize, wheat, rice, coffee)'),
  region: z.string().describe('Geographic region or location'),
  areaHectares: z.number().optional().describe('Planted area in hectares'),
  plantingDate: z.string().optional().describe('Planting date (YYYY-MM-DD)'),
  expectedHarvestDate: z.string().optional().describe('Expected harvest date (YYYY-MM-DD)'),
});

function getCropCoefficients(crop: string) {
  const cropCoefficients: Record<string, { baseYield: number; weatherFactor: number; growthDays: number }> = {
    maize: { baseYield: 4.5, weatherFactor: 0.15, growthDays: 120 },
    wheat: { baseYield: 3.2, weatherFactor: 0.12, growthDays: 110 },
    rice: { baseYield: 5.8, weatherFactor: 0.18, growthDays: 140 },
    coffee: { baseYield: 1.2, weatherFactor: 0.10, growthDays: 270 },
    beans: { baseYield: 1.5, weatherFactor: 0.14, growthDays: 90 },
    sorghum: { baseYield: 2.0, weatherFactor: 0.08, growthDays: 100 },
    cassava: { baseYield: 12.0, weatherFactor: 0.06, growthDays: 240 },
    potatoes: { baseYield: 18.0, weatherFactor: 0.13, growthDays: 90 },
    tomatoes: { baseYield: 40.0, weatherFactor: 0.16, growthDays: 75 },
    cotton: { baseYield: 2.5, weatherFactor: 0.11, growthDays: 160 },
  };

  return cropCoefficients[crop.toLowerCase()] || { baseYield: 3.0, weatherFactor: 0.12, growthDays: 120 };
}

function calculateWeatherScore(weather: Record<string, any> | null, crop: string): number {
  if (!weather) return 0.5;

  const temp = weather.temperature || weather.temp;
  const humidity = weather.humidity;
  const rain = weather.forecast?.reduce((sum: number, _d: Record<string, any>) => sum + 0, 0) || 0;
  
  const tempOptimal = crop.toLowerCase() === 'rice' ? (temp >= 20 && temp <= 35) : (temp >= 15 && temp <= 30);
  const humidityOptimal = humidity >= 40 && humidity <= 80;
  const rainAdequate = rain > 0;

  const tempScore = tempOptimal ? 0.4 : 0.1;
  const humidityScore = humidityOptimal ? 0.3 : 0.1;
  const rainScore = rainAdequate ? 0.3 : 0.1;
  return tempScore + humidityScore + rainScore;
}

export const cropYieldForecastTool: Tool<typeof cropYieldForecastSchema> = {
  name: 'crop_yield_forecast',
  description: 'Predicts crop yield and agricultural output using weather patterns, historical data, and growth stage analysis. Use when forecasting production, estimating harvest volumes, or planning agricultural output.',
  schema: cropYieldForecastSchema,
  execute: async ({ crop, region, areaHectares, plantingDate, expectedHarvestDate }) => {
    try {
      const weather = await WeatherService.getByLocation(region);
      
      const cropData = getCropCoefficients(crop);
      const weatherScore = calculateWeatherScore(weather, crop);

      const adjustedYieldPerHectare = cropData.baseYield * (0.5 + weatherScore * cropData.weatherFactor * 5);
      const totalYield = areaHectares ? adjustedYieldPerHectare * areaHectares : adjustedYieldPerHectare;

      const growthStage = estimateGrowthStage(crop, plantingDate, cropData.growthDays);

      const forecast = {
        crop,
        region,
        estimatedYieldPerHectare: Math.round(adjustedYieldPerHectare * 100) / 100,
        totalEstimatedYield: areaHectares ? Math.round(totalYield * 100) / 100 : null,
        unit: 'tonnes',
        areaHectares: areaHectares || null,
        confidence: Math.round(weatherScore * 100),
        weatherScore: Math.round(weatherScore * 100) / 100,
        currentGrowthStage: growthStage,
        expectedHarvestDate: expectedHarvestDate || estimateHarvestDate(plantingDate, cropData.growthDays),
        riskFactors: generateRiskFactors(weatherScore, crop, region),
        recommendations: generateRecommendations(weatherScore, crop, growthStage),
        generatedAt: new Date().toISOString(),
      };

      return JSON.stringify(forecast, null, 2);
    } catch (error) {
      return JSON.stringify({
        error: 'Forecast generation failed',
        details: error instanceof Error ? error.message : String(error),
      });
    }
  },
};

function estimateGrowthStage(crop: string, plantingDate?: string, growthDays?: number): string {
  if (!plantingDate) return 'unknown — no planting date provided';
  
  const planted = new Date(plantingDate);
  const now = new Date();
  const daysSincePlanting = Math.floor((now.getTime() - planted.getTime()) / (1000 * 60 * 60 * 24));
  const totalDays = growthDays || 120;
  const progress = daysSincePlanting / totalDays;

  if (progress < 0) return 'not yet planted';
  if (progress < 0.15) return 'germination';
  if (progress < 0.30) return 'seedling';
  if (progress < 0.50) return 'vegetative growth';
  if (progress < 0.70) return 'flowering/reproductive';
  if (progress < 0.90) return 'grain/fruit filling';
  if (progress < 1.0) return 'maturation';
  return 'ready for harvest';
}

function estimateHarvestDate(plantingDate?: string, growthDays?: number): string | null {
  if (!plantingDate) return null;
  const planted = new Date(plantingDate);
  const harvest = new Date(planted.getTime() + (growthDays || 120) * 24 * 60 * 60 * 1000);
  return harvest.toISOString().split('T')[0];
}

function generateRiskFactors(weatherScore: number, crop: string, region: string): string[] {
  const risks: string[] = [];
  if (weatherScore < 0.4) risks.push('Unfavorable weather conditions may reduce yield by 20-40%');
  if (weatherScore < 0.6) risks.push('Moderate weather risk — monitor conditions closely');
  if (['maize', 'wheat'].includes(crop.toLowerCase())) risks.push('Susceptible to pest outbreaks during vegetative stage');
  if (crop.toLowerCase() === 'rice') risks.push('Water management critical — ensure adequate irrigation');
  risks.push(`Regional conditions in ${region} may affect actual yield`);
  return risks;
}

function generateRecommendations(weatherScore: number, crop: string, growthStage: string): string[] {
  const recs: string[] = [];
  if (weatherScore < 0.5) {
    recs.push('Consider supplemental irrigation to offset weather deficit');
    recs.push('Apply protective fungicide as preventive measure');
  }
  if (growthStage.includes('vegetative')) {
    recs.push('Apply nitrogen fertilizer to support vegetative growth');
    recs.push('Monitor for early signs of pest infestation');
  }
  if (growthStage.includes('flowering')) {
    recs.push('Ensure adequate pollination conditions');
    recs.push('Avoid pesticide application during flowering');
  }
  if (growthStage.includes('maturation') || growthStage.includes('harvest')) {
    recs.push('Plan harvest logistics and storage facilities');
    recs.push('Monitor moisture content for optimal harvest timing');
  }
  if (recs.length === 0) recs.push('Continue standard crop management practices');
  return recs;
}
