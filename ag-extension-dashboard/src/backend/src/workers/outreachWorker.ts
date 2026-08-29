import { query } from '../services/databaseService';
import { logger } from '../utils/logger';
import { smsService } from '../services/smsService';
import { whatsappService } from '../services/whatsappService';
import { emailService } from '../services/emailService';

/**
 * Outreach Worker
 *
 * Consumes the `outreach_messages` queue written by the Agent Zero service
 * (POST /api/outreach) and actually delivers each message through the
 * configured channel providers.
 *
 * Row lifecycle: queued -> processing -> sent | failed
 * Transient provider failures are retried up to MAX_ATTEMPTS, then the row is
 * marked failed with the provider error. Permanent problems (unsupported
 * channel, no resolvable recipient) fail immediately with a clear error —
 * the worker never reports a message as handled unless a provider accepted it.
 *
 * Auto-starts when imported (outside tests), mirroring alertWorker.
 */

const MAX_ATTEMPTS = 3;
const BATCH_SIZE = 25;
const DEFAULT_INTERVAL_MS = 30 * 1000;

const SUPPORTED_CHANNELS = ['sms', 'whatsapp', 'email'] as const;

export interface OutreachQueueRow {
    id: string;
    farmer_id: string | null;
    recipient: string | null;
    message: string;
    channel: string;
    attempts: number;
}

interface FarmerContactRow {
    phone: string | null;
}

type DeliveryOutcome =
    | { result: 'sent' }
    | { result: 'retry'; error: string }
    | { result: 'failed'; error: string };

export class OutreachWorker {
    private intervalHandle: NodeJS.Timeout | null = null;
    private tableReady = false;

