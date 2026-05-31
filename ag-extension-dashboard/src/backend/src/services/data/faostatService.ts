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

            const response = await fetch(`${url}?${params}`, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'ag-extension-dashboard/1.0'
                },
                signal: controller.signal
            });
            clearTimeout(timeout);

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
        } catch (error: any) {
            logger.warn(`FAOSTAT fetch failed for item=${itemCode} area=${areaCode}: ${error.message}`);
            return [];
        }
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

            // Group by element
            const byElement = new Map<string, FaostatCropRecord[]>();
            for (const r of records) {
                const existing = byElement.get(r.elementName) || [];
                existing.push(r);
                byElement.set(r.elementName, existing);
            }

            const production = byElement.get('Production');
            const area = byElement.get('Area harvested');
            const yield_ = byElement.get('Yield');

            const latestProd = production?.filter(r => r.value != null).sort((a, b) => b.year - a.year)[0];
            const latestArea = area?.filter(r => r.value != null).sort((a, b) => b.year - a.year)[0];
            const latestYield = yield_?.filter(r => r.value != null).sort((a, b) => b.year - a.year)[0];

            if (latestProd || latestArea) {
                const parts = [`${cropName}:`];
                if (latestProd?.value) parts.push(`${Math.round(latestProd.value).toLocaleString()} tonnes (${latestProd.year})`);
                if (latestArea?.value) parts.push(`${Math.round(latestArea.value).toLocaleString()} ha harvested`);
                if (latestYield?.value) parts.push(`yield ${Math.round(latestYield.value)} hg/ha`);
                lines.push(parts.join(' '));
                fetchCount++;
            }

            // Small delay to avoid hammering the API
            await new Promise(r => setTimeout(r, 200));
        }

        return lines.join('\n');
    }

    /**
     * Generate knowledge articles for key tropical countries.
     * Each article covers crop production stats for one country.
     */
    async generateCountryArticles(): Promise<Array<{ title: string; content: string; category: string; crops: string[]; regions: string[] }>> {
        const articles: Array<{ title: string; content: string; category: string; crops: string[]; regions: string[] }> = [];

        // Focus on most relevant countries for the app
        const priorityCountries = {
            'Malawi': '109',
            'Kenya': '114',
            'Tanzania': '215',
            'Nigeria': '159',
            'Ghana': '81',
            'Ethiopia': '238',
            'Zambia': '231',
            'Uganda': '226',
            'Bangladesh': '16',
            'India': '100',
        };

        for (const [countryName, countryCode] of Object.entries(priorityCountries)) {
            logger.info(`Fetching FAOSTAT data for ${countryName}...`);
            const content = await this.fetchCountryCropSummary(countryCode, countryName);

            if (content.split('\n').length > 2) {
                articles.push({
                    title: `Crop Production Statistics - ${countryName}`,
                    content,
                    category: 'Production Data',
                    crops: Object.keys(this.tropicalCrops).map(c => c.toLowerCase()),
                    regions: [countryName, 'Africa', 'Asia', 'tropical']
                });
            }

            // Delay between countries
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
