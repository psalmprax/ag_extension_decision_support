/**
 * The officer's morning digest: one in-app notice at 06:00 their time saying what needs
 * them today. It is sent once per officer and local day (found again by metadata), and not
 * at all on a day with nothing to say.
 */
import { query } from '@/services/databaseService';
import { notificationService } from '@/services/notificationService';
import { timeZoneFor } from '@/services/country/localTime';
import { logger } from '@/utils/logger';

export const DIGEST_HOUR = 6;
const DIGEST_KIND = 'morning_digest';

export interface DigestCounts {
    visits_ahead: string | number;
    overdue: string | number;
    follow_ups: string | number;
    alerts: string | number;
}

interface DigestOfficer extends DigestCounts {
    id: string;
    country: string | null;
    time_zone: string | null;
}

function plural(n: number, one: string, many: string): string {
    return `${n} ${n === 1 ? one : many}`;
}

/** The digest text, or null when there is nothing for the officer today. */
export function digestMessage(counts: DigestCounts): string | null {
    const visits = Number(counts.visits_ahead);
    const overdue = Number(counts.overdue);
    const followUps = Number(counts.follow_ups);
    const alerts = Number(counts.alerts);
    const parts = [
        visits > 0 ? `${plural(visits, 'visit', 'visits')} in the next 24 hours` : null,
        overdue > 0 ? plural(overdue, 'overdue visit', 'overdue visits') : null,
        followUps > 0 ? plural(followUps, 'follow-up due', 'follow-ups due') : null,
        alerts > 0 ? `${plural(alerts, 'new alert', 'new alerts')} about your farmers` : null,
    ].filter((part): part is string => part !== null);
    return parts.length > 0 ? `${parts.join(', ')}.` : null;
}

/** The officer's local date (YYYY-MM-DD) and hour. */
export function localClock(now: Date, timeZone: string): { date: string; hour: number } {
    const parts = new Intl.DateTimeFormat('en-CA', {
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', timeZone,
    }).formatToParts(now);
    const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    return { date: `${part('year')}-${part('month')}-${part('day')}`, hour: Number(part('hour')) };
}

async function officersWithCounts(): Promise<DigestOfficer[]> {
    const { rows } = await query<DigestOfficer>(
        `SELECT u.id, u.country, u.time_zone,
                (SELECT COUNT(*) FROM visits v WHERE v.officer_id = u.id AND v.status = 'scheduled'
                   AND v.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours') AS visits_ahead,
                (SELECT COUNT(*) FROM visits v WHERE v.officer_id = u.id AND v.status = 'scheduled'
                   AND v.scheduled_at < NOW() - INTERVAL '1 hour') AS overdue,
                (SELECT COUNT(*) FROM visits v WHERE v.officer_id = u.id AND v.status = 'completed'
                   AND v.follow_up_required = TRUE AND v.completed_at < NOW() - INTERVAL '7 days'
                   AND NOT EXISTS (SELECT 1 FROM visits later WHERE later.farmer_id = v.farmer_id
                                     AND later.id <> v.id AND later.created_at > v.completed_at)) AS follow_ups,
                (SELECT COUNT(*) FROM alerts a WHERE a.is_active = TRUE AND a.triggered_at > NOW() - INTERVAL '24 hours'
                   AND EXISTS (SELECT 1 FROM farmers f WHERE f.assigned_officer_id = u.id
                                 AND f.id = ANY(a.affected_farmers))) AS alerts
           FROM users u
          WHERE u.role = 'extension_officer' AND u.is_active = TRUE`,
    );
    return rows;
}

async function alreadySent(userId: string, date: string): Promise<boolean> {
    const { rows } = await query(
        `SELECT 1 FROM notifications WHERE user_id = $1 AND metadata->>'kind' = $2 AND metadata->>'date' = $3 LIMIT 1`,
        [userId, DIGEST_KIND, date],
    );
    return rows.length > 0;
}

/** One pass. Returns how many digests were sent. */
export async function sendOfficerDigests(now: Date = new Date()): Promise<number> {
    let sent = 0;
    for (const officer of await officersWithCounts()) {
        const { date, hour } = localClock(now, timeZoneFor({ timeZone: officer.time_zone, country: officer.country }));
        if (hour !== DIGEST_HOUR) continue;
        const message = digestMessage(officer);
        if (!message || (await alreadySent(officer.id, date))) continue;
        const delivered = await notificationService.send({
            userId: officer.id,
            type: 'info',
            title: 'Your day',
            message,
            channel: 'in_app',
            metadata: { kind: DIGEST_KIND, date },
        });
        if (delivered) sent++;
    }
    if (sent > 0) logger.info(`Officer digests: ${sent} sent`);
    return sent;
}
