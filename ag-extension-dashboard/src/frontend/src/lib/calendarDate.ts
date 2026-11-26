/** A YYYY-MM-DD calendar date for display, never shifted across time zones. */
import { appLocale } from '@/lib/appLocale';
export function formatCalendarDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(appLocale(), { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Today, or `days` from today, as YYYY-MM-DD in the user's own calendar. */
export function calendarDateFromToday(days = 0): string {
  return calendarDateFrom(Date.now(), days);
}

/** `days` after the day of `from` (epoch ms), as YYYY-MM-DD in the user's own calendar. */
export function calendarDateFrom(from: number, days = 0): string {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
