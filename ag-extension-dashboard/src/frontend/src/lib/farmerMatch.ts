import type { Farmer } from '@/types/dashboard';

/** How an activity, alert or message refers to a farmer. */
export interface FarmerRef {
  farmerId?: string;
  phone?: string;
  farmerName?: string;
}

/**
 * Comparable phone key: digits only, reduced to the last 9 digits so the same
 * number written as +254 712 345 678, 254712345678 or 0712345678 matches.
 * Numbers shorter than 7 digits are not usable as a key.
 */
export function phoneKey(phone: string | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length < 7) return null;
  return digits.slice(-9);
}

function nameKey(name: string | undefined): string | null {
  const key = (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  return key || null;
}

function single<T>(matches: T[]): T | undefined {
  return matches.length === 1 ? matches[0] : undefined;
}

/**
 * Resolve a reference to exactly one farmer: by id first, then by phone, then
 * by full name. Phone and name matches count only when they are unambiguous —
 * opening the wrong farmer's chat is worse than reporting "not found".
 */
export function findFarmer(farmers: readonly Farmer[], ref: FarmerRef): Farmer | undefined {
  if (ref.farmerId) {
    const byId = farmers.find(f => f.id === ref.farmerId);
    if (byId) return byId;
  }
  const phone = phoneKey(ref.phone);
  if (phone) {
    const byPhone = single(farmers.filter(f => phoneKey(f.phone) === phone));
    if (byPhone) return byPhone;
  }
  const name = nameKey(ref.farmerName);
  if (name) {
    return single(farmers.filter(f => nameKey(`${f.firstName} ${f.lastName}`) === name));
  }
  return undefined;
}
