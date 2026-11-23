import type { TelemetryEvent } from '@/api/telemetryService';

export interface EventTrends {
  /** Requests in each time slice, oldest first. */
  requests: number[];
  /** Mean response time in each slice that had a timed request. */
  responseMs: number[];
  /** Share of failed requests in each slice that had requests, in percent. */
  errorPercent: number[];
  /** Running total of cost, in US dollars. */
  costUsd: number[];
}

/**
 * Splits the loaded events into equal time slices and works out each tile's trend from them.
 * Every point comes from real events; with fewer than two timed events there is no trend.
 */
export function eventTrends(events: TelemetryEvent[], slices = 10): EventTrends {
  const timed = events
    .map(event => ({ event, at: new Date(event.timestamp).getTime() }))
    .filter(({ at }) => Number.isFinite(at))
    .sort((a, b) => a.at - b.at);
  const empty: EventTrends = { requests: [], responseMs: [], errorPercent: [], costUsd: [] };
  if (timed.length < 2) return empty;

  const start = timed[0].at;
  const span = timed[timed.length - 1].at - start;
  const buckets: TelemetryEvent[][] = Array.from({ length: slices }, () => []);
  for (const { event, at } of timed) {
    const index = span === 0 ? 0 : Math.min(slices - 1, Math.floor(((at - start) / span) * slices));
    buckets[index].push(event);
  }

  let runningCost = 0;
  return buckets.reduce<EventTrends>((trend, bucket) => {
    trend.requests.push(bucket.length);
    const durations = bucket.map(event => event.durationMs).filter((ms): ms is number => typeof ms === 'number');
    if (durations.length) trend.responseMs.push(durations.reduce((sum, ms) => sum + ms, 0) / durations.length);
    if (bucket.length) trend.errorPercent.push((bucket.filter(event => event.status === 'error').length / bucket.length) * 100);
    runningCost += bucket.reduce((sum, event) => sum + (event.costUsd ?? 0), 0);
    trend.costUsd.push(runningCost);
    return trend;
  }, empty);
}
