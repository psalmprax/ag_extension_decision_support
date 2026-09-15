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
/**
 * Derive anomaly alerts from a multi-year production series.
 *
 * Series are grouped per item+element and compared against the two most recent years
 * that actually carry data, because FAOSTAT publishes with a lag — a fixed
 * "current year vs previous year" diff silently produced an empty list forever.
 */
function buildProductionAnomalyAlerts(rows: CropProductionStat[], region: string): DiseaseAlert[] {
  const bySeries = new Map<string, CropProductionStat[]>();
  for (const row of rows) {
    if (row.element !== 'Yield' && row.element !== 'Production') continue;
    if (row.value <= 0) continue;
    const key = `${row.itemCode}|${row.element}`;
    const series = bySeries.get(key);
    if (series) series.push(row);
    else bySeries.set(key, [row]);
  }

  const alerts: DiseaseAlert[] = [];
  for (const series of bySeries.values()) {
    const ordered = [...series].sort((a, b) => Number(a.year) - Number(b.year));
    if (ordered.length < 2) continue;
    const latest = ordered[ordered.length - 1];
    const previous = ordered[ordered.length - 2];
    if (previous.value <= 0 || latest.value <= 0) continue;

    const change = ((latest.value - previous.value) / previous.value) * 100;
    if (change >= -15) continue;

    alerts.push({
      id: `fao-${latest.itemCode}-${latest.element}-${latest.year}`,
      title: `${latest.item} ${latest.element} Decline`,
      description: `${latest.item} ${latest.element.toLowerCase()} dropped ${Math.abs(Math.round(change))}% in ${region} (${latest.year} vs ${previous.year}). This may indicate pest/disease pressure or adverse growing conditions.`,
      severity: change < -30 ? 'high' : 'medium',
      crop: latest.item,
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
      // FAOSTAT publishes with a 1-2 year lag, so the newest calendar year is always
      // empty. Pull a window of recent years and diff the two most recent that carry
      // data, instead of comparing "this year" (always empty) to last year.
      const currentYear = new Date().getFullYear();
      const years = [currentYear - 1, currentYear - 2, currentYear - 3].map(String);
      const batches = await Promise.all(years.map(y => this.getCropProduction(region, crop, y)));
      const rows = batches.flat();

      const alerts = buildProductionAnomalyAlerts(rows, region);
      if (alerts.length === 0) {
        logger.info(`No FAOSTAT production anomalies for ${region} across ${years.join(', ')}`);
      }
      return alerts;
    } catch (error) {
      logger.error(`FAO disease alerts computation failed for ${region}:`, error);
      return [];
    }
  }

  /**
   * Get available FAOSTAT domains (for UI reference).
   */
  // fallow-ignore-next-line unused-class-member
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