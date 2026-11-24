import { areaFromHectares, areaToHectares, findCountry, type AreaUnit } from '@ag-extension/shared/api';
import { appLocale } from '@/lib/appLocale';
import type { ProfileSettings } from '@/store/useAppStore';

export type TempUnit = 'celsius' | 'fahrenheit';

/** The land unit to show: the person's own choice, else how farmers measure land in their country. */
export function areaUnitFor(settings: ProfileSettings | undefined, country?: string | null): AreaUnit {
  if (settings?.areaUnit === 'acres') return 'acre';
  if (settings?.areaUnit === 'hectares') return 'ha';
  return findCountry(country)?.areaUnit ?? 'ha';
}

/** The temperature unit to show: the person's own choice, else Fahrenheit only in the United States. */
export function tempUnitFor(settings: ProfileSettings | undefined, country?: string | null): TempUnit {
  if (settings?.tempUnit) return settings.tempUnit;
  return findCountry(country)?.iso2 === 'US' ? 'fahrenheit' : 'celsius';
}

const toNumber = (value: number | string | null | undefined): number | null => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/** "2.5 ha" or "6.2 acres", from hectares as stored. */
export function formatArea(hectares: number | string | null | undefined, unit: AreaUnit, digits = 1): string {
  const value = toNumber(hectares);
  if (value === null) return '—';
  const shown = areaFromHectares(value, unit);
  const text = shown.toLocaleString(appLocale(), { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  if (unit === 'ha') return `${text} ha`;
  return `${text} ${Math.abs(shown - 1) < 0.05 ? 'acre' : 'acres'}`;
}

/** "24°C" or "75°F", from Celsius as stored. */
export function formatTemp(celsius: number | string | null | undefined, unit: TempUnit): string {
  const value = toNumber(celsius);
  if (value === null) return '—';
  return unit === 'fahrenheit' ? `${Math.round(value * 1.8 + 32)}°F` : `${Math.round(value)}°C`;
}

export { areaFromHectares, areaToHectares };
