import type { TurnTakingSettings } from '@/api/chatbotService';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Mon–Sat", "Mon, Wed, Fri" or "every day". */
export function dayRangeLabel(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.length === 7) return 'every day';
  if (sorted.length === 0) return 'no days';
  const consecutive = sorted.every((d, i) => i === 0 || d === sorted[i - 1] + 1);
  return consecutive && sorted.length > 2
    ? `${DAY[sorted[0]]}–${DAY[sorted[sorted.length - 1]]}`
    : sorted.map(d => DAY[d]).join(', ');
}

/** What a farmer can expect, in one line. */
export function officerReplyExpectation(settings: TurnTakingSettings): string {
  const { start, end, days } = settings.workingHours;
  return `Your officer usually replies within ${settings.aiFallbackMinutes} minutes (${start}–${end}, ${dayRangeLabel(days)}). ` +
    'Tap Ask AI for an answer now.';
}
