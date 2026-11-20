/**
 * Sign-in with a phone number and a 6-digit code sent by SMS, for people who have a
 * browser only now and then. Codes are stored as keyed hashes, last 5 minutes, allow 5
 * tries, and are limited per number and per network address.
 */
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { config } from '@/config';
import { query } from '@/services/databaseService';
import { smsService } from '@/services/smsService';
import { smsCopy } from '@/services/sms/smsCopy';
import type { LoginUserRow } from '@/routes/auth/loginCompletion';

export const CODE_TTL_MINUTES = 5;
export const CODE_MAX_ATTEMPTS = 5;
const PER_PHONE_PER_15_MIN = 3;
const PER_IP_PER_15_MIN = 10;

export function normalisePhone(raw: string): string | null {
    const phone = smsService.formatPhoneNumber(raw);
    return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

function hashCode(phone: string, code: string): string {
    return crypto.createHmac('sha256', String(config.jwt.secret)).update(`${phone}:${code}`).digest('hex');
}

/**
 * The account a phone number signs in to: a user with that number, or the farmer's account.
 * Administrators always sign in with email, password and two-factor.
 */
export async function accountForPhone(phone: string): Promise<LoginUserRow | null> {
    const digits = phone.replace(/\D/g, '');
    const { rows } = await query<LoginUserRow & { is_active: boolean | null }>(
        `SELECT u.* FROM users u
          WHERE regexp_replace(COALESCE(u.phone, ''), '\\D', '', 'g') = $1
             OR u.id IN (SELECT user_id FROM farmers WHERE regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = $1)
            AND u.role IN ('farmer', 'extension_officer', 'regional_manager')
          ORDER BY (regexp_replace(COALESCE(u.phone, ''), '\\D', '', 'g') = $1) DESC, u.created_at
          LIMIT 1`,
        [digits],
    );
    const user = rows[0];
    return user && user.is_active !== false ? user : null;
}

/**
 * A farmer who joined by SMS has a farmer record but no account. A verified code proves
 * they hold the number, so the account is created then (no usable password or email;
 * the address uses the reserved .invalid domain so nothing is ever mailed to it).
 */
export async function createFarmerAccountForPhone(phone: string): Promise<LoginUserRow | null> {
    const digits = phone.replace(/\D/g, '');
    const { rows: farmers } = await query<{ id: string; first_name: string; last_name: string; region: string | null; tenant_id: string | null }>(
        `SELECT id, first_name, last_name, region, tenant_id FROM farmers
          WHERE user_id IS NULL AND regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = $1
          ORDER BY created_at LIMIT 1`,
        [digits],
    );
    const farmer = farmers[0];
    if (!farmer) return null;
    const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const { rows } = await query<LoginUserRow>(
        `INSERT INTO users (email, password_hash, first_name, last_name, role, region, phone, tenant_id)
         VALUES ($1, $2, $3, $4, 'farmer', $5, $6, $7) RETURNING *`,
        [`sms-${farmer.id}@phone.invalid`, unusablePassword, farmer.first_name, farmer.last_name, farmer.region, phone, farmer.tenant_id],
    );
    await query('UPDATE farmers SET user_id = $2 WHERE id = $1 AND user_id IS NULL', [farmer.id, rows[0].id]);
    return rows[0];
}

async function farmerByPhone(phone: string): Promise<{ id: string; language_preference: string | null } | null> {
    const { rows } = await query<{ id: string; language_preference: string | null }>(
        `SELECT id, language_preference FROM farmers WHERE regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = $1 LIMIT 1`,
        [phone.replace(/\D/g, '')],
    );
    return rows[0] ?? null;
}

const farmerLanguage = async (phone: string) => (await farmerByPhone(phone))?.language_preference ?? null;

export type CodeRequestOutcome = 'sent' | 'rate_limited' | 'unknown_number' | 'send_failed';

/** Send a code when the number belongs to an account or a farmer, within the limits. */
export async function requestLoginCode(phone: string, ipAddress: string | null): Promise<CodeRequestOutcome> {
    const { rows } = await query<{ by_phone: string; by_ip: string }>(
        `SELECT COUNT(*) FILTER (WHERE phone = $1) AS by_phone,
                COUNT(*) FILTER (WHERE ip_address = $2) AS by_ip
           FROM phone_login_codes WHERE created_at > NOW() - INTERVAL '15 minutes'`,
        [phone, ipAddress],
    );
    if (Number(rows[0]?.by_phone ?? 0) >= PER_PHONE_PER_15_MIN || Number(rows[0]?.by_ip ?? 0) >= PER_IP_PER_15_MIN) {
        return 'rate_limited';
    }
    const account = await accountForPhone(phone);
    if (!account && !(await farmerByPhone(phone))) return 'unknown_number';

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await query(
        `INSERT INTO phone_login_codes (phone, code_hash, expires_at, ip_address)
         VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval, $4)`,
        [phone, hashCode(phone, code), String(CODE_TTL_MINUTES), ipAddress],
    );
    const text = smsCopy('login_code', await farmerLanguage(phone)).replace('{code}', code).replace('{minutes}', String(CODE_TTL_MINUTES));
    const sent = await smsService.sendSMS({ to: phone, message: text });
    return sent ? 'sent' : 'send_failed';
}

export type CodeCheckOutcome = 'ok' | 'invalid' | 'expired' | 'too_many_attempts';

/** Check the newest unused code for the number; each wrong try counts. */
export async function checkLoginCode(phone: string, code: string): Promise<CodeCheckOutcome> {
    const { rows } = await query<{ id: string; code_hash: string; attempts: number; expired: boolean }>(
        `SELECT id, code_hash, attempts, expires_at < NOW() AS expired FROM phone_login_codes
          WHERE phone = $1 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`,
        [phone],
    );
    const row = rows[0];
    if (!row) return 'invalid';
    if (row.expired) return 'expired';
    if (row.attempts >= CODE_MAX_ATTEMPTS) return 'too_many_attempts';
    const expected = Buffer.from(row.code_hash, 'hex');
    const given = Buffer.from(hashCode(phone, code.trim()), 'hex');
    if (expected.length === given.length && crypto.timingSafeEqual(expected, given)) {
        await query('UPDATE phone_login_codes SET consumed_at = NOW() WHERE id = $1', [row.id]);
        return 'ok';
    }
    await query('UPDATE phone_login_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    return row.attempts + 1 >= CODE_MAX_ATTEMPTS ? 'too_many_attempts' : 'invalid';
}
