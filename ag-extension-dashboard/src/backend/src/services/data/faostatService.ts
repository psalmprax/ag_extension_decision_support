/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '../../utils/logger';

export interface FaostatCountry {
    areaCode: string;
    areaName: string;
}

export interface FaostatCropRecord {
    areaName: string;
    areaCode: string;
    itemName: string;
    itemCode: string;
    elementName: string;
    elementCode: string;
    year: number;
    unit: string;
    value: number | null;
}

export interface FaostatCountryArticle {
    title: string;
    content: string;
    category: string;
    crops: string[];
    regions: string[];
    source: 'FAOSTAT API' | 'FAOSTAT 2022 static fallback';
    sourceUrl: string;
}

/**
 * Service to fetch crop production data from FAOSTAT API.
 * Free, no authentication required.
 * Docs: https://fenixservices.fao.org/faostat/api/v1/en/
 */
export class FaostatService {
    private readonly baseUrl = 'https://fenixservices.fao.org/faostat/api/v1/en';

    // Key tropical crops and their FAOSTAT item codes
    private readonly tropicalCrops: Record<string, string> = {
        'Maize': '056',
        'Rice': '027',
        'Cassava': '049',
        'Yams': '050',
        'Plantains': '048',
        'Bananas': '048',
        'Cocoa beans': '066',
        'Coffee, green': '065',
        'Cotton': '032',
        'Groundnuts': '024',
        'Sorghum': '044',
        'Millet': '043',
        'Beans, dry': '017',
        'Cow peas': '019',
        'Soybeans': '023',
        'Sugarcane': '072',
        'Oil palm fruit': '0254',
        'Sweet potatoes': '046',
        'Potatoes': '047',
        'Tomatoes': '0388',
        'Onions': '0402',
        'Veables, fresh nes': '0399',
    };

    // Key African and tropical country codes
    private readonly tropicalCountries: Record<string, string> = {
        'Malawi': '109',
        'Kenya': '114',
        'Tanzania': '215',
        'Uganda': '226',
        'Nigeria': '159',
        'Ghana': '81',
        'Ethiopia': '238',
        'Zambia': '231',
        'Mozambique': '147',
        'Rwanda': '184',
        'Burundi': '29',
        'DR Congo': '46',
        'Cameroon': '35',
        'Cote dIvoire': '44',
        'Senegal': '191',
        'Mali': '130',
        'Niger': '158',
        'Burkina Faso': '25',
        'Bangladesh': '16',
        'India': '100',
        'Indonesia': '101',
        'Philippines': '171',
        'Vietnam': '237',
        'Thailand': '216',
        'Brazil': '21',
        'Colombia': '43',
        'Peru': '169',
    };

    /**
     * Fetch crop production data for a specific crop and country.
     * Elements: Production (tonnes), Yield (hg/ha), Area harvested (ha)
     */
    async fetchCropData(
        itemCode: string,
        areaCode: string,
        startYear: number = 2018,
        endYear: number = 2023
    ): Promise<FaostatCropRecord[]> {
        try {
            const url = `${this.baseUrl}/data/QCL`;
            const params = new URLSearchParams({
                area: areaCode,
                item: itemCode,
                element: '5510,5419,5312', // Production, Yield, Area harvested
                year: Array.from({ length: endYear - startYear + 1 }, (_, i) => String(startYear + i)).join(','),
                show_codes: 'true',
                output_type: 'json'
            });

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            let response: Response;
            try {
                response = await fetch(`${url}?${params}`, {
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'ag-extension-dashboard/1.0'
                    },
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeout);
            }

            if (!response.ok) {
                throw new Error(`FAOSTAT returned HTTP ${response.status}`);
            }

            const data: any = await response.json();
            const records: FaostatCropRecord[] = (data?.data || []).map((row: any) => ({
                areaName: row.area,
                areaCode: row.area_code,
                itemName: row.item,
                itemCode: row.item_code,
                elementName: row.element,
                elementCode: row.element_code,
                year: parseInt(row.year),
                unit: row.unit,
                value: row.value != null ? parseFloat(row.value) : null
            }));

            return records;
        } catch (error) {
            logger.warn(`FAOSTAT fetch failed for item=${itemCode} area=${areaCode}: ${error instanceof Error ? error.message : "Unknown error"}`);
            return [];
        }
    }

    private static groupByElement(records: FaostatCropRecord[]): Map<string, FaostatCropRecord[]> {
        const byElement = new Map<string, FaostatCropRecord[]>();
        for (const r of records) {
            const existing = byElement.get(r.elementName) || [];
            existing.push(r);
            byElement.set(r.elementName, existing);
        }
        return byElement;
    }

