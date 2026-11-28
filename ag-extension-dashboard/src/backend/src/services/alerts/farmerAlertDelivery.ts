/**
 * Alerts to the farmers they concern, by the channel each farmer last used (SMS otherwise).
 *
 * Only alerts marked notify_farmers go out: forecast severe weather and rain before a harvest
 * (statements of the forecast, no advice) and alerts an officer chose to send. Alerts written by the AI alert
 * tool never are, because their text carries the tool's own recommendations.
 *
 * Off unless FARMER_ALERTS_ENABLED=true: every SMS is paid for. A farmer gets each alert at
 * most once (alert_deliveries is written before the send), no more than
 * FARMER_ALERTS_DAILY_CAP a day (default 2), only between 06:00 and 20:00 their time, and
 * none after STOP. A skipped alert is tried again on the next run until it expires.
 */
import { query } from '@/services/databaseService';
import { sendFarmerNotice, visitDateText, type NoticeVars } from '@/services/notify/farmerNotices';
import { weatherConditionText, type NoticeKey } from '@/services/notify/noticeCopy';
import { timeZoneFor } from '@/services/country/localTime';
import { logger } from '@/utils/logger';

const DEFAULT_DAILY_CAP = 2;
const MAX_SENDS_PER_RUN = 300;
export const QUIET_BEFORE_HOUR = 6;
export const QUIET_FROM_HOUR = 20;

export interface PendingDelivery {
    alert_id: string;
    type: string;
    title: string;
    details: Record<string, unknown> | null;
    farmer_id: string;
    country: string | null;
    sent_today: string | number;
}

export function farmerAlertsEnabled(): boolean {
    return process.env.FARMER_ALERTS_ENABLED === 'true';
}

export function dailyCap(): number {
    const cap = Number(process.env.FARMER_ALERTS_DAILY_CAP);
    return Number.isInteger(cap) && cap > 0 ? cap : DEFAULT_DAILY_CAP;
}

/** Whether it is daytime where the farmer lives. */
export function withinWakingHours(now: Date, country: string | null): boolean {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: timeZoneFor({ country }) }).format(now));
    return hour >= QUIET_BEFORE_HOUR && hour < QUIET_FROM_HOUR;
}

function text(details: Record<string, unknown> | null, name: string): string | null {
    const value = details?.[name];
    return typeof value === 'string' && value.trim() ? value : null;
}

/** The notice for one alert, worded for the farmer who gets it. */
export function noticeFor(delivery: PendingDelivery): { key: NoticeKey; vars: NoticeVars } {
    const details = delivery.details;
    if (delivery.type === 'weather') {
        const date = text(details, 'date');
        const condition = text(details, 'condition') ?? 'Severe weather';
        const rain = details?.rainMm;
        const hasRain = typeof rain === 'number' && Number.isFinite(rain) && rain > 0;
        return {
            key: hasRain ? 'weather_warning_rain' : 'weather_warning',
            vars: farmer => ({
                // Midday UTC keeps the forecast's calendar day in every African time zone.
                date: date ? visitDateText(new Date(`${date}T12:00:00Z`), farmer.language, farmer.country) : '',
                condition: weatherConditionText(condition, farmer.language),
                mm: hasRain ? String(rain) : '',
            }),
        };
    }
    if (delivery.type === 'harvest_rain') {
        const date = text(details, 'date');
        const harvest = text(details, 'harvestDate');
        return {
            key: 'harvest_rain',
            vars: farmer => ({
                date: date ? visitDateText(new Date(`${date}T12:00:00Z`), farmer.language, farmer.country) : '',
                harvest: harvest ? visitDateText(new Date(`${harvest}T12:00:00Z`), farmer.language, farmer.country) : '',
                condition: weatherConditionText(text(details, 'condition') ?? 'Moderate rain', farmer.language),
                crop: text(details, 'crop') ?? '',
            }),
        };
    }
    return {
        key: 'officer_alert',
        vars: { officer: text(details, 'officerName') ?? 'Your extension officer', title: delivery.title },
    };
}

async function pendingDeliveries(cap: number): Promise<PendingDelivery[]> {
    const { rows } = await query<PendingDelivery>(
        `SELECT a.id AS alert_id, a.type, a.title, a.details, f.id AS farmer_id, f.country,
                (SELECT COUNT(*) FROM alert_deliveries d2
                  WHERE d2.farmer_id = f.id AND d2.outcome IN ('pending', 'sent')
                    AND d2.created_at > NOW() - INTERVAL '24 hours') AS sent_today
           FROM alerts a
           CROSS JOIN LATERAL unnest(a.affected_farmers) AS af(farmer_id)
           JOIN farmers f ON f.id = af.farmer_id
          WHERE a.is_active = TRUE AND a.notify_farmers = TRUE
            AND COALESCE(a.expires_at, a.triggered_at + INTERVAL '3 days') > NOW()
            AND NOT EXISTS (SELECT 1 FROM alert_deliveries d WHERE d.alert_id = a.id AND d.farmer_id = f.id)
            AND (SELECT COUNT(*) FROM alert_deliveries d3
                  WHERE d3.farmer_id = f.id AND d3.outcome IN ('pending', 'sent')
                    AND d3.created_at > NOW() - INTERVAL '24 hours') < $1
          ORDER BY CASE a.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, a.triggered_at
          LIMIT $2`,
        [cap, MAX_SENDS_PER_RUN],
    );
    return rows;
}

/** One pass. Returns how many notices were sent. */
export async function deliverFarmerAlerts(now: Date = new Date()): Promise<number> {
    if (!farmerAlertsEnabled()) return 0;
    const cap = dailyCap();
    const sentToday = new Map<string, number>();
    let sent = 0;
    for (const delivery of await pendingDeliveries(cap)) {
        const count = sentToday.get(delivery.farmer_id) ?? Number(delivery.sent_today);
        if (count >= cap || !withinWakingHours(now, delivery.country)) continue;
        const claimed = await query<{ id: string }>(
            `INSERT INTO alert_deliveries (alert_id, farmer_id) VALUES ($1, $2)
             ON CONFLICT (alert_id, farmer_id) DO NOTHING RETURNING id`,
            [delivery.alert_id, delivery.farmer_id],
        );
        const deliveryId = claimed.rows[0]?.id;
        if (!deliveryId) continue;
        const { key, vars } = noticeFor(delivery);
        const outcome = await sendFarmerNotice(delivery.farmer_id, key, vars);
        await query('UPDATE alert_deliveries SET outcome = $1 WHERE id = $2', [outcome, deliveryId]);
        if (outcome === 'sent') {
            sent++;
            sentToday.set(delivery.farmer_id, count + 1);
        }
    }
    if (sent > 0) logger.info(`Farmer alerts: ${sent} notice(s) sent`);
    return sent;
}
