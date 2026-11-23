export interface ActivityDay {
  date: string;
  visits: number;
  queries: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * One row per day for the last `days` days, ending today. The server returns only days with
 * activity; a quiet day is a real zero, not a gap for the line to jump across.
 */
export function fillActivityDays(rows: Array<Record<string, string | number>>, days: number, today = new Date()): ActivityDay[] {
  const byDay = new Map<string, ActivityDay>();
  for (const row of rows) {
    const date = String(row.date ?? '').slice(0, 10);
    if (date) byDay.set(date, { date, visits: Number(row.visits) || 0, queries: Number(row.queries) || 0 });
  }
  const end = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end - (days - 1 - index) * DAY_MS).toISOString().slice(0, 10);
    return byDay.get(date) ?? { date, visits: 0, queries: 0 };
  });
}