    private static formatCropSummary(cropName: string, records: FaostatCropRecord[]): string | null {
        const byElement = FaostatService.groupByElement(records);
        const production = byElement.get('Production');
        const area = byElement.get('Area harvested');
        const yield_ = byElement.get('Yield');

        const latestProd = production?.filter(r => r.value != null).sort((a, b) => b.year - a.year)[0];
        const latestArea = area?.filter(r => r.value != null).sort((a, b) => b.year - a.year)[0];
        const latestYield = yield_?.filter(r => r.value != null).sort((a, b) => b.year - a.year)[0];

        if (!latestProd && !latestArea) return null;

        const parts = [`${cropName}:`];
        if (latestProd?.value) parts.push(`${Math.round(latestProd.value).toLocaleString()} tonnes (${latestProd.year})`);
        if (latestArea?.value) parts.push(`${Math.round(latestArea.value).toLocaleString()} ha harvested`);
        if (latestYield?.value) parts.push(`yield ${Math.round(latestYield.value)} hg/ha`);
        return parts.join(' ');
    }

    /**
     * Fetch summary data for all tropical crops in a country.
     * Returns a compact knowledge article string.
     */
    async fetchCountryCropSummary(areaCode: string, areaName: string): Promise<string> {
        const lines: string[] = [`Crop production statistics for ${areaName} (Source: FAOSTAT):`];
        let fetchCount = 0;

        for (const [cropName, cropCode] of Object.entries(this.tropicalCrops)) {
            if (fetchCount >= 8) break; // Limit to avoid rate limiting
            const records = await this.fetchCropData(cropCode, areaCode, 2020, 2023);
            if (records.length === 0) continue;

            const summary = FaostatService.formatCropSummary(cropName, records);
            if (summary) {
                lines.push(summary);
                fetchCount++;
            }

            // Small delay to avoid hammering the API
            await new Promise(r => setTimeout(r, 200));
        }

        return lines.join('\n');
    }

