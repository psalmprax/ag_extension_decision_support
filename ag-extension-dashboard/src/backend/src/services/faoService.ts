import axios from 'axios';
import { logger } from '@/utils/logger';
import { rateLimitedFetch } from './externalApiGuard';

// ─── FAOSTAT API — free, no key, JSON ──────────────────────────────
// Base: https://fenixservices.fao.org/faostat/api/v1
// Developer portal: https://www.fao.org/faostat/en/#developer-portal

const FAOSTAT_BASE = 'https://fenixservices.fao.org/faostat/api/v1';

export interface DiseaseAlert {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  crop: string;
  region: string;
  publishedDate: string;
}

export interface CropProductionStat {
  area: string;
  item: string;
  itemCode: string;
  element: string;
  year: string;
  unit: string;
  value: number;
  flag: string;
}

export interface DomainInfo {
  code: string;
  label: string;
  description: string;
}

// ─── Country name → FAOSTAT area code ──────────────────────────────
function areaCode(country: string): string {
  const lower = country.toLowerCase();
  const codes: Record<string, string> = {
    'kenya': '114', 'nigeria': '159', 'ghana': '81', 'tanzania': '215',
    'uganda': '226', 'ethiopia': '62', 'rwanda': '184', 'malawi': '130',
    'zambia': '251', 'zimbabwe': '181', 'mozambique': '144', 'south africa': '202',
    'india': '100', 'brazil': '21', 'canada': '33',
  };
  for (const [key, code] of Object.entries(codes)) {
    if (lower.includes(key)) return code;
  }
  return '114'; // default Kenya
}

// ─── Production anomaly → disease alert helper ─────────────────────
function buildProductionAnomalyAlerts(
  current: CropProductionStat[],
  previous: CropProductionStat[],
  region: string,
): DiseaseAlert[] {
  const prevMap = new Map<string, number>();
  for (const row of previous) prevMap.set(row.itemCode, row.value);

  const alerts: DiseaseAlert[] = [];
  for (const row of current) {
    if (row.element !== 'Yield' && row.element !== 'Production') continue;
    const prevVal = prevMap.get(row.itemCode);
    if (prevVal == null || prevVal <= 0 || row.value <= 0) continue;
    const change = ((row.value - prevVal) / prevVal) * 100;
    if (change >= -15) continue;
    alerts.push({
      id: `fao-${row.itemCode}-${row.year}`,
      title: `${row.item} ${row.element} Decline`,
      description: `${row.item} ${row.element.toLowerCase()} dropped ${Math.abs(Math.round(change))}% in ${region} (${row.year} vs previous). This may indicate pest/disease pressure or adverse growing conditions.`,
      severity: change < -30 ? 'high' : 'medium',
      crop: row.item,
      region,
      publishedDate: new Date().toISOString().split('T')[0],
    });
  }
  return alerts.slice(0, 10);
}

export class FAOService {
  private static mapProductionRows(rows: Record<string, unknown>[]): CropProductionStat[] {
    return rows.map(r => ({
      area: String(r.area || ''),
      item: String(r.item || ''),
      itemCode: String(r.item_code || ''),
      element: String(r.element || ''),
      year: String(r.year || ''),
      unit: String(r.unit || ''),
      value: Number(r.value || 0),
      flag: String(r.flag || ''),
    }));
  }

  /**
   * Get crop production statistics for a country from FAOSTAT QCL domain.
   * Domain QCL = "Production: Crops and livestock products"
   * Free, no API key required.
   */
  static async getCropProduction(
    country: string,
    crop?: string,
    year?: string
  ): Promise<CropProductionStat[]> {
    const area = areaCode(country);
    const targetYear = year || String(new Date().getFullYear());
    const cacheKey = `qcl:${area}:${targetYear}:${crop || 'all'}`;
    try {
      return await rateLimitedFetch<CropProductionStat[]>('faostat', cacheKey, async () => {
        const response = await axios.get(`${FAOSTAT_BASE}/en/data/QCL`, {
          params: { area, year: targetYear, format: 'json' },
          timeout: 10000,
        });
        if (!Array.isArray(response.data?.data)) {
          logger.warn(`FAOSTAT QCL returned no data array for ${country} (area ${area})`);
          return [];
        }
        let rows = response.data.data as Record<string, unknown>[];
        if (crop) rows = rows.filter(r => String(r.item || '').toLowerCase().includes(crop.toLowerCase()));
        logger.info(`FAOSTAT: ${rows.length} crop production rows fetched for ${country}`);
        return this.mapProductionRows(rows);
      });
    } catch (error) {
      logger.error(`FAOSTAT crop production fetch failed for ${country}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Get recent disease alerts. FAOSTAT doesn't have a real-time disease API,
   * but we check crop production anomalies as a proxy for outbreak signals.
   * For real disease data, integrate with PlantVillage or CGIAR.
   */
  static async getDiseaseAlerts(region: string, crop?: string): Promise<DiseaseAlert[]> {
    try {
      const currentYear = String(new Date().getFullYear());
      const prevYear = String(Number(currentYear) - 1);
      const [current, previous] = await Promise.all([
        this.getCropProduction(region, crop, currentYear),
        this.getCropProduction(region, crop, prevYear),
      ]);
      return buildProductionAnomalyAlerts(current, previous, region);
    } catch (error) {
      logger.error(`FAO disease alerts computation failed for ${region}:`, error);
      return [];
    }
  }

  /**
   * Get available FAOSTAT domains (for UI reference).
   */
  static async getDomains(): Promise<DomainInfo[]> {
    try {
      const response = await axios.get(`${FAOSTAT_BASE}/en/groupsanddomains`, {
        timeout: 8000,
      });
      const data = response.data?.data;
      if (!Array.isArray(data)) return [];
      return data.map((d: Record<string, unknown>) => ({
        code: String(d.domain_code || ''),
        label: String(d.domain_label || d.domain_name || ''),
        description: String(d.domain_description || ''),
      }));
    } catch (error) {
      logger.error('FAOSTAT domains fetch failed:', error);
      return [];
    }
  }
}