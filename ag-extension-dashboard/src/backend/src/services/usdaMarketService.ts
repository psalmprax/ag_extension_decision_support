import axios from 'axios';
import { logger } from '@/utils/logger';
import { rateLimitedFetch } from './externalApiGuard';

/**
 * USDA Foreign Agricultural Service — Production, Supply and Distribution (PSD) API
 * Free, no API key required. Public open data.
 * Base: https://apps.fas.usda.gov/OpenData/api/psd
 *
 * Provides global and country-level commodity data:
 *   - Production, Supply, Distribution
 *   - Area harvested, Yield
 *   - Imports/Exports, Domestic Consumption
 */

const USDA_PSD_BASE = 'https://apps.fas.usda.gov/OpenData/api/psd';

const COMMODITY_CODES: Record<string, string> = {
  corn:        '0440000',
  maize:       '0440000',
  wheat:       '0410000',
  rice:        '0422110',
  sorghum:     '0459200',
  millet:      '0459100',
  soybeans:    '2222000',
  soybean:     '2222000',
  coffee:      '0711100',
  palm_oil:    '4243000',
  sugar:       '0610000',
};

const COUNTRY_CODES: Record<string, string> = {
  kenya:     'KE',
  nigeria:   'NI',
  ghana:     'GH',
  tanzania:  'TZ',
  uganda:    'UG',
  ethiopia:  'ET',
  india:     'IN',
  brazil:    'BR',
  canada:    'CA',
};

export interface CommodityRecord {
  countryCode: string;
  countryName: string;
  commodityCode: string;
  commodityName: string;
  marketYear: string;
  attribute: string;
  unit: string;
  value: number;
}

function commodityCode(name: string): string | null {
  const lower = name.toLowerCase();
  for (const [key, code] of Object.entries(COMMODITY_CODES)) {
    if (lower.includes(key)) return code;
  }
  return null;
}

function countryCode(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, code] of Object.entries(COUNTRY_CODES)) {
    if (lower.includes(key)) return code;
  }
  return 'KE';
}

export class UsdaMarketService {
  /**
   * Fetch PSD data for a commodity in a country.
   */
  static async getCommodityData(
    country: string,
    crop: string,
  ): Promise<CommodityRecord[]> {
    const cc = commodityCode(crop);
    const iso = countryCode(country);
    if (!cc) {
      logger.warn(`USDA PSD: unknown commodity ${crop}`);
      return [];
    }

    const cacheKey = `country:${iso}:${cc}`;
    try {
      return await rateLimitedFetch<CommodityRecord[]>('usdaPsd', cacheKey, async () => {
        const response = await axios.get<CommodityRecord[]>(
          `${USDA_PSD_BASE}/commodities/${cc}/country/${iso}`,
          { timeout: 10000 },
        );
        if (!Array.isArray(response.data)) {
          logger.warn(`USDA PSD returned non-array for ${crop}/${country}`);
          return [];
        }
        logger.info(`USDA PSD: ${response.data.length} records for ${crop} in ${country}`);
        return response.data.filter(r => r.value != null && !isNaN(Number(r.value)));
      });
    } catch (error) {
      logger.warn(`USDA PSD fetch failed for ${crop}/${country}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Get world-total benchmark data for a commodity.
   */
  static async getWorldBenchmark(crop: string): Promise<CommodityRecord[]> {
    const cc = commodityCode(crop);
    if (!cc) {
      logger.warn(`USDA PSD: unknown commodity ${crop}`);
      return [];
    }

    const cacheKey = `world:${cc}`;
    try {
      return await rateLimitedFetch<CommodityRecord[]>('usdaPsd', cacheKey, async () => {
        const response = await axios.get<CommodityRecord[]>(
          `${USDA_PSD_BASE}/commodities/${cc}/world`,
          { timeout: 10000 },
        );
        if (!Array.isArray(response.data)) return [];
        return response.data.filter(r => r.value != null && !isNaN(Number(r.value)));
      });
    } catch (error) {
      logger.warn(`USDA PSD world benchmark failed for ${crop}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Extract yield and production metrics from PSD records.
   */
  static extractMetrics(records: CommodityRecord[]): {
    production: number | null;
    yield: number | null;
    area: number | null;
    imports: number | null;
    exports: number | null;
    unit: string;
  } {
    const result = {
      production: null as number | null,
      yield: null as number | null,
      area: null as number | null,
      imports: null as number | null,
      exports: null as number | null,
      unit: 'tonnes',
    };

    for (const r of records) {
      const attr = (r.attribute || '').toLowerCase();
      if (attr === 'production') result.production = Number(r.value);
      else if (attr === 'yield') { result.yield = Number(r.value); result.unit = r.unit || 'tonnes/ha'; }
      else if (attr === 'area harvested') result.area = Number(r.value);
      else if (attr === 'imports' || attr === 'total imports') result.imports = Number(r.value);
      else if (attr === 'exports' || attr === 'total exports') result.exports = Number(r.value);
    }

    return result;
  }
}