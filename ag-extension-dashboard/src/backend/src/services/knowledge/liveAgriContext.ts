import type { SearchResult } from '@/services/vectorService';
import { logger } from '@/utils/logger';
import type { UserLocation } from '@/services/knowledge/userContext';
import type { DiseaseAlert } from '@/services/faoService';
import type { MarketPrice } from '@/services/marketPriceService';

/**
 * Live agricultural context: weather, FAO alerts, NASA agroclimate,
 * SoilGrids properties, and market prices. Each source is category-gated
 * so unrelated queries pay no latency cost.
 */

async function fetchWeatherContext(queryCategories: string[], location?: string, crop?: string): Promise<SearchResult | null> {
    if (!location) return null;
    if (queryCategories.length > 0 && !queryCategories.includes('climate_and_weather')) return null;
    try {
        const { WeatherService } = await import('@/services/weatherService');
        const weather = await WeatherService.getByLocation(location);
        if (weather) {
            const temp = weather.temperature ?? weather.temp;
            const condition = weather.condition || 'Clear';
            const wind = weather.windSpeed;

            let forecastText = 'No forecast data';
            if (weather.forecast && Array.isArray(weather.forecast)) {
                forecastText = weather.forecast.map(f => `  - ${f.date}: Max ${f.maxTemp}°C, Min ${f.minTemp}°C, ${f.condition}`).join('\n');
            }

            return {
                id: `live-weather-${Date.now()}`,
                content: `Live Weather for ${location}:\n- Current Temp: ${temp !== undefined ? temp : 'N/A'}°C\n- Description: ${condition}\n- Wind Speed: ${wind !== undefined ? wind : 'N/A'} km/h\n- 3-Day Forecast:\n${forecastText}`,
                metadata: { title: `Live Weather Forecast for ${location}`, category: 'Weather Forecast', crop: crop || 'All', sourceUrl: 'https://open-meteo.com', contentType: 'text' },
                score: 1.0
            };
        }
    } catch (err) { logger.warn('Failed to fetch weather in askQuestion:', err); }
    return null;
}

async function fetchFAOAlertsContext(queryCategories: string[], region?: string, crop?: string): Promise<SearchResult | null> {
    if (!region) return null;
    if (queryCategories.length > 0 && !queryCategories.includes('pest_and_disease')) return null;
    try {
        const { FAOService } = await import('@/services/faoService');
        const alerts = await FAOService.getDiseaseAlerts(region, crop);
        if (alerts && alerts.length > 0) {
            return {
                id: `live-fao-alerts-${Date.now()}`,
                content: `FAO Disease Alerts for ${region} (Crop: ${crop || 'All'}):\n${alerts.map((a: DiseaseAlert) => `- [${a.severity.toUpperCase()}] ${a.title}: ${a.description}`).join('\n')}`,
                metadata: { title: `FAO Pest & Disease Alerts (${region})`, category: 'Disease Alerts', crop: crop || 'All', sourceUrl: 'https://www.fao.org', contentType: 'text' },
                score: 1.0
            };
        }
    } catch (err) { logger.warn('Failed to fetch FAO alerts in askQuestion:', err); }
    return null;
}

async function fetchNasaAgroclimateContext(queryCategories: string[], lat: number | undefined, lng: number | undefined, crop: string | undefined): Promise<SearchResult | null> {
    if (!lat || !lng) return null;
    if (queryCategories.length > 0 && !queryCategories.includes('agronomy_and_yield') && !queryCategories.includes('climate_and_weather')) return null;
    try {
        const { NasaPowerService } = await import('@/services/data/nasaPowerService');
        const nasa = new NasaPowerService();
        const agro = await nasa.getAgroclimateSummary(lat, lng, 7);
        if (agro) {
            const tempMin = agro.temperatureRange?.min ?? 'N/A';
            const tempMax = agro.temperatureRange?.max ?? 'N/A';
            const rh = agro.relativeHumidity ?? 'N/A';
            const precip = agro.precipitationSum ?? 'N/A';
            const solar = agro.solarRadiationAvg ?? 'N/A';
            return {
                id: `live-nasa-agro-${Date.now()}`,
                content: `NASA POWER Agroclimate Summary for lat: ${lat}, lng: ${lng}:\n- Temp Range: ${tempMin} to ${tempMax}°C\n- Avg Relative Humidity: ${rh}%\n- Precipitation Sum: ${precip} mm\n- Avg Solar Radiation: ${solar} MJ/m²/day`,
                metadata: { title: `Agroclimatic Solar & Rainfall Context (NASA POWER)`, category: 'Agroclimatology', crop: crop || 'All', sourceUrl: 'https://power.larc.nasa.gov/', contentType: 'text' },
                score: 1.0
            };
        }
    } catch (err) { logger.warn('Failed to fetch NASA agroclimate in askQuestion:', err); }
    return null;
}

