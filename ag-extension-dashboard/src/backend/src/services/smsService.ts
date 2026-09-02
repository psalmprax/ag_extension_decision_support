/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { WeatherService } from './weatherService';
import { marketPriceService, MarketPrice } from './marketPriceService';

export interface SMSOptions {
    to: string;
    message: string;
    farmerId?: string;
    senderId?: string;
    provider?: string;
}

export interface USSDOptions {
    sessionId: string;
    phoneNumber: string;
    text: string;
}

export interface BulkSMSOptions {
    recipients: string[];
    message: string;
    farmerId?: string;
    senderId?: string;
}

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
            await query(
                `INSERT INTO sms_history (sender_id, recipient_phone, farmer_id, message, status, provider)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
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
        const { to, message } = options;

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

    // USSD Session Management — Redis-backed with Map fallback for multi-instance
    private ussdSessions: Map<string, { phoneNumber: string; step: number; data: Record<string, string>; lastActiveAt: number }> = new Map();
    private static readonly USSD_TTL_MS = 3 * 60 * 1000; // 3 min per Africa's Talking spec
    private static readonly USSD_MAX_SESSIONS = 5000;
    private static readonly USSD_REDIS_PREFIX = 'ussd:session:';
    private static readonly USSD_REDIS_TTL_S = 180;

    // Provider token-bucket (30 req/min per provider, per instance)
    private smsRateBuckets: Map<string, { tokens: number; resetAt: number }> = new Map();
    private readonly SMS_RATE_MAX = 30;
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

    private async ussdRedisGet(sessionId: string): Promise<{ phoneNumber: string; step: number; data: Record<string, string>; lastActiveAt: number } | null> {
        try {
            const { getCache } = await import('./cacheService');
            const c = getCache();
            if (!c) return null;
            const raw = await c.get(SMSService.USSD_REDIS_PREFIX + sessionId);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as { phoneNumber: string; step: number; data: Record<string, string>; lastActiveAt: number };
            // refresh TTL on access
            await c.expire(SMSService.USSD_REDIS_PREFIX + sessionId, SMSService.USSD_REDIS_TTL_S);
            return parsed;
        } catch { return null; }
    }

    private async ussdRedisSet(sessionId: string, data: { phoneNumber: string; step: number; data: Record<string, string>; lastActiveAt: number }): Promise<void> {
        try {
            const { getCache } = await import('./cacheService');
            const c = getCache();
            if (!c) return;
            await c.setEx(SMSService.USSD_REDIS_PREFIX + sessionId, SMSService.USSD_REDIS_TTL_S, JSON.stringify(data));
        } catch { /* redis unavailable — Map fallback covers */ }
    }

    private async ussdRedisDel(sessionId: string): Promise<void> {
        try {
            const { getCache } = await import('./cacheService');
            const c = getCache();
            if (!c) return;
            await c.del(SMSService.USSD_REDIS_PREFIX + sessionId);
        } catch { }
    }

    private async getUssdSession(sessionId: string): Promise<{ phoneNumber: string; step: number; data: Record<string, string>; lastActiveAt: number } | null> {
        const fromRedis = await this.ussdRedisGet(sessionId);
        if (fromRedis) {
            // mirror to Map for fast fallback
            this.ussdSessions.set(sessionId, fromRedis);
            return fromRedis;
        }
        return this.ussdSessions.get(sessionId) ?? null;
    }

    private touchUssdSession(sessionId: string): void {
        const s = this.ussdSessions.get(sessionId);
        if (s) {
            s.lastActiveAt = Date.now();
            void this.ussdRedisSet(sessionId, s);
        }
    }

    private reapExpiredUssdSessions(): void {
        const now = Date.now();
        for (const [k, v] of this.ussdSessions.entries()) {
            if (now - v.lastActiveAt > SMSService.USSD_TTL_MS) {
                this.ussdSessions.delete(k);
                void this.ussdRedisDel(k);
            }
        }
        if (this.ussdSessions.size > SMSService.USSD_MAX_SESSIONS) {
            const sorted = [...this.ussdSessions.entries()].sort((a, b) => a[1].lastActiveAt - b[1].lastActiveAt);
            const toDrop = this.ussdSessions.size - SMSService.USSD_MAX_SESSIONS;
            for (let i = 0; i < toDrop; i++) {
                const key = sorted[i][0];
                this.ussdSessions.delete(key);
                void this.ussdRedisDel(key);
            }
        }
    }

    async startUSSDSession(options: USSDOptions): Promise<string> {
        this.reapExpiredUssdSessions();
        const payload = {
            phoneNumber: options.phoneNumber,
            step: 0,
            data: {} as Record<string, string>,
            lastActiveAt: Date.now(),
        };
        this.ussdSessions.set(options.sessionId, payload);
        await this.ussdRedisSet(options.sessionId, payload);

        // Return welcome message
        return this.handleUSSDInput(options.sessionId, '');
    }

    async handleUSSDInput(sessionId: string, text: string): Promise<string> {
        this.reapExpiredUssdSessions();
        const session = await this.getUssdSession(sessionId);
        if (!session) {
            return 'END Session expired. Please try again.';
        }

        this.touchUssdSession(sessionId);
        session.step++;
        // persist step increment
        void this.ussdRedisSet(sessionId, session);

        // Helper to get dynamic weather
        const getWeatherSummary = async () => {
            try {
                // Default to a central region if unknown
                const weather = await WeatherService.getByLocation('Nairobi');
                return `${weather.condition}, ${weather.temp}°C. Hum: ${weather.humidity}%`;
            } catch {
                return 'Weather service unavailable.';
            }
        };

        // Helper to get dynamic prices
        const getMarketSummary = async () => {
            try {
                const prices: MarketPrice[] = await marketPriceService.getLatestPrices();
                return prices.slice(0, 3)
                    .map((p: MarketPrice) => `${p.crop}: ${p.price}`)
                    .join('\n');
            } catch {
                return 'Market prices unavailable.';
            }
        };

        // Simple USSD menu flow
        switch (session.step) {
            case 1:
                return 'CON Ag Extension Services\n1. Disease Diagnosis (AI)\n2. Weather Forecast\n3. Market Prices\n4. Knowledge Base\n5. SMS Feedback\n6. Exit';

            case 2: {
                const choice = text;
                session.data.choice = choice;

                switch (choice) {
                    case '1': {
                        return `CON AI disease diagnosis is unavailable over USSD. Please contact an extension officer.\n1. Back to menu`;
                    }
                    case '2': {
                        const summary = await getWeatherSummary();
                        return `CON Current weather:\n${summary}\n1. Back to menu`;
                    }
                    case '3': {
                        const summary = await getMarketSummary();
                        return `CON Current prices:\n${summary || 'Market prices unavailable.'}\n1. Back to menu`;
                    }
                    case '4': {
                        return `CON Knowledge Base Topics:\n1. Pest Control\n2. Fertilizer Guidelines\n3. Planting Calendar\n4. Irrigation Tips\n5. Back to main menu`;
                    }
                    case '5': {
                        return `CON Please rate our service (1-5):\n1. Excellent 2. Good 3. Average 4. Poor 5. Very Poor\nYour feedback helps us improve`;
                    }
                    case '6':
                        this.ussdSessions.delete(sessionId);
                        void this.ussdRedisDel(sessionId);
                        return 'END Thank you for using Ag Extension!';
                    default:
                        void this.ussdRedisSet(sessionId, session);
                        return 'CON Invalid option. Try again.\n1. Back to menu';
                }
            }

            case 3:
                if (session.data.choice === '1') {
                    void this.ussdRedisSet(sessionId, session);
                    return 'CON AI disease diagnosis is unavailable over USSD. Please contact an extension officer.\n1. Back to menu';
                }
                void this.ussdRedisSet(sessionId, session);
                return 'CON Invalid option. Try again.\n1. Back to menu';

            default:
                if (text === '1') {
                    session.step = 0;
                    void this.ussdRedisSet(sessionId, session);
                    return this.handleUSSDInput(sessionId, '');
                }
                this.ussdSessions.delete(sessionId);
                void this.ussdRedisDel(sessionId);
                return 'END Session ended.';
        }
    }

    async endUSSDSession(sessionId: string): Promise<void> {
        this.ussdSessions.delete(sessionId);
        await this.ussdRedisDel(sessionId);
    }

    // Helper: Format phone number to E.164
    private formatPhoneNumber(phone: string): string {
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
     * Background worker to process due SMS.
     * This should be called by a cron job or interval.
     */
    async processScheduledSMS(): Promise<number> {
        try {
            const now = new Date();
            // Fetch pending SMS that are due
            const { rows } = await query(
                `SELECT * FROM scheduled_sms WHERE status = 'pending' AND scheduled_at <= $1 LIMIT 50`,
                [now]
            );

            if (rows.length === 0) return 0;

            logger.info(`Processing ${rows.length} due scheduled SMS`);

            let processedCount = 0;
            for (const sms of rows) {
                const success = await this.sendSMS({
                    to: sms.phone_number,
                    message: sms.message,
                    senderId: sms.user_id,
                });

                // Update status
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
