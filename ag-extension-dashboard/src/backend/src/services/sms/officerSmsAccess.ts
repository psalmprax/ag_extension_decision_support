/**
 * Who is texting from a staff number, and the PIN that unlocks SMS commands. Staff see
 * other people's data, so a correct PIN unlocks commands for 24 hours; five wrong tries
 * lock SMS commands until the PIN is set again on the web.
 */
import bcrypt from 'bcryptjs';
import { query } from '@/services/databaseService';
import { phoneVariants } from '@/services/country/phone';

export interface SmsStaff {
    id: string;
    role: 'extension_officer' | 'regional_manager';
    first_name: string | null;
    region: string | null;
    tenant_id: string | null;
    language: string | null;
    sms_pin_hash: string | null;
    sms_pin_failed_attempts: number;
    sms_pin_locked: boolean;
    sms_unlocked_until: Date | null;
    country?: string | null;
    time_zone?: string | null;
}

export const PIN_MAX_ATTEMPTS = 5;
const UNLOCK_HOURS = 24;

/** An active officer or manager whose phone number matches, or null. */
export async function findStaffByPhone(phone: string): Promise<SmsStaff | null> {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) return null;
    // Staff numbers may be stored as +254712…, 254712… or 0712…: match any of them.
    const forms = phoneVariants(phone).map(form => form.replace(/\D/g, ''));
    const { rows } = await query<SmsStaff>(
        `SELECT id, role, first_name, region, tenant_id, NULL::text AS language, sms_pin_hash,
                sms_pin_failed_attempts, sms_pin_locked, sms_unlocked_until, country, time_zone
           FROM users
          WHERE regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = ANY($1)
            AND role IN ('extension_officer', 'regional_manager')
            AND COALESCE(is_active, true) = true
          ORDER BY created_at LIMIT 1`,
        [forms],
    );
    return rows[0] ?? null;
}

export const isValidPin = (pin: string) => /^\d{4}$/.test(pin) && !/^(\d)\1{3}$/.test(pin) && !['1234', '4321', '0123'].includes(pin);

export function isUnlocked(staff: SmsStaff, now = new Date()): boolean {
    return !staff.sms_pin_locked && Boolean(staff.sms_unlocked_until && new Date(staff.sms_unlocked_until) > now);
}

export type PinOutcome = 'unlocked' | 'wrong' | 'locked' | 'no_pin';

/** Check a PIN; a correct one unlocks commands for a day and clears the failure count. */
export async function tryPin(staff: SmsStaff, pin: string): Promise<PinOutcome> {
    if (staff.sms_pin_locked) return 'locked';
    if (!staff.sms_pin_hash) return 'no_pin';
    if (await bcrypt.compare(pin, staff.sms_pin_hash)) {
        await query(
            `UPDATE users SET sms_pin_failed_attempts = 0, sms_unlocked_until = NOW() + ($2 || ' hours')::interval WHERE id = $1`,
            [staff.id, String(UNLOCK_HOURS)],
        );
        return 'unlocked';
    }
    const { rows } = await query<{ sms_pin_locked: boolean }>(
        `UPDATE users SET sms_pin_failed_attempts = sms_pin_failed_attempts + 1,
                sms_pin_locked = sms_pin_failed_attempts + 1 >= $2, sms_unlocked_until = NULL
          WHERE id = $1 RETURNING sms_pin_locked`,
        [staff.id, PIN_MAX_ATTEMPTS],
    );
    return rows[0]?.sms_pin_locked ? 'locked' : 'wrong';
}

/** Set (or reset) the PIN. Clears a lock and any unlocked session. */
export async function setSmsPin(userId: string, pin: string): Promise<void> {
    const hash = await bcrypt.hash(pin, 10);
    await query(
        `UPDATE users SET sms_pin_hash = $2, sms_pin_failed_attempts = 0, sms_pin_locked = false, sms_unlocked_until = NULL
          WHERE id = $1`,
        [userId, hash],
    );
}

/** End the unlocked period now (the LOCK command). */
export async function lockSmsCommands(userId: string): Promise<void> {
    await query('UPDATE users SET sms_unlocked_until = NULL WHERE id = $1', [userId]);
}
