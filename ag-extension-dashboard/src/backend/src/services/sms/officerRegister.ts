/**
 * REG: an officer registers a farmer by SMS from the field.
 *
 *   REG 0712345678 Jane Wanjiku, maize, Kaptembwo
 *
 * The number is read in the officer's country. The farmer is assigned to the officer (a
 * manager's registrations stay unassigned, in the manager's region), and is sent a
 * confirmation that says who their officer is and how to stop notices.
 */
import { query } from '@/services/databaseService';
import { defaultCountryName, phoneVariants, toE164 } from '@/services/country/phone';
import { sendFarmerNotice, noticeInBackground } from '@/services/notify/farmerNotices';
import type { SmsStaff } from './officerSmsAccess';
import { refsFor } from './officerSmsData';

export const REG_USAGE = 'Send REG, the farmer\'s phone, name, crop and village. Example: REG 0712345678 Jane Wanjiku, maize, Kaptembwo';

export interface RegInput {
    phone: string;
    firstName: string;
    lastName: string;
    crop: string | null;
    village: string | null;
}

/** Read "0712345678 Jane Wanjiku, maize, Kaptembwo"; null when the phone or name is missing. */
export function parseReg(text: string, country: string): RegInput | null {
    const match = /^\s*(\+?[\d\s-]{7,20}?)\s+([^\d,][^,]*)(?:,([^,]*))?(?:,(.*))?$/.exec(text);
    if (!match) return null;
    const phone = toE164(match[1].replace(/[\s-]/g, ''), country);
    const names = match[2].trim().split(/\s+/);
    if (!phone || names.length === 0 || !names[0]) return null;
    const clean = (value?: string) => value?.trim().slice(0, 100) || null;
    return {
        phone,
        firstName: names[0].slice(0, 100),
        lastName: names.slice(1).join(' ').slice(0, 100),
        crop: clean(match[3])?.toLowerCase() ?? null,
        village: clean(match[4]),
    };
}

async function existingFarmer(phone: string): Promise<{ id: string; name: string; assigned_officer_id: string | null; region: string | null } | null> {
    const forms = phoneVariants(phone).map(form => form.replace(/\D/g, ''));
    const { rows } = await query<{ id: string; name: string; assigned_officer_id: string | null; region: string | null }>(
        `SELECT id, TRIM(first_name || ' ' || last_name) AS name, assigned_officer_id, region FROM farmers
          WHERE regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = ANY($1) AND COALESCE(is_demo, false) = false
          ORDER BY created_at LIMIT 1`,
        [forms],
    );
    return rows[0] ?? null;
}

export async function registerFarmerBySms(staff: SmsStaff, text: string): Promise<string> {
    const country = staff.country || defaultCountryName();
    const input = parseReg(text, country);
    if (!input) return REG_USAGE;

    const existing = await existingFarmer(input.phone);
    if (existing) {
        const mine = staff.role === 'regional_manager' ? existing.region === staff.region : existing.assigned_officer_id === staff.id;
        if (!mine) return 'That number is already registered with another officer. Ask your manager to move the farmer to you.';
        const ref = (await refsFor(staff.id, [existing.id])).get(existing.id);
        return `Already registered: ${ref} ${existing.name}.`;
    }

    const officerId = staff.role === 'extension_officer' ? staff.id : null;
    const { rows } = await query<{ id: string }>(
        `INSERT INTO farmers (first_name, last_name, phone, region, village, crops, tenant_id, assigned_officer_id, country, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Registered by SMS by an officer')
         RETURNING id`,
        [input.firstName, input.lastName, input.phone, staff.region, input.village,
         input.crop ? [input.crop] : [], staff.tenant_id, officerId, country],
    );
    const farmerId = rows[0].id;
    if (officerId) {
        await query(
            `INSERT INTO farmer_assignment_history (farmer_id, officer_id, reassigned_by, reason)
             VALUES ($1, $2, $2, 'Registered by SMS by the officer')`,
            [farmerId, officerId],
        );
    }
    const ref = (await refsFor(staff.id, [farmerId])).get(farmerId);
    const officer = staff.first_name?.trim() || 'your extension officer';
    noticeInBackground('registration', () => sendFarmerNotice(farmerId, 'registered', { officer }));
    return `Registered ${ref} ${`${input.firstName} ${input.lastName}`.trim()}. A confirmation SMS is on its way to them. Add farm size and location in the app.`;
}