    async ensureTable(): Promise<boolean> {
        try {
            await query(`
                CREATE TABLE IF NOT EXISTS outreach_messages (
                    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                    farmer_id UUID,
                    recipient VARCHAR(64),
                    message TEXT NOT NULL,
                    channel VARCHAR(32) NOT NULL DEFAULT 'sms',
                    status VARCHAR(20) NOT NULL DEFAULT 'queued',
                    priority VARCHAR(20) NOT NULL DEFAULT 'normal',
                    attempts INTEGER NOT NULL DEFAULT 0,
                    last_error TEXT,
                    sent_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);
            await query(
                'CREATE INDEX IF NOT EXISTS idx_outreach_messages_status ON outreach_messages(status, created_at)'
            );
            this.tableReady = true;
            return true;
        } catch (error) {
            this.tableReady = false;
            logger.error('Failed to ensure outreach_messages table:', error);
            return false;
        }
    }

    start(intervalMs: number = DEFAULT_INTERVAL_MS): void {
        if (this.intervalHandle) return;
        logger.info(`Starting outreach worker with ${Math.round(intervalMs / 1000)}s interval`);

        void this.tick();

        this.intervalHandle = setInterval(() => {
            void this.tick();
        }, intervalMs);
    }

    stop(): void {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
    }

    private async tick(): Promise<void> {
        try {
            if (!this.tableReady) {
                this.tableReady = await this.ensureTable();
                if (!this.tableReady) return;
            }
            const processed = await this.processQueue();
            if (processed > 0) {
                logger.info(`Outreach worker delivered ${processed} queued message(s)`);
            }
        } catch (error) {
            logger.warn(
                'Outreach worker tick failed:',
                error instanceof Error ? error.message : error
            );
        }
    }

    async processQueue(): Promise<number> {
        const rows = await this.claimBatch();
        for (const row of rows) {
            await this.deliverRow(row);
        }
        return rows.length;
    }

    /**
     * Atomically claim a batch of queued rows so concurrent worker instances
     * never deliver the same message twice (FOR UPDATE SKIP LOCKED).
     */
    private async claimBatch(): Promise<OutreachQueueRow[]> {
        const result = await query<OutreachQueueRow>(
            `
            UPDATE outreach_messages
            SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
            WHERE id IN (
                SELECT id FROM outreach_messages
                WHERE status = 'queued' AND attempts < $1
                ORDER BY
                    CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                    created_at ASC
                LIMIT $2
                FOR UPDATE SKIP LOCKED
            )
            RETURNING id, farmer_id, recipient, message, channel, attempts
            `,
            [MAX_ATTEMPTS, BATCH_SIZE]
        );
        return result.rows;
    }

    private async deliverRow(row: OutreachQueueRow): Promise<void> {
        try {
            const outcome = await this.dispatch(row);
            if (outcome.result === 'sent') {
                await this.markSent(row.id);
                return;
            }
            await this.markFailure(row, outcome.result === 'retry', outcome.error);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown outreach delivery error';
            await this.markFailure(row, true, message);
        }
    }

    private async dispatch(row: OutreachQueueRow): Promise<DeliveryOutcome> {
        if (!(SUPPORTED_CHANNELS as readonly string[]).includes(row.channel)) {
            return { result: 'failed', error: `Unsupported outreach channel "${row.channel}"` };
        }

        const recipient = await this.resolveRecipient(row);
        if (!recipient) {
            return {
                result: 'failed',
                error: `No ${row.channel === 'email' ? 'email address' : 'phone number'} available for farmer ${row.farmer_id ?? 'unknown'}`,
            };
        }

        switch (row.channel) {
            case 'sms': {
                const sent = await smsService.sendSMS({
                    to: recipient,
                    message: row.message,
                    farmerId: row.farmer_id ?? undefined,
                });
                return sent
                    ? { result: 'sent' }
                    : { result: 'retry', error: 'SMS provider rejected or failed to send the message' };
            }
            case 'whatsapp': {
                const result = await whatsappService.sendMessage({
                    to: recipient,
                    message: row.message,
                    farmerId: row.farmer_id ?? undefined,
                });
                return result.success
                    ? { result: 'sent' }
                    : { result: 'retry', error: result.error || `WhatsApp delivery failed (${result.status})` };
            }
            case 'email': {
                const sent = await emailService.sendEmail({
                    to: recipient,
                    subject: 'Agricultural Advisory',
                    html: `<p>${escapeHtml(row.message)}</p>`,
                    text: row.message,
                    useQueue: false,
                });
                return sent
                    ? { result: 'sent' }
                    : { result: 'retry', error: 'Email provider failed to send the message' };
            }
            default:
                return { result: 'failed', error: `Unsupported outreach channel "${row.channel}"` };
        }
    }

    private async resolveRecipient(row: OutreachQueueRow): Promise<string | null> {
        // The farmers table has no email column — email recipients must come
        // from the producer-supplied contact captured at enqueue time.
        if (row.channel === 'email') return row.recipient;
        if (row.recipient) return row.recipient;
        if (!row.farmer_id) return null;

        const result = await query<FarmerContactRow>(
            'SELECT phone FROM farmers WHERE id = $1',
            [row.farmer_id]
        );
        return result.rows[0]?.phone ?? null;
    }

    private async markSent(id: string): Promise<void> {
        await query(
            `UPDATE outreach_messages
             SET status = 'sent', sent_at = NOW(), last_error = NULL, updated_at = NOW()
             WHERE id = $1`,
            [id]
        );
    }

    private async markFailure(row: OutreachQueueRow, retryable: boolean, error: string): Promise<void> {
        const willRetry = retryable && row.attempts < MAX_ATTEMPTS;
        await query(
            `UPDATE outreach_messages
             SET status = $2, last_error = $3, updated_at = NOW()
             WHERE id = $1`,
            [row.id, willRetry ? 'queued' : 'failed', error]
        );
        logger.warn(
            `Outreach message ${row.id} ${willRetry ? 'requeued for retry' : 'marked failed'} ` +
            `(attempt ${row.attempts}/${MAX_ATTEMPTS}): ${error}`
        );
    }
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export interface OutreachDeliveryStats {
    totals: {
        total: number;
        sent: number;
        failed: number;
        queued: number;
        processing: number;
        sentRate: number;
    };
    byChannel: Array<{
        channel: string;
        total: number;
        sent: number;
        failed: number;
    }>;
    recentFailures: Array<{
        id: string;
        channel: string;
        recipient: string | null;
        lastError: string | null;
        attempts: number;
        updatedAt: string;
    }>;
}

interface StatusCountRow {
    status: string;
    count: string;
}

interface ChannelStatusRow {
    channel: string;
    status: string;
    count: string;
}

interface FailureRow {
    id: string;
    channel: string;
    recipient: string | null;
    last_error: string | null;
    attempts: number;
    updated_at: Date | string;
}

/**
 * Delivery statistics for the outreach queue. Honest zeros when the queue
 * table does not exist yet (worker has never run) — never a fabricated count.
 */
export async function getOutreachDeliveryStats(): Promise<OutreachDeliveryStats> {
    try {
        const [statusResult, channelResult, failureResult] = await Promise.all([
            query<StatusCountRow>('SELECT status, COUNT(*)::text AS count FROM outreach_messages GROUP BY status'),
            query<ChannelStatusRow>('SELECT channel, status, COUNT(*)::text AS count FROM outreach_messages GROUP BY channel, status'),
            query<FailureRow>(`
                SELECT id, channel, recipient, last_error, attempts, updated_at
                FROM outreach_messages
                WHERE status = 'failed'
                ORDER BY updated_at DESC
                LIMIT 10
            `),
        ]);

        const counts: Record<string, number> = { sent: 0, failed: 0, queued: 0, processing: 0 };
        for (const row of statusResult.rows) {
            if (row.status in counts) counts[row.status] = parseInt(row.count, 10) || 0;
        }
        const total = statusResult.rows.reduce((sum, row) => sum + (parseInt(row.count, 10) || 0), 0);

        return {
            totals: {
                total,
                sent: counts.sent,
                failed: counts.failed,
                queued: counts.queued,
                processing: counts.processing,
                sentRate: total > 0 ? Math.round((counts.sent / total) * 100) : 0,
            },
            byChannel: buildChannelBreakdown(channelResult.rows),
            recentFailures: failureResult.rows.map((row) => ({
                id: row.id,
                channel: row.channel,
                recipient: row.recipient,
                lastError: row.last_error,
                attempts: row.attempts,
                updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
            })),
        };
    } catch (error) {
        logger.warn('Outreach delivery stats unavailable (queue table missing?):', error instanceof Error ? error.message : error);
        return {
            totals: { total: 0, sent: 0, failed: 0, queued: 0, processing: 0, sentRate: 0 },
            byChannel: [],
            recentFailures: [],
        };
    }
}

/**
 * Requeue failed outreach messages for another delivery attempt.
 * Only rows currently in a failed state are requeued (attempt budget reset so
 * the worker picks them up again); returns the number actually requeued.
 */
export async function retryOutreachMessages(ids: string[]): Promise<number> {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    try {
        const result = await query<{ id: string }>(
            `UPDATE outreach_messages
             SET status = 'queued', attempts = 0, last_error = NULL, updated_at = NOW()
             WHERE id = ANY($1) AND status = 'failed'
             RETURNING id`,
            [ids]
        );
        return result.rows.length;
    } catch (error) {
        logger.warn('Failed to requeue outreach messages:', error instanceof Error ? error.message : error);
        return 0;
    }
}

function buildChannelBreakdown(rows: ChannelStatusRow[]): OutreachDeliveryStats['byChannel'] {
    const byChannelMap = new Map<string, { channel: string; total: number; sent: number; failed: number }>();
    for (const row of rows) {
        const entry = byChannelMap.get(row.channel) ?? { channel: row.channel, total: 0, sent: 0, failed: 0 };
        const n = parseInt(row.count, 10) || 0;
        entry.total += n;
        if (row.status === 'sent') entry.sent += n;
        if (row.status === 'failed') entry.failed += n;
        byChannelMap.set(row.channel, entry);
    }
    return Array.from(byChannelMap.values()).sort((a, b) => b.total - a.total);
}

export const outreachWorker = new OutreachWorker();

// Auto-start the outreach worker (after a delay to ensure database is ready)
if (process.env.NODE_ENV !== 'test') {
    setTimeout(() => {
        void outreachWorker.start();
    }, 10000);
}
