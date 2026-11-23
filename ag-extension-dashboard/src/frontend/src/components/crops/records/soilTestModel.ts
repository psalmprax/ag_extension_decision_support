import type { SoilTest } from '@/api/fieldRecordsService';

/** The organic values a lab can report, in the order they are charted. */
export const ORGANIC_SERIES = [
  { key: 'organicCarbonPct', labelKey: 'soil_organic_carbon', label: 'Organic carbon' },
  { key: 'organicMatterPct', labelKey: 'soil_organic_matter', label: 'Organic matter' },
] as const;

export type OrganicKey = (typeof ORGANIC_SERIES)[number]['key'];

export interface OrganicChange {
  key: OrganicKey;
  first: { date: string; value: number };
  last: { date: string; value: number };
  /** Percentage points, last minus first. */
  change: number;
}

/** Tests with a date, oldest first, that report at least one organic value. */
export function organicRows(tests: SoilTest[]): SoilTest[] {
  return tests
    .filter(test => test.testedAt && (test.organicCarbonPct !== null || test.organicMatterPct !== null))
    .sort((a, b) => (a.testedAt as string).localeCompare(b.testedAt as string));
}

/** The organic values actually recorded on this field, so an empty series gets no line or legend. */
export function recordedSeries(rows: SoilTest[]) {
  return ORGANIC_SERIES.filter(series => rows.some(row => row[series.key] !== null));
}

/**
 * The change in one organic value from the first to the latest test that reports it. Needs two
 * tests on different days; a single test has nothing to compare against.
 */
export function organicChange(rows: SoilTest[], key: OrganicKey): OrganicChange | null {
  const measured = rows.filter(row => row[key] !== null && row.testedAt);
  if (measured.length < 2) return null;
  const first = measured[0];
  const last = measured[measured.length - 1];
  if (first.testedAt === last.testedAt) return null;
  const firstValue = first[key] as number;
  const lastValue = last[key] as number;
  return {
    key,
    first: { date: first.testedAt as string, value: firstValue },
    last: { date: last.testedAt as string, value: lastValue },
    change: Math.round((lastValue - firstValue) * 100) / 100,
  };
}
