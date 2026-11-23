import { NasaPowerService, type DailyPoint } from '@/services/nasaPowerService';
import type { FieldWeather, FieldWeatherDay } from '@/shared-api/fieldRecords';

export const FIELD_WEATHER_DAYS = 30;

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

function valueOrNull(point: DailyPoint, key: string): number | null {
    const value = point[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Daily solar radiation and rainfall at a field from NASA POWER (agroclimatology community:
 * solar in MJ/m²/day, corrected rainfall in mm/day). The most recent days are often not
 * published yet, so the period runs to today and `latestDate` says where the values stop.
 * Null when NASA POWER could not be reached.
 */
export async function fieldWeather(latitude: number, longitude: number, days = FIELD_WEATHER_DAYS, now = new Date()): Promise<FieldWeather | null> {
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const from = new Date(to.getTime() - (days - 1) * 86_400_000);
    const points = await NasaPowerService.getDaily(latitude, longitude, isoDay(from), isoDay(to), ['ALLSKY_SFC_SW_DWN', 'PRECTOTCORR']);
    if (points.length === 0) return null;

    const daily: FieldWeatherDay[] = points.map(point => ({
        date: point.date,
        solarMjM2: valueOrNull(point, 'ALLSKY_SFC_SW_DWN'),
        rainMm: valueOrNull(point, 'PRECTOTCORR'),
    }));
    const latest = [...daily].reverse().find(day => day.solarMjM2 !== null || day.rainMm !== null);
    return {
        source: 'NASA POWER',
        location: { latitude, longitude },
        from: isoDay(from),
        to: isoDay(to),
        latestDate: latest?.date ?? null,
        units: { solar: 'MJ/m²/day', rain: 'mm/day' },
        days: daily,
    };
}
