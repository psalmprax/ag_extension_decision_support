/**
 * Alerts an officer must look at before farmers hear anything: crop stress seen from space
 * and possible outbreaks nearby. The officer writes the message in their own words and sends
 * it to their own farmers among those named (an administrator, to all of them). The message
 * becomes a new alert marked notify_farmers, in the officer's name; the original stays for
 * other officers. Each officer can send once per alert.
 */
import { query } from '@/services/databaseService';
import { farmerAlertsEnabled } from './farmerAlertDelivery';

export const REVIEW_TYPES = ['crop_stress', 'outbreak'] as const;
export const MESSAGE_MAX = 300;

export interface Reviewer { userId: string; role: string }

export interface ReviewItem {
    id: string;
    type: string;
    severity: string | null;
    title: string;
    description: string | null;
    details: Record<string, unknown> | null;
    triggered_at: Date;
    my_farmers: number;
}

/** "My farmers" for an officer; every farmer for an administrator. */
function mine(alias: string, reviewer: Reviewer): string {
    return reviewer.role === 'admin' ? 'TRUE' : `${alias}.assigned_officer_id = $1`;
}

export async function alertsToReview(reviewer: Reviewer): Promise<ReviewItem[]> {
    const { rows } = await query<ReviewItem & { my_farmers: string }>(
        `SELECT * FROM (
            SELECT a.id, a.type, a.severity, a.title, a.description, a.details, a.triggered_at,
                   (SELECT COUNT(*) FROM farmers f WHERE f.id = ANY(a.affected_farmers) AND ${mine('f', reviewer)}) AS my_farmers
              FROM alerts a
             WHERE a.is_active = TRUE AND a.notify_farmers = FALSE AND a.type = ANY($2::text[])
               AND COALESCE(a.expires_at, a.triggered_at + INTERVAL '14 days') > NOW()
               AND NOT EXISTS (SELECT 1 FROM alerts sent WHERE sent.dedupe_key = 'review:' || a.id || ':' || $1)
         ) pending
         WHERE my_farmers > 0
         ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, triggered_at DESC
         LIMIT 50`,
        [reviewer.userId, [...REVIEW_TYPES]],
    );
    return rows.map(row => ({ ...row, my_farmers: Number(row.my_farmers) }));
}

export type SendResult =
    | { status: 'sent'; alertId: string; farmers: number; textingOn: boolean }
    | { status: 'not_found' | 'no_farmers' | 'already_sent' };

export async function sendReviewedAlert(alertId: string, reviewer: Reviewer, message: string): Promise<SendResult> {
    const { rows: [alert] } = await query<{ id: string; type: string; severity: string | null; location: string | null; tenant_id: string | null }>(
        `SELECT id, type, severity, location, tenant_id FROM alerts
          WHERE id = $1 AND is_active = TRUE AND notify_farmers = FALSE AND type = ANY($2::text[])`,
        [alertId, [...REVIEW_TYPES]],
    );
    if (!alert) return { status: 'not_found' };
    const { rows: farmers } = await query<{ id: string }>(
        `SELECT f.id FROM farmers f, alerts a WHERE a.id = $2 AND f.id = ANY(a.affected_farmers) AND ${mine('f', reviewer)}`,
        [reviewer.userId, alertId],
    );
    if (farmers.length === 0) return { status: 'no_farmers' };
    const { rows: [officer] } = await query<{ name: string | null }>(
        `SELECT NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '') AS name FROM users WHERE id = $1`,
        [reviewer.userId],
    );
    const { rows: [created] } = await query<{ id: string }>(
        // Staff already know (they are reviewing it), so alert_notification_sent starts TRUE.
        `INSERT INTO alerts (type, severity, title, description, location, affected_farmers, tenant_id, is_active, triggered_at,
                             notify_farmers, dedupe_key, expires_at, details, alert_notification_sent)
         VALUES ($1, $2, $3, $3, $4, $5, $6, TRUE, NOW(), TRUE, $7, NOW() + INTERVAL '3 days', $8, TRUE)
         ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`,
        [
            alert.type, alert.severity, message, alert.location, farmers.map(f => f.id), alert.tenant_id,
            `review:${alert.id}:${reviewer.userId}`,
            JSON.stringify({ officerName: officer?.name ?? null, reviewOf: alert.id }),
        ],
    );
    if (!created) return { status: 'already_sent' };
    return { status: 'sent', alertId: created.id, farmers: farmers.length, textingOn: farmerAlertsEnabled() };
}