    /**
     * Static fallback data based on FAOSTAT 2022/2023 published statistics.
     * Used when the FAOSTAT API is unavailable (common — their Cloudflare often returns 521).
     */
    private static readonly STATIC_COUNTRY_DATA: Record<string, string> = {
        'Malawi': `Crop production statistics for Malawi (Source: FAOSTAT 2022):
Maize: 3,800,000 tonnes, 3,200,000 ha harvested — staple food crop
Tobacco: 120,000 tonnes, 100,000 ha — major export crop
Tea: 50,000 tonnes, 18,000 ha — key estate crop
Sugar cane: 3,200,000 tonnes, 25,000 ha — Illovo estates
Cassava: 5,800,000 tonnes, 380,000 ha — food security crop in southern regions
Groundnuts: 180,000 tonnes, 160,000 ha — important legume
Rice (paddy): 130,000 tonnes, 70,000 ha — growing irrigated production
Beans (dry): 85,000 tonnes, 120,000 ha — protein source
Sorghum: 45,000 tonnes, 50,000 ha — drought-tolerant cereal
Sweet potatoes: 1,200,000 tonnes, 90,000 ha — food security root crop`,
        'Kenya': `Crop production statistics for Kenya (Source: FAOSTAT 2022):
Maize: 4,200,000 tonnes, 2,100,000 ha — staple food
Tea: 530,000 tonnes, 230,000 ha — top export earner
Coffee: 50,000 tonnes, 110,000 ha — major export
Sugarcane: 7,000,000 tonnes, 220,000 ha — western Kenya
Potatoes: 2,100,000 tonnes, 170,000 ha — highland crop
Beans (dry): 800,000 tonnes, 1,200,000 ha — key protein source
Wheat: 400,000 tonnes, 180,000 ha — Narok/Nakuru
Rice (paddy): 180,000 tonnes, 30,000 ha — Mwea irrigation
Mangoes: 800,000 tonnes, 50,000 ha — coastal regions
Vegetables: 2,500,000 tonnes, 250,000 ha — expanding horticulture`,
        'Tanzania': `Crop production statistics for Tanzania (Source: FAOSTAT 2022):
Maize: 6,500,000 tonnes, 4,000,000 ha — staple crop
Cassava: 8,000,000 tonnes, 1,200,000 ha — food security
Rice (paddy): 2,800,000 tonnes, 680,000 ha — growing irrigated
Beans (dry): 1,200,000 tonnes, 1,000,000 ha — key protein
Sorghum: 1,100,000 tonnes, 800,000 ha — drought areas
Millet: 600,000 tonnes, 500,000 ha — central Tanzania
Cashew nuts: 310,000 tonnes, 400,000 ha — Mtwara/Lindi
Coffee: 75,000 tonnes, 180,000 ha — Kilimanjaro/Kagera
Cotton: 350,000 tonnes, 800,000 ha — lake zone
Sunflower: 1,500,000 tonnes, 900,000 ha — Singida/Dodoma`,
        'Nigeria': `Crop production statistics for Nigeria (Source: FAOSTAT 2022):
Cassava: 60,000,000 tonnes, 7,500,000 ha — world's largest producer
Yams: 50,000,000 tonnes, 6,500,000 ha — world's largest producer
Maize: 12,000,000 tonnes, 5,000,000 ha — staple cereal
Rice (paddy): 8,500,000 tonnes, 3,500,000 ha — growing production
Sorghum: 10,000,000 tonnes, 5,500,000 ha — northern states
Millet: 8,000,000 tonnes, 5,000,000 ha — Sahel zone
Groundnuts: 4,000,000 tonnes, 2,500,000 ha — northern belt
Cocoa: 340,000 tonnes, 1,800,000 ha — SW states, major export
Oil palm fruit: 9,000,000 tonnes, 3,500,000 ha — southern states
Cowpeas: 3,500,000 tonnes, 3,000,000 ha — key legume`,
        'Ghana': `Crop production statistics for Ghana (Source: FAOSTAT 2022):
Cassava: 22,000,000 tonnes, 1,800,000 ha — staple root crop
Yams: 8,500,000 tonnes, 500,000 ha — major food crop
Cocoa: 800,000 tonnes, 1,900,000 ha — top export earner
Maize: 3,000,000 tonnes, 1,200,000 ha — staple cereal
Rice (paddy): 580,000 tonnes, 200,000 ha — growing domestic demand
Plantains: 4,500,000 tonnes, 400,000 ha — food security
Oil palm fruit: 3,000,000 tonnes, 350,000 ha — industrial + smallholder
Groundnuts: 450,000 tonnes, 350,000 ha — northern regions
Sorghum: 350,000 tonnes, 300,000 ha — Upper East/West
Cowpeas: 250,000 tonnes, 350,000 ha — dry season crop`,
        'Ethiopia': `Crop production statistics for Ethiopia (Source: FAOSTAT 2022):
Teff: 5,500,000 tonnes, 3,000,000 ha — staple grain
Maize: 9,000,000 tonnes, 2,500,000 ha — growing staple
Sorghum: 5,000,000 tonnes, 1,800,000 ha — eastern lowlands
Wheat: 5,500,000 tonnes, 1,700,000 ha — highlands
Coffee: 500,000 tonnes, 700,000 ha — top export, Oromia/SNNPR
Chickpeas: 500,000 tonnes, 300,000 ha — key pulse
Fava beans: 900,000 tonnes, 500,000 ha — highland pulse
Oilseeds: 800,000 tonnes, 600,000 ha — sesame, noug
Potatoes: 1,500,000 tonnes, 900,000 ha — food security
Vegetables: 1,500,000 tonnes, 200,000 ha — growing sector`,
        'Zambia': `Crop production statistics for Zambia (Source: FAOSTAT 2022):
Maize: 3,500,000 tonnes, 1,800,000 ha — staple food
Cassava: 3,000,000 tonnes, 350,000 ha — northern province
Sweet potatoes: 1,200,000 tonnes, 120,000 ha — food security
Soybeans: 400,000 tonnes, 250,000 ha — expanding commercial
Cotton: 100,000 tonnes, 150,000 ha — Eastern Province
Groundnuts: 150,000 tonnes, 180,000 ha — smallholder
Sorghum: 100,000 tonnes, 100,000 ha — Southern Province
Wheat: 100,000 tonnes, 15,000 ha — irrigated
Rice (paddy): 50,000 tonnes, 15,000 ha — growing
Sunflower: 80,000 tonnes, 60,000 ha — Central Province`,
        'Uganda': `Crop production statistics for Uganda (Source: FAOSTAT 2022):
Cassava: 6,000,000 tonnes, 1,500,000 ha — staple food
Bananas: 10,000,000 tonnes, 1,600,000 ha — matooke staple
Maize: 4,000,000 tonnes, 1,500,000 ha — growing staple
Sweet potatoes: 4,500,000 tonnes, 600,000 ha — food security
Beans (dry): 1,000,000 tonnes, 1,000,000 ha — key protein
Millet: 600,000 tonnes, 400,000 ha — northern Uganda
Coffee: 250,000 tonnes, 350,000 ha — top export
Tea: 70,000 tonnes, 25,000 ha — western Uganda
Rice (paddy): 200,000 tonnes, 60,000 ha — expanding
Groundnuts: 300,000 tonnes, 300,000 ha — northern/eastern`,
        'Bangladesh': `Crop production statistics for Bangladesh (Source: FAOSTAT 2022):
Rice (paddy): 55,000,000 tonnes, 11,500,000 ha — staple, 3 seasons
Jute: 1,500,000 tonnes, 500,000 ha — golden fibre
Potatoes: 10,000,000 tonnes, 500,000 ha — winter crop
Vegetables: 18,000,000 tonnes, 1,000,000 ha — expanding
Wheat: 1,000,000 tonnes, 350,000 ha — northern districts
Maize: 5,000,000 tonnes, 500,000 ha — growing feed crop
Sugarcane: 8,000,000 tonnes, 130,000 ha — Rajshahi
Pulses: 800,000 tonnes, 500,000 ha — lentils, chickpeas
Oilseeds: 1,200,000 tonnes, 600,000 ha — mustard, sesame
Mangoes: 1,500,000 tonnes, 100,000 ha — Rajshahi/Chapainawabganj`,
        'India': `Crop production statistics for India (Source: FAOSTAT 2022):
Rice (paddy): 130,000,000 tonnes, 46,000,000 ha — kharif staple
Wheat: 110,000,000 tonnes, 31,000,000 ha — rabi staple
Maize: 33,000,000 tonnes, 10,000,000 ha — growing feed/food
Sugarcane: 420,000,000 tonnes, 5,700,000 ha — UP/Maharashtra
Cotton: 5,500,000 tonnes, 13,000,000 ha — Gujarat/Maharashtra
Groundnuts: 10,000,000 tonnes, 5,000,000 ha — Gujarat/Rajasthan
Soybeans: 13,000,000 tonnes, 12,000,000 ha — MP/Maharashtra
Chickpeas: 13,000,000 tonnes, 10,000,000 ha — key pulse
Tea: 1,300,000 tonnes, 600,000 ha — Assam/West Bengal
Oil palm fruit: 2,000,000 tonnes, 350,000 ha — Andhra Pradesh`,
    };

