import axios from 'axios';
import { logger } from '../utils/logger';

export interface SMSOptions {
    to: string;
    message: string;
}

export interface USSDOptions {
    sessionId: string;
    phoneNumber: string;
    text: string;
}

export interface BulkSMSOptions {
    recipients: string[];
    message: string;
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
        } catch (error: any) {
            logger.error('Africa\'s Talking SMS error:', error.response?.data || error.message);
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
        } catch (error: any) {
            logger.error('Twilio SMS error:', error.response?.data || error.message);
            return false;
        }
    }

    // Main send SMS method
    async sendSMS(options: SMSOptions): Promise<boolean> {
        const { to, message } = options;

        // Format phone number (ensure E.164 format)
        const formattedPhone = this.formatPhoneNumber(to);

        // Log in development
        if (!this.africaTalkingApiKey && !this.twilioAccountSid) {
            logger.info(`[DEV SMS] To: ${formattedPhone}, Message: ${message}`);
            return true;
        }

        // Try providers in order of preference
        if (this.africaTalkingApiKey) {
            return this.sendViaAfricaTalking(formattedPhone, message);
        }

        if (this.twilioAccountSid) {
            return this.sendViaTwilio(formattedPhone, message);
        }

        return false;
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

        // Simple USSD menu flow
        switch (session.step) {
            case 1:
                return 'CON Welcome to Ag Extension\n1. Check Weather\n2. Market Prices\n3. Crop Advice\n4. Exit';

            case 2: {
                const choice = text;
                session.data.choice = choice;

                switch (choice) {
                    case '1':
                        return 'CON Current weather: Sunny, 28°C\n1. Back to menu';
                    case '2':
                        return 'CON Maize: $280/ton\nBeans: $450/ton\n1. Back to menu';
                    case '3':
                        return 'CON Enter crop name:';
                    case '4':
                        this.ussdSessions.delete(sessionId);
                        return 'END Thank you for using Ag Extension!';
                    default:
                        return 'CON Invalid option. Try again.\n1. Back to menu';
                }
            }

            case 3:
                if (session.data.choice === '3') {
                    return `CON Advice for ${text}:\n- Monitor for pests\n- Water early morning\n1. Back to menu`;
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
    async scheduleSMS(to: string, message: string, scheduledTime: Date): Promise<boolean> {
        // In production, this would be handled by a job queue
        const delay = scheduledTime.getTime() - Date.now();

        if (delay <= 0) {
            return this.sendSMS({ to, message });
        }

        logger.info(`Scheduling SMS to ${to} for ${scheduledTime}`);

        // Simulate scheduling
        setTimeout(() => {
            this.sendSMS({ to, message });
        }, delay);

        return true;
    }
}

export const smsService = new SMSService();
