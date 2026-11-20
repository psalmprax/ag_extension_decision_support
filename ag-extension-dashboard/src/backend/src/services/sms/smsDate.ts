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

/** A visit time at 09:00 UTC on the given calendar day. */
const atNine = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day, 9, 0, 0));

/**
 * The date at the start of the text, and the words after it. Null when the text does not
 * start with a date this understands, or the date is not a real calendar day.
 */
export function parseSmsDate(text: string, now = new Date()): { date: Date; rest: string } | null {
    const [first = '', ...others] = text.trim().split(/\s+/);
    const word = first.toLowerCase().replace(/[.,]$/, '');
    const rest = others.join(' ');
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const d = now.getUTCDate();
    if (['today', 'leo'].includes(word)) return { date: atNine(y, m, d), rest };
    if (['tomorrow', 'tmrw', 'kesho'].includes(word)) return { date: atNine(y, m, d + 1), rest };
    if (word in WEEKDAYS) {
        const ahead = (WEEKDAYS[word] - now.getUTCDay() + 7) % 7 || 7;
        return { date: atNine(y, m, d + ahead), rest };
    }
    const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(word);
    const dmy = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/.exec(word);
    let year: number; let month: number; let day: number;
    if (iso) {
        [year, month, day] = [Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])];
    } else if (dmy) {
        day = Number(dmy[1]);
        month = Number(dmy[2]) - 1;
        year = dmy[3] ? Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]) : y;
        // A day and month without a year that has already passed means next year.
        if (!dmy[3] && atNine(year, month, day) < atNine(y, m, d)) year += 1;
    } else {
        return null;
    }
    const date = atNine(year, month, day);
    if (date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
    return { date, rest };
}
