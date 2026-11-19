/** The fields of the signed-in user that decide plan access. */
export interface PlanHolder {
  role?: string;
  isFree?: boolean;
  planName?: string | null;
}

/**
 * True when Pro features are locked for this user: same rule the server applies
 * (admins are never on the free plan; a missing or "Free" plan is free).
 */
export function isFreePlanUser(user: PlanHolder | null | undefined): boolean {
  if (!user || user.role === 'admin') return false;
  return Boolean(user.isFree || user.planName?.toLowerCase() === 'free' || !user.planName);
}
