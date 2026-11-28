/**
 * Notices to a farmer outside a conversation: registration confirmed, a visit planned,
 * moved or cancelled. They go on the channel the farmer last wrote from (WhatsApp or
 * Telegram), else by SMS to the phone on their record. A farmer who sent STOP gets none.
 */
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { smsService } from '@/services/smsService';
import { noticeOnChannel, replyChannelFor } from '@/services/chat/channelThread';
import { timeZoneFor } from '@/services/country/localTime';
import { findCountry } from '@/shared-api/countries';
import { smsLanguage } from '@/services/sms/smsCopy';
import { noticeText, type NoticeKey } from './noticeCopy';

export type NoticeOutcome = 'sent' | 'opted_out' | 'no_contact' | 'failed';

interface NoticeFarmer {
    id: string;
    phone: string | null;
    language_preference: string | null;
    sms_opt_out: boolean | null;
    country: string | null;
    thread_id: string | null;
}

async function loadFarmer(farmerId: string): Promise<NoticeFarmer | null> {
    const { rows } = await query<NoticeFarmer>(
        `SELECT f.id, f.phone, f.language_preference, f.sms_opt_out, f.country,
                (SELECT cv.id FROM chat_conversations cv
                  WHERE cv.farmer_id = f.id AND cv.kind = 'farmer_thread'
                  ORDER BY cv.started_at DESC NULLS LAST LIMIT 1) AS thread_id
           FROM farmers f WHERE f.id = $1`,
        [farmerId],
    );
    return rows[0] ?? null;
}

/** Words for a notice, fixed or worked out for the farmer (their language, their country's dates). */
export type NoticeVars = Record<string, string> | ((farmer: { language: string | null; country: string | null }) => Record<string, string>);

/** Send one notice. `always` is for the STOP and START confirmations themselves. */
export async function sendFarmerNotice(
    farmerId: string,
    key: NoticeKey,
    vars: NoticeVars = {},
    options: { always?: boolean } = {},
): Promise<NoticeOutcome> {
    try {
        const farmer = await loadFarmer(farmerId);
        if (!farmer) return 'no_contact';
        if (farmer.sms_opt_out && !options.always) return 'opted_out';
        const words = typeof vars === 'function' ? vars({ language: farmer.language_preference, country: farmer.country }) : vars;
        const text = noticeText(key, farmer.language_preference, words);
        const channel = farmer.thread_id ? await replyChannelFor(farmer.thread_id) : null;
        if (farmer.thread_id && (channel === 'whatsapp' || channel === 'telegram')) {
            await noticeOnChannel(farmer.thread_id, channel, text);
            return 'sent';
        }
        if (!farmer.phone) return 'no_contact';
        return (await smsService.sendSMS({ to: farmer.phone, message: text, farmerId })) ? 'sent' : 'failed';
    } catch (error) {
        logger.warn(`Notice ${key} to farmer ${farmerId} failed:`, error);
        return 'failed';
    }
}

/** A visit date as the farmer reads it: "Tue 25 Nov" in their language and time zone. */
export function visitDateText(when: Date, language: string | null | undefined, country: string | null | undefined): string {
    // The language with the country (en-MW, fr-SN) gives the local day-month order.
    const iso2 = findCountry(country)?.iso2;
    const locale = iso2 ? `${smsLanguage(language)}-${iso2}` : smsLanguage(language);
    return new Intl.DateTimeFormat(locale, {
        weekday: 'short', day: 'numeric', month: 'short', timeZone: timeZoneFor({ country }),
    }).format(when);
}

export type VisitChange = 'planned' | 'moved' | 'cancelled';
const VISIT_NOTICE: Record<VisitChange, NoticeKey> = { planned: 'visit_planned', moved: 'visit_moved', cancelled: 'visit_cancelled' };

/** Tell the farmer about a planned visit (only for visits still ahead). */
export async function notifyVisitChange(visitId: string, change: VisitChange): Promise<NoticeOutcome> {
    const { rows } = await query<{ farmer_id: string; scheduled_at: Date | null; officer: string | null; language_preference: string | null; country: string | null }>(
        `SELECT v.farmer_id, v.scheduled_at, NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), '') AS officer,
                f.language_preference, f.country
           FROM visits v
           JOIN farmers f ON f.id = v.farmer_id
           LEFT JOIN users u ON u.id = v.officer_id
          WHERE v.id = $1`,
        [visitId],
    );
    const visit = rows[0];
    if (!visit?.scheduled_at || new Date(visit.scheduled_at).getTime() < Date.now() - 12 * 3_600_000) return 'no_contact';
    return sendFarmerNotice(visit.farmer_id, VISIT_NOTICE[change], {
        officer: visit.officer ?? 'Your extension officer',
        date: visitDateText(new Date(visit.scheduled_at), visit.language_preference, visit.country),
    });
}

/** Run a notice after the response, so a slow gateway never holds up the person. */
export function noticeInBackground(label: string, work: () => Promise<unknown>): void {
    setImmediate(() => {
        work().catch(error => logger.warn(`Notice (${label}) failed:`, error));
    });
}
