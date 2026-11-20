/**
 * After an officer replies to a farmer in a running pilot's service group, the farmer is
 * asked some days later whether they did what was advised. At most one question per farmer
 * per week, so farmers are not pestered.
 */
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { sendFarmerNotice, visitDateText } from '@/services/notify/farmerNotices';

export const FOLLOWUP_DAYS = Number(process.env.PILOT_FOLLOWUP_DAYS || 7);

/** Queue a follow-up for the officer's reply, when the farmer is in a running pilot's service group. */
export async function queueAdviceFollowUp(conversationId: string, messageId: string): Promise<boolean> {
    const { rows } = await query<{ id: string }>(
        `INSERT INTO advice_followups (pilot_id, farmer_id, message_id, due_at)
         SELECT pf.pilot_id, pf.farmer_id, $2, NOW() + make_interval(days => $3)
           FROM chat_conversations cv
           JOIN pilot_farmers pf ON pf.farmer_id = cv.farmer_id AND pf.arm = 'service'
           JOIN pilots p ON p.id = pf.pilot_id AND p.status = 'running'
          WHERE cv.id = $1
            AND NOT EXISTS (SELECT 1 FROM advice_followups a
                             WHERE a.farmer_id = pf.farmer_id AND a.due_at > NOW() - INTERVAL '7 days')
          LIMIT 1
         RETURNING id`,
        [conversationId, messageId, FOLLOWUP_DAYS],
    );
    return rows.length > 0;
}

/** Send the follow-ups that are due. Run on one server at a time. */
export async function sendDueFollowUps(limit = 200): Promise<number> {
    const { rows } = await query<{ id: string; farmer_id: string; advised_at: Date; language_preference: string | null; country: string | null }>(
        `SELECT a.id, a.farmer_id, COALESCE(m.created_at, a.due_at) AS advised_at, f.language_preference, f.country
           FROM advice_followups a
           JOIN farmers f ON f.id = a.farmer_id
           JOIN pilots p ON p.id = a.pilot_id AND p.status = 'running'
           LEFT JOIN chat_messages m ON m.id = a.message_id
          WHERE a.asked_at IS NULL AND a.due_at <= NOW()
          ORDER BY a.due_at LIMIT $1`,
        [limit],
    );
    let sent = 0;
    for (const row of rows) {
        const outcome = await sendFarmerNotice(row.farmer_id, 'advice_followup', {
            date: visitDateText(new Date(row.advised_at), row.language_preference, row.country),
        });
        // A question that could not be sent (STOP, no phone) is dropped, so it neither
        // retries every tick nor counts as unanswered in the results.
        if (outcome === 'sent') {
            await query('UPDATE advice_followups SET asked_at = NOW() WHERE id = $1', [row.id]);
            sent += 1;
        } else {
            await query('DELETE FROM advice_followups WHERE id = $1', [row.id]);
        }
    }
    if (sent) logger.info(`Pilot follow-ups sent: ${sent}`);
    return sent;
}