async function fetchSoilPropertiesContext(queryCategories: string[], lat: number | undefined, lng: number | undefined, crop: string | undefined): Promise<SearchResult | null> {
    if (!lat || !lng) return null;
    if (queryCategories.length > 0 && !queryCategories.includes('agronomy_and_yield') && !queryCategories.includes('climate_and_weather')) return null;
    try {
        const { soilGridsService } = await import('@/services/data/soilGridsService');
        const soil = await soilGridsService.fetchSoilProperties(lat, lng);
        if (soil) {
            const ph = soil.ph ?? 'N/A';
            const clay = soil.clay ?? 'N/A';
            const soc = soil.organic_carbon_g_kg ?? 'N/A';
            return {
                id: `live-soil-properties-${Date.now()}`,
                content: `SoilGrids ISRIC Soil Properties for lat: ${lat}, lng: ${lng}:\n- pH at 0-5cm: ${ph}\n- Clay content: ${clay}%\n- Organic Carbon: ${soc} dg/kg`,
                metadata: { title: `Location-Specific Soil Properties (ISRIC SoilGrids)`, category: 'Soil Properties', crop: crop || 'All', sourceUrl: 'https://soilgrids.org/', contentType: 'text' },
                score: 1.0
            };
        }
    } catch (err) { logger.warn('Failed to fetch SoilGrids in askQuestion:', err); }
    return null;
}

async function fetchMarketPricesContext(queryCategories: string[], crop: string | undefined): Promise<SearchResult | null> {
    if (queryCategories.length > 0 && !queryCategories.includes('market_prices')) return null;
    try {
        const { marketPriceService } = await import('@/services/marketPriceService');
        const prices = await marketPriceService.getLatestPrices();
        if (prices && prices.length > 0) {
            const relevantPrices = crop ? prices.filter((p: MarketPrice) => p.crop.toLowerCase().includes(crop.toLowerCase())) : prices;
            const priceList = relevantPrices.length > 0 ? relevantPrices : prices;
            return {
                id: `live-market-prices-${Date.now()}`,
                content: `Latest Market Prices:\n${priceList.map((p: MarketPrice) => `- ${p.crop}: ${p.price} (${p.trend})`).join('\n')}`,
                metadata: { title: 'Latest Market Prices Context', category: 'Market Prices', crop: crop || 'All', sourceUrl: 'https://www.ratin.net', contentType: 'text' },
                score: 1.0
            };
        }
    } catch (err) { logger.warn('Failed to fetch market prices in askQuestion:', err); }
    return null;
}

export async function fetchLiveAgriContext(
    queryCategories: string[],
    location: UserLocation
): Promise<SearchResult[]> {
    const tasks: Array<Promise<SearchResult | null>> = [
        fetchWeatherContext(queryCategories, location.location, location.crop),
        fetchFAOAlertsContext(queryCategories, location.region, location.crop),
        fetchNasaAgroclimateContext(queryCategories, location.lat, location.lng, location.crop),
        fetchSoilPropertiesContext(queryCategories, location.lat, location.lng, location.crop),
        fetchMarketPricesContext(queryCategories, location.crop)
    ];

    const results = await Promise.all(tasks);
    return results.filter((r): r is SearchResult => r !== null);
}
