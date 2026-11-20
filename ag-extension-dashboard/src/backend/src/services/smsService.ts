import axios from 'axios';
import { logger } from '../utils/logger';

/** Extract a readable message from an unknown thrown value, preferring axios response bodies. */
function axiosErrorMessage(error: unknown): unknown {
    if (axios.isAxiosError(error)) {
        return error.response?.data || error.message;
    }
    return error instanceof Error ? error.message : error;
}
import { query } from './databaseService';
import { toSmsText } from './sms/smsText';

export interface SMSOptions {
    to: string;
    message: string;
    farmerId?: string;
    senderId?: string;
    provider?: string;
}

export interface BulkSMSOptions {
    recipients: string[];
    message: string;
    farmerId?: string;
    senderId?: string;
}

// How long a row may sit in 'sending' before the stale-claim sweep assumes the
// sender crashed and returns it to 'pending' for redelivery. Generous because
// provider calls are wrapped in axios timeouts well below this.
const ScheduledSmsSendingStaleMs = 5 * 60 * 1000;

class SMSService {
    // Africa's Talking configuration
    private africaTalkingApiKey: string | undefined;
    private africaTalkingUsername: string | undefined;

    // Twilio configuration
    private twilioAccountSid: string | undefined;
    private twilioAuthToken: string | undefined;
    private twilioPhoneNumber: string | undefined;

    constructor() {
        this.initializeProviders();
    }

    private initializeProviders() {
        // Africa's Talking
        if (process.env.AFRICASTALKING_API_KEY) {
            this.africaTalkingApiKey = process.env.AFRICASTALKING_API_KEY;
            this.africaTalkingUsername = process.env.AFRICASTALKING_USERNAME || 'sandbox';
            logger.info('SMS service initialized with Africa\'s Talking');
        }

        // Twilio
        if (process.env.TWILIO_ACCOUNT_SID) {
            this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
            this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
            this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
            logger.info('SMS service initialized with Twilio');
        }

        if (!this.africaTalkingApiKey && !this.twilioAccountSid) {
            logger.warn('SMS service not configured - messages will be logged only');
        }
    }

    private async persistSMS(options: SMSOptions, status: string = 'sent'): Promise<void> {
        try {
            const { to, message, farmerId, senderId, provider } = options;
            // A message sent to a number (a campaign, a reply) is still the farmer's: link it
            // by phone so officers and managers see it in that farmer's SMS history.
            await query(
                `INSERT INTO sms_history (sender_id, recipient_phone, farmer_id, message, status, provider)
                 VALUES ($1, $2::text, COALESCE($3::uuid, (
                     SELECT id FROM farmers
                      WHERE regexp_replace(phone, '\\D', '', 'g') = regexp_replace($2::text, '\\D', '', 'g')
                      ORDER BY created_at LIMIT 1
                 )), $4, $5, $6)`,
                [senderId || null, to, farmerId || null, message, status, provider || 'none']
            );
        } catch (error) {
            logger.error('Failed to persist SMS to history:', error);
        }
    }

