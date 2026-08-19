/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import { logger } from '../utils/logger';
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
                {
                    username: this.africaTalkingUsername!,
                    to,
                    message,
                },
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            logger.error('Africa\'s Talking SMS error:', (error as any).response?.data || (error as any).message);
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            logger.error('Twilio SMS error:', (error as any).response?.data || (error as any).message);
            return false;
        }
    }

    // Main send SMS method
    async sendSMS(options: SMSOptions): Promise<boolean> {
        const { to, message } = options;

        // Format phone number (ensure E.164 format)
        const formattedPhone = this.formatPhoneNumber(to);

        let success = false;
        let provider = 'none';

        // Log in development
        if (!this.africaTalkingApiKey && !this.twilioAccountSid) {
            logger.error('SMS provider not configured — cannot send message');
            return false;
        } else if (this.africaTalkingApiKey) {
            provider = 'africa_talking';
            success = await this.sendViaAfricaTalking(formattedPhone, message);
        } else if (this.twilioAccountSid) {
            provider = 'twilio';
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

        for (const recipient of options.recipients) {
            const success = await this.sendSMS({
                to: recipient,
                message: options.message,
            });

            results.push({ to: recipient, success });
            if (success) sent++;
            else failed++;
        }

        return { sent, failed, results };
    }

    // USSD Session Management
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private ussdSessions: Map<string, { phoneNumber: string; step: number; data: any }> = new Map();

    async startUSSDSession(options: USSDOptions): Promise<string> {
        // Initialize session
        this.ussdSessions.set(options.sessionId, {
            phoneNumber: options.phoneNumber,
            step: 0,
            data: {},
        });

        // Return welcome message
        return this.handleUSSDInput(options.sessionId, '');
    }

    async handleUSSDInput(sessionId: string, text: string): Promise<string> {
        const session = this.ussdSessions.get(sessionId);
        if (!session) {
            return 'END Session expired. Please try again.';
        }

        session.step++;

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
                        const summary = await getWeatherSummary();
                        return `CON Current weather:\n${summary}\n1. Back to menu`;
                    }
                    case '2': {
                        const summary = await getMarketSummary();
                        return `CON Current prices:\n${summary}\n1. Back to menu`;
                    }
                    case '3': {
                        // AI Disease Diagnosis
                        return `CON Enter symptoms (comma-separated):\nExample: white spots, leaf yellowing\n*11# for AI analysis`;
                    }
                    case '4': {
                        return `CON Knowledge Base Topics:\n1. Pest Control\n2. Fertilizer Guidelines\n3. Planting Calendar\n4. Irrigation Tips\n5. Back to main menu`;
                    }
                    case '5': {
                        return `CON Please rate our service (1-5):\n1. Excellent 2. Good 3. Average 4. Poor 5. Very Poor\nYour feedback helps us improve`;
                    }
                    case '6':
                        this.ussdSessions.delete(sessionId);
                        return 'END Thank you for using Ag Extension!';
                    default:
                        return 'CON Invalid option. Try again.\n1. Back to menu';
                }
            }

            case 3:
                if (session.data.choice === '3') {
                    // In a "Real-First" architecture, we would call an AI synthesis service here
                    // For USSD simplicity, we provide a structured real-time advice template
                    return `CON Advice for ${text}:\n- Check soil moisture\n- Monitor for pests\n- Follow regional cycle\n1. Back to menu`;
                }
                return 'CON Invalid option. Try again.\n1. Back to menu';

            default:
                if (text === '1') {
                    session.step = 0;
                    return this.handleUSSDInput(sessionId, '');
                }
                this.ussdSessions.delete(sessionId);
                return 'END Session ended.';
        }
    }

    async endUSSDSession(sessionId: string): Promise<void> {
        this.ussdSessions.delete(sessionId);
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

    // Send scheduled SMS (for reminders)
    async scheduleSMS(to: string, message: string, scheduledTime: Date, userId: string): Promise<boolean> {
        try {
            const formattedPhone = this.formatPhoneNumber(to);
            
            logger.info(`Persisting scheduled SMS to ${formattedPhone} for ${scheduledTime.toISOString()}`);

            await query(
                `INSERT INTO scheduled_sms (user_id, phone_number, message, scheduled_at, status)
                 VALUES ($1, $2, $3, $4, $5)`,
                [userId, formattedPhone, message, scheduledTime, 'pending']
            );

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
