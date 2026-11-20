import { query } from '@/services/databaseService';
import { findCountry } from '@/shared-api/countries';
import { logger } from '@/utils/logger';
import { defaultCountryName } from './phone';

/**
 * The country a signed-in person works in: a farmer's own farm country, otherwise the
 * country on their account. Null when neither is recorded, so callers can say so
 * rather than assume one.
 */
export async function countryOfUser(userId?: string | null): Promise<string | null> {
    if (!userId) return null;
    try {
        const { rows } = await query<{ farmer_country: string | null; user_country: string | null }>(
            `SELECT f.country AS farmer_country, u.country AS user_country
               FROM users u LEFT JOIN farmers f ON f.user_id = u.id
              WHERE u.id = $1 LIMIT 1`,
            [userId]
        );
        const name = rows[0]?.farmer_country || rows[0]?.user_country;
        return findCountry(name)?.name ?? null;
    } catch (error) {
        logger.error('Country lookup failed:', error);
        return null;
    }
}

/** The country for a new farmer record: as given if known, else the creator's, else the default. */
export async function farmerCountryFor(requested: unknown, creatorUserId?: string | null): Promise<string> {
    const named = typeof requested === 'string' ? findCountry(requested)?.name : undefined;
    return named ?? (await countryOfUser(creatorUserId)) ?? defaultCountryName();
}
