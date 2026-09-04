export function getQuotaPercent(current: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min((current / limit) * 100, 100);
}