    // Send SMS via Africa's Talking
    private async sendViaAfricaTalking(to: string, message: string): Promise<boolean> {
        try {
            const response = await axios.post(
                'https://api.africastalking.com/version1/messaging',
                new URLSearchParams({
                    username: this.africaTalkingUsername!,
                    to,
                    message,
                }).toString(),
                {
                    headers: {
                        'ApiKey': this.africaTalkingApiKey!,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            const result = response.data.SMSMessageData.Recipients[0];
            if (result.status === 'Success') {
                logger.info(`SMS sent via Africa's Talking to ${to}`);
                return true;
            }
            logger.error(`SMS failed: ${result.status}`);
            return false;
        } catch (error) {
            logger.error('Africa\'s Talking SMS error:', axiosErrorMessage(error));
            return false;
        }
    }

    // Send SMS via Twilio
    private async sendViaTwilio(to: string, message: string): Promise<boolean> {
        try {
            const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid!}/Messages.json`;
            const auth = Buffer.from(`${this.twilioAccountSid!}:${this.twilioAuthToken!}`).toString('base64');

            const response = await axios.post(
                url,
                new URLSearchParams({
                    To: to,
                    From: this.twilioPhoneNumber!,
                    Body: message,
                }),
                {
                    headers: {
                        'Authorization': `Basic ${auth}`,
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            );

            if (response.data.status !== 'failed') {
                logger.info(`SMS sent via Twilio to ${to}`);
                return true;
            }
            logger.error(`Twilio SMS failed: ${response.data.error_message}`);
            return false;
        } catch (error) {
            logger.error('Twilio SMS error:', axiosErrorMessage(error));
            return false;
        }
    }

    // Main send SMS method
    async sendSMS(options: SMSOptions): Promise<boolean> {
        const { to } = options;
        // GSM-7 only: one emoji or curly quote would make every part of the message
        // UCS-2 (70 characters instead of 160) and multiply its cost.
        const message = toSmsText(options.message);
        options = { ...options, message };

        // Format phone number (ensure E.164 format)
        const formattedPhone = this.formatPhoneNumber(to);
        if (!this.isValidE164(formattedPhone)) {
            logger.warn(`SMS rejected — invalid E.164 after formatting: ${formattedPhone} (input: ${to})`);
            await this.persistSMS({ ...options, to: formattedPhone, provider: 'none' }, 'failed');
            return false;
        }

        let success = false;
        let provider = 'none';

        // Log in development
        if (!this.africaTalkingApiKey && !this.twilioAccountSid) {
            logger.error('SMS provider not configured — cannot send message');
            return false;
        } else if (this.africaTalkingApiKey) {
            provider = 'africa_talking';
            if (!this.checkProviderRateLimit(provider)) {
                logger.warn(`SMS rate-limited (${provider}) — dropping message to ${formattedPhone}`);
                await this.persistSMS({ ...options, to: formattedPhone, provider }, 'failed');
                return false;
            }
            success = await this.sendViaAfricaTalking(formattedPhone, message);
        } else if (this.twilioAccountSid) {
            provider = 'twilio';
            if (!this.checkProviderRateLimit(provider)) {
                logger.warn(`SMS rate-limited (${provider}) — dropping message to ${formattedPhone}`);
                await this.persistSMS({ ...options, to: formattedPhone, provider }, 'failed');
                return false;
            }
            success = await this.sendViaTwilio(formattedPhone, message);
        }

        // Persist to database
        await this.persistSMS({ ...options, to: formattedPhone, provider }, success ? 'sent' : 'failed');

        return success;
    }

    // Send bulk SMS
    async sendBulkSMS(options: BulkSMSOptions): Promise<{
        sent: number;
        failed: number;
        results: Array<{ to: string; success: boolean }>;
    }> {
        const results: Array<{ to: string; success: boolean }> = [];
        let sent = 0;
        let failed = 0;
        const concurrency = Math.min(5, options.recipients.length);
        let idx = 0;

        const worker = async () => {
            while (idx < options.recipients.length) {
                const i = idx++;
                const recipient = options.recipients[i];
                const success = await this.sendSMS({
                    to: recipient,
                    message: options.message,
                    farmerId: options.farmerId,
                    senderId: options.senderId,
                });
                results[i] = { to: recipient, success };
                if (success) sent++;
                else failed++;
            }
        };

        await Promise.all(Array.from({ length: concurrency }, () => worker()));

        return { sent, failed, results };
    }

    // Provider token-bucket (30 req/min per provider, per instance)
    private smsRateBuckets: Map<string, { tokens: number; resetAt: number }> = new Map();
    // Per-instance cap on provider calls; above it messages are dropped (and recorded as
    // failed), so set SMS_PROVIDER_RATE_PER_MINUTE to what the provider account allows.
    private readonly SMS_RATE_MAX = Number(process.env.SMS_PROVIDER_RATE_PER_MINUTE) || 30;
    private readonly SMS_RATE_WINDOW_MS = 60_000;

    private checkProviderRateLimit(provider: string): boolean {
        const now = Date.now();
        let bucket = this.smsRateBuckets.get(provider);
        if (!bucket || now >= bucket.resetAt) {
            bucket = { tokens: this.SMS_RATE_MAX, resetAt: now + this.SMS_RATE_WINDOW_MS };
            this.smsRateBuckets.set(provider, bucket);
        }
        if (bucket.tokens <= 0) return false;
        bucket.tokens--;
        return true;
    }

    private isValidE164(phone: string): boolean {
        return /^\+[1-9]\d{7,14}$/.test(phone);
    }

    // Helper: Format phone number to E.164
    formatPhoneNumber(phone: string): string {
        // Remove any non-digit characters
        const digits = phone.replace(/\D/g, '');

        // If it starts with country code (e.g., 254), keep it
        if (digits.startsWith('254')) {
            return `+${digits}`;
        }

        // If it's 9 or 10 digits, assume Kenya
        if (digits.length === 9) {
            return `+254${digits}`;
        }

        if (digits.length === 10 && digits.startsWith('0')) {
            return `+254${digits.substring(1)}`;
        }

        // Default: just add +
        return `+${digits}`;
    }

    // Send scheduled SMS (for reminders) — row + BullMQ delayed job (DB polling fallback remains)
    async scheduleSMS(to: string, message: string, scheduledTime: Date, userId: string): Promise<boolean> {
        try {
            const formattedPhone = this.formatPhoneNumber(to);
            if (!this.isValidE164(formattedPhone)) {
                logger.warn(`scheduleSMS rejected — invalid E.164: ${formattedPhone}`);
                return false;
            }
            
            logger.info(`Persisting scheduled SMS to ${formattedPhone} for ${scheduledTime.toISOString()}`);

            const { rows } = await query<{ id: string }>(
                `INSERT INTO scheduled_sms (user_id, phone_number, message, scheduled_at, status)
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [userId, formattedPhone, message, scheduledTime, 'pending']
            );
            const scheduledSmsId = rows[0]?.id;
            if (scheduledSmsId) {
                const delayMs = scheduledTime.getTime() - Date.now();
                try {
                    const { addScheduledSmsJob } = await import('../queues/scheduledSmsQueue');
                    await addScheduledSmsJob({
                        scheduledSmsId,
                        to: formattedPhone,
                        message,
                        senderId: userId,
                        farmerId: null,
                        provider: this.africaTalkingApiKey ? 'africa_talking' : this.twilioAccountSid ? 'twilio' : 'none',
                    }, Math.max(0, delayMs));
                } catch (qErr) {
                    logger.warn('BullMQ scheduled SMS enqueue failed, fallback to polling:', qErr);
                }
            }

            return true;
        } catch (error) {
            logger.error('Failed to schedule persistent SMS:', error);
            return false;
        }
    }

    /**
     * Background worker to process due SMS (polling fallback for rows missed
     * by the BullMQ worker).
     *
     * Exactly-once dispatch: each row is CLAIMED first via a conditional
     * UPDATE that flips status 'pending' → 'sending'. The claim is atomic, so
     * concurrent pollers (multiple app instances, or the BullMQ worker racing
     * this poller) can never select the same row. Rows stuck in 'sending'
     * (crash mid-send) are reclaimed after SENDING_STALE_MS.
     */
    async processScheduledSMS(): Promise<number> {
        try {
            const now = new Date();
            const staleSendingCutoff = new Date(now.getTime() - ScheduledSmsSendingStaleMs);

            // Reclaim rows whose sender died mid-dispatch (stuck 'sending').
            // Guard against clock skew / churn: only flip rows last touched
            // before the cutoff.
            try {
                const { rowCount: reclaimed } = await query(
                    `UPDATE scheduled_sms SET status = 'pending', updated_at = NOW()
                     WHERE status = 'sending'
                       AND updated_at <= $1`,
                    [staleSendingCutoff]
                );
                if (reclaimed && reclaimed > 0) {
                    logger.warn(`Scheduled SMS: reclaimed ${reclaimed} stale 'sending' rows for redelivery`);
                }
            } catch (reclaimErr) {
                logger.warn('Scheduled SMS stale-claim sweep failed:', reclaimErr);
            }

            const { rows } = await query<{
                id: string; phone_number: string; message: string; user_id: string;
            }>(
                // Ordering matters: the atomic 'pending' → 'sending' claim below
                // (not this SELECT) is what prevents duplicate dispatch across
                // concurrent workers and app instances.
                `SELECT id, phone_number, message, user_id
                 FROM scheduled_sms
                 WHERE status = 'pending' AND scheduled_at <= $1
                 LIMIT 50`,
                [now]
            );
            if (rows.length === 0) return 0;

            let processedCount = 0;
            for (const sms of rows) {
                // Atomic claim — the concurrent loser's UPDATE affects 0 rows
                // and it skips the row, closing the duplicate-dispatch race.
                const { rowCount } = await query(
                    `UPDATE scheduled_sms SET status = 'sending', updated_at = NOW()
                     WHERE id = $1 AND status = 'pending'`,
                    [sms.id]
                );
                if (!rowCount) continue; // claimed by another worker — skip

                const success = await this.sendSMS({
                    to: sms.phone_number,
                    message: sms.message,
                    senderId: sms.user_id,
                });

                await query(
                    `UPDATE scheduled_sms SET status = $1, updated_at = NOW() WHERE id = $2`,
                    [success ? 'sent' : 'failed', sms.id]
                );

                if (success) processedCount++;
            }

            return processedCount;
        } catch (error) {
            logger.error('Failed to process scheduled SMS batch:', error);
            return 0;
        }
    }
}

export const smsService = new SMSService();