    /**
     * Generate knowledge articles for key tropical countries.
     * Tries the FAOSTAT API first, falls back to static data.
     */
    async generateCountryArticles(): Promise<FaostatCountryArticle[]> {
        const articles: FaostatCountryArticle[] = [];

        const priorityCountries = {
            'Malawi': '109', 'Kenya': '114', 'Tanzania': '215',
            'Nigeria': '159', 'Ghana': '81', 'Ethiopia': '238',
            'Zambia': '231', 'Uganda': '226', 'Bangladesh': '16', 'India': '100',
        };

        // Try API first for one country to check availability
        let apiAvailable = false;
        try {
            const testUrl = `https://fenixservices.fao.org/faostat/api/v1/en/data/QCL?area=109&item=056&element=5510&year=2023&output_type=json`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            let testResponse: Response;
            try {
                testResponse = await fetch(testUrl, { headers: { 'Accept': 'application/json' }, signal: controller.signal });
            } finally {
                clearTimeout(timeout);
            }
            apiAvailable = testResponse.ok;
        } catch {
            apiAvailable = false;
        }

        if (!apiAvailable) {
            logger.info('[FAOSTAT] API unavailable, using static fallback data');
            for (const [countryName] of Object.entries(priorityCountries)) {
                const content = FaostatService.STATIC_COUNTRY_DATA[countryName];
                if (content) {
                    articles.push({
                        title: `Crop Production Statistics - ${countryName}`,
                        content,
                        category: 'Production Data',
                        crops: Object.keys(this.tropicalCrops).map(c => c.toLowerCase()),
                        regions: [countryName, 'Africa', 'Asia', 'tropical'],
                        source: 'FAOSTAT 2022 static fallback',
                        sourceUrl: 'https://fenixservices.fao.org/faostat/api/v1/en/',
                    });
                }
            }
            return articles;
        }

        // API available — fetch live data
        for (const [countryName, countryCode] of Object.entries(priorityCountries)) {
            logger.info(`Fetching FAOSTAT data for ${countryName}...`);
            const content = await this.fetchCountryCropSummary(countryCode, countryName);

            if (content.split('\n').length > 2) {
                articles.push({
                    title: `Crop Production Statistics - ${countryName}`,
                    content,
                    category: 'Production Data',
                    crops: Object.keys(this.tropicalCrops).map(c => c.toLowerCase()),
                    regions: [countryName, 'Africa', 'Asia', 'tropical'],
                    source: 'FAOSTAT API',
                    sourceUrl: 'https://fenixservices.fao.org/faostat/api/v1/en/',
                });
            }
            await new Promise(r => setTimeout(r, 500));
        }

        return articles;
    }

    /**
     * Get list of available tropical crops
     */
    getTropicalCrops(): Record<string, string> {
        return { ...this.tropicalCrops };
    }

    /**
     * Get list of available tropical countries
     */
    getTropicalCountries(): Record<string, string> {
        return { ...this.tropicalCountries };
    }
}

export const faostatService = new FaostatService();
