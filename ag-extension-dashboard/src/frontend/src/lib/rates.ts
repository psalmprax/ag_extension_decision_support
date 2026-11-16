/**
 * Percentages shown on admin pages, computed from real counts. With nothing
 * counted there is no rate, so these say so instead of showing a figure.
 */
export function ratePercent(successes: number, total: number): string | null {
  return total > 0 ? `${Math.round((successes / total) * 100)}%` : null;
}

/** Agent queue: share of finished tasks that passed. */
export function passRateLabel(completed: number, failed: number): string {
  const rate = ratePercent(completed, completed + failed);
  return rate ? `${rate} pass` : 'no runs yet';
}
