import axios from 'axios';
import { logger } from '@/utils/logger';
import { rateLimitedFetch } from './externalApiGuard';

/**
 * NASA POWER API — Prediction of Worldwide Energy Resources
 * Free, no API key. Community: AG (Agroclimatology).
 * Docs: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
 *
 * Available parameters (AG community):
 *   T2M             — Temperature at 2m (°C)
 *   T2M_MIN         — Min temperature (°C)
 *   T2M_MAX         — Max temperature (°C)
 *   PRECTOTCORR     — Corrected precipitation (mm/day)
 *   RH2M            — Relative humidity at 2m (%)
 *   WS2M            — Wind speed at 2m (m/s)
 *   ALLSKY_SFC_SW_DWN — Insolation (kW-hr/m²/day)
 */

const POWER_BASE = 'https://power.larc.nasa.gov/api/temporal/daily/point';
const COMMUNITY = 'AG';

type PowerParameter = 'T2M' | 'T2M_MIN' | 'T2M_MAX' | 'PRECTOTCORR' | 'RH2M' | 'WS2M' | 'ALLSKY_SFC_SW_DWN';

interface PowerResponse {
  type: string;
  geometry: { type: string; coordinates: [number, number, number] };
  properties: {
    parameter: Record<string, Record<string, number>>;
  };
}

const PARAM_LABELS: Record<string, string> = {
  T2M: 'Temperature (°C)',
  T2M_MIN: 'Min Temp (°C)',
  T2M_MAX: 'Max Temp (°C)',
  PRECTOTCORR: 'Precipitation (mm)',
  RH2M: 'Humidity (%)',
  WS2M: 'Wind Speed (m/s)',
  ALLSKY_SFC_SW_DWN: 'Solar Radiation (kW-hr/m²/day)',
};

export interface DailyPoint {
  date: string;
  [param: string]: number | string;
}

export class NasaPowerService {
  /**
   * Fetch daily agrometeorological data for a single point.
   * Free, no API key. Returns one object per day with numeric parameter values.
   */
  static async getDaily(
    lat: number,
    lng: number,
    startDate: string,  // YYYY-MM-DD
    endDate: string,    // YYYY-MM-DD
    parameters: PowerParameter[] = ['T2M', 'PRECTOTCORR', 'RH2M', 'ALLSKY_SFC_SW_DWN'],
  ): Promise<DailyPoint[]> {
    const startRaw = startDate.replace(/-/g, '');
    const endRaw = endDate.replace(/-/g, '');
    const params = parameters.join(',');
    const cacheKey = `power:${lat.toFixed(2)}:${lng.toFixed(2)}:${startRaw}:${endRaw}:${params}`;

    try {
      return await rateLimitedFetch<DailyPoint[]>('nasaPower', cacheKey, async () => {
      const url = `${POWER_BASE}?parameters=${params}&community=${COMMUNITY}&longitude=${lng}&latitude=${lat}&start=${startRaw}&end=${endRaw}&format=JSON`;
      const response = await axios.get<PowerResponse>(url, { timeout: 15000 });
      const result = this.parsePowerResponse(response.data, parameters);
      logger.info(`NASA POWER: ${result.length} days fetched for (${lat}, ${lng})`);
      return result;
      });
    } catch (error) {
      logger.error(`NASA POWER fetch failed for (${lat}, ${lng}): ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  private static parsePowerResponse(response: PowerResponse, parameters: PowerParameter[]): DailyPoint[] {
    const parameterData = response.properties?.parameter;
    if (!parameterData) return [];

    const dateSet = new Set<string>();
    for (const paramData of Object.values(parameterData)) {
      for (const dateStr of Object.keys(paramData)) {
        dateSet.add(dateStr);
      }
    }

    const sortedDates = Array.from(dateSet).sort();
    const result: DailyPoint[] = [];

    for (const dateStr of sortedDates) {
      const readable = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
      const row: DailyPoint = { date: readable };
      for (const param of parameters) {
        const val = parameterData[param]?.[dateStr];
        if (typeof val === 'number' && !isNaN(val)) row[param] = Math.round(val * 100) / 100;
      }
      result.push(row);
    }
    return result;
  }

  /**
   * Get soil map labels for UI display
   */
  static getParamLabels(): Record<string, string> {
    return { ...PARAM_LABELS };
  }
}