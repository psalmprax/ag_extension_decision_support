import { countryOrDefault, findCountry, isValidTimeZone } from '@/shared-api/countries';

/** A person's time zone: their own if set and valid, else their country's main one. */
export function timeZoneFor(person: { timeZone?: string | null; country?: string | null }): string {
    if (person.timeZone && isValidTimeZone(person.timeZone)) return person.timeZone;
    return (findCountry(person.country) ?? countryOrDefault(null)).timeZones[0] ?? 'UTC';
}

/** Whether people in a country write dates month first (11/25) rather than day first (25/11). */
export function writesMonthFirst(country?: string | null): boolean {
    const iso = findCountry(country)?.iso2;
    return iso === 'US' || iso === 'PH';
}

/** The calendar day and weekday of an instant, as seen in a time zone. */
export function localDay(instant: Date, timeZone: string): { year: number; month: number; day: number; weekday: number } {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short' })
        .formatToParts(instant);
    const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    return { year: Number(get('year')), month: Number(get('month')) - 1, day: Number(get('day')), weekday };
}

/** The instant of a wall-clock time on a calendar day in a time zone (month is 0-based). */
export function zonedInstant(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
    const guess = Date.UTC(year, month, day, hour, minute);
    // The zone's offset at that moment: how far its wall clock is from UTC.
    const offsetAt = (utc: number) => {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
        }).formatToParts(new Date(utc));
        const get = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0);
        return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute')) - utc;
    };
    const first = guess - offsetAt(guess);
    // Re-check once: the offset can change across a daylight-saving boundary.
    return new Date(guess - offsetAt(first));
}
