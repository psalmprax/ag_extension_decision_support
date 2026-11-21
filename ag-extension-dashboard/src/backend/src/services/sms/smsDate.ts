/** Dates typed in officer SMS commands: today, tomorrow, a weekday, 25/11, 25/11/2026 or 2026-11-25. */
const WEEKDAYS: Record<string, number> = {
    sun: 0, sunday: 0, jumapili: 0,
    mon: 1, monday: 1, jumatatu: 1,
    tue: 2, tues: 2, tuesday: 2, jumanne: 2,
    wed: 3, wednesday: 3, jumatano: 3,
    thu: 4, thur: 4, thurs: 4, thursday: 4, alhamisi: 4,
    fri: 5, friday: 5, ijumaa: 5,
    sat: 6, saturday: 6, jumamosi: 6,
};

import { localDay, zonedInstant } from '@/services/country/localTime';

export interface SmsDateOptions {
    /** The sender's time zone: "today" and "tomorrow" are their days, and visits are at 09:00 there. */
    timeZone?: string;
    /** 11/25 (United States) instead of 25/11. */
    monthFirst?: boolean;
}

/** A written date (2026-11-25, 25/11, 25/11/26 or 11/25 month first); month is 0-based. */
function numericDate(word: string, today: { y: number; m: number; d: number }, monthFirst: boolean): { year: number; month: number; day: number } | null {
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(word);
    if (iso) return { year: Number(iso[1]), month: Number(iso[2]) - 1, day: Number(iso[3]) };
    const numeric = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(word);
    if (!numeric) return null;
    const [a, b] = [Number(numeric[1]), Number(numeric[2])];
    const [day, month] = monthFirst ? [b, a - 1] : [a, b - 1];
    let year = numeric[3] ? Number(numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : today.y;
    // A day and month without a year that has already passed means next year.
    if (!numeric[3] && Date.UTC(year, month, day) < Date.UTC(today.y, today.m, today.d)) year += 1;
    return { year, month, day };
}

/**
 * The date at the start of the text, and the words after it. Null when the text does not
 * start with a date this understands, or the date is not a real calendar day.
 */
export function parseSmsDate(text: string, now = new Date(), options: SmsDateOptions = {}): { date: Date; rest: string } | null {
    const timeZone = options.timeZone ?? 'UTC';
    const atNine = (year: number, month: number, day: number) => zonedInstant(year, month, day, 9, 0, timeZone);
    const isRealDay = (year: number, month: number, day: number) => {
        const check = new Date(Date.UTC(year, month, day));
        return check.getUTCMonth() === month && check.getUTCDate() === day;
    };
    const [first = '', ...others] = text.trim().split(/\s+/);
    const word = first.toLowerCase().replace(/[.,]$/, '');
    const rest = others.join(' ');
    const today = localDay(now, timeZone);
    const { year: y, month: m, day: d } = today;
    const dayAfter = (count: number) => {
        const next = new Date(Date.UTC(y, m, d + count));
        return atNine(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());
    };
    if (['today', 'leo'].includes(word)) return { date: atNine(y, m, d), rest };
    if (['tomorrow', 'tmrw', 'kesho'].includes(word)) return { date: dayAfter(1), rest };
    if (word in WEEKDAYS) {
        const ahead = (WEEKDAYS[word] - today.weekday + 7) % 7 || 7;
        return { date: dayAfter(ahead), rest };
    }
    const parsed = numericDate(word, { y, m, d }, options.monthFirst ?? false);
    if (!parsed) return null;
    const { year, month, day } = parsed;
    if (!isRealDay(year, month, day)) return null;
    return { date: atNine(year, month, day), rest };
}
