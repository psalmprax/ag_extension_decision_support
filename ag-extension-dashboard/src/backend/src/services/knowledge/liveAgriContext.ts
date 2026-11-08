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
                content: `FAO production anomalies for ${region} (not confirmed pest outbreaks; crop: ${crop || 'All'}):\n${alerts.map((a: DiseaseAlert) => `- ${a.title}: ${a.description}`).join('\n')}`,
                metadata: { title: `FAO Production Anomalies (${region})`, category: 'Production Statistics', crop: crop || 'All', source: 'FAOSTAT API', sourceUrl: 'https://www.fao.org/faostat/en/', contentType: 'text' },
                score: 1.0
            };
        }
    } catch (err) { logger.warn('Failed to fetch FAO alerts in askQuestion:', err); }
    return null;
}

async function fetchNasaAgroclimateContext(queryCategories: string[], lat: number | undefined, lng: number | undefined, crop: string | undefined): Promise<SearchResult | null> {
    if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
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
    if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
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

function priceContextResults(prices: MarketPrice[], country: string, crop?: string): SearchResult[] {
    const faostatPrices = prices.filter(p => p.source === 'faostat_producer_prices' || p.source === 'giews_fpma');
    const otherPrices = prices.filter(p => p.source !== 'faostat_producer_prices' && p.source !== 'giews_fpma');
    return [otherPrices, faostatPrices].flatMap((group, index) => group.length ? [{
        id: `live-market-prices-${index}-${Date.now()}`,
        content: `Reported price snapshots for ${country} (not a current local retail or farm-gate quote):\n${group.map((p: MarketPrice) => `- ${p.crop}: ${p.price}; source: ${p.source}; fetched: ${p.fetchedAt}`).join('\n')}`,
        metadata: { title: `Reported Price Snapshots (${country})`, country, category: 'Market Prices', crop: crop || 'All', contentType: 'text', ...(index === 1 ? { source: 'FAOSTAT API' } : {}) },
        score: 1.0,
    }] : []);
}

async function fetchMarketPricesContext(queryCategories: string[], crop: string | undefined, country?: string): Promise<SearchResult[]> {
    if (queryCategories.length > 0 && !queryCategories.includes('market_prices')) return [];
    if (!country) return [];
    try {
        const { marketPriceService } = await import('@/services/marketPriceService');
        const prices = (await marketPriceService.getLatestPrices(undefined, country))
            .filter(price => price.dataStatus === 'live');
        if (prices && prices.length > 0) {
            const relevantPrices = crop ? prices.filter((p: MarketPrice) => p.crop.toLowerCase().includes(crop.toLowerCase())) : prices;
            const priceList = relevantPrices.length > 0 ? relevantPrices : prices;
            return priceContextResults(priceList, country, crop);
        }
    } catch (err) { logger.warn('Failed to fetch market prices in askQuestion:', err); }
    return [];
}

export async function fetchLiveAgriContext(
    queryCategories: string[],
    location: UserLocation
): Promise<SearchResult[]> {
    const tasks: Array<Promise<SearchResult | SearchResult[] | null>> = [
        fetchWeatherContext(queryCategories, location.location, location.crop),
        fetchFAOAlertsContext(queryCategories, location.region, location.crop),
        fetchNasaAgroclimateContext(queryCategories, location.lat, location.lng, location.crop),
        fetchSoilPropertiesContext(queryCategories, location.lat, location.lng, location.crop),
        fetchMarketPricesContext(queryCategories, location.crop, location.country)
    ];

    const results = await Promise.all(tasks);
    return results.flatMap(result => result === null ? [] : Array.isArray(result) ? result : [result]);
}
