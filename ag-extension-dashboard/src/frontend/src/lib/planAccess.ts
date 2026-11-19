/** A paid service behind the server's plan gate (backend services/paidServices.ts). */
export type PaidService = 'chat' | 'field_visits' | 'analytics' | 'campaigns' | 'worldmonitor' | 'email_workflows';

/** The fields of the signed-in user that decide plan access. */
export interface PlanHolder {
  role?: string;
  isFree?: boolean;
  planName?: string | null;
  /** Paid services the system administrator opened to this Free account. */
  serviceAccess?: string[];
}

/**
 * True when Pro features are locked for this user: same rule the server applies
 * (admins are never on the free plan; a missing or "Free" plan is free).
 */
export function isFreePlanUser(user: PlanHolder | null | undefined): boolean {
  if (!user || user.role === 'admin') return false;
  return Boolean(user.isFree || user.planName?.toLowerCase() === 'free' || !user.planName);
}

/** True when the system administrator granted this account the service beyond its plan. */
export function hasServiceAccess(user: PlanHolder | null | undefined, service: PaidService | undefined): boolean {
  return Boolean(service && user?.serviceAccess?.includes(service));
}

/** Locked out of a paid service: on the Free plan and not granted that service. */
export function lacksPaidAccess(user: PlanHolder | null | undefined, service?: PaidService): boolean {
  return isFreePlanUser(user) && !hasServiceAccess(user, service);
}

/** A Pro menu item stays locked on the Free plan unless the account was granted the item's service. */
export function isMenuItemLocked(user: PlanHolder | null | undefined, item: { requiresPro?: boolean; service?: PaidService }): boolean {
  return Boolean(item.requiresPro) && lacksPaidAccess(user, item.service);
}
