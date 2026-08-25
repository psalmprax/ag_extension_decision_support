/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import { logger } from '../utils/logger';
import { query } from './databaseService';

export interface WhatsAppOptions {
    to?: string;
    message: string;
    farmerId?: string;
    senderId?: string;
    templateName?: string;
    templateParams?: string[];
}

export type WhatsAppDeliveryStatus = 'not_configured' | 'queued' | 'sent' | 'logged' | 'failed';

export interface WhatsAppDeliveryResult {
    success: boolean;
    status: WhatsAppDeliveryStatus;
    provider: 'twilio' | 'none';
    error?: string;
}

export interface WhatsAppTemplate {
    name: string;
    language: string;
    components: Array<{
        type: 'body' | 'header' | 'footer' | 'button';
        parameters: Array<{
            type: 'text' | 'image' | 'document';
            text?: string;
            image?: { link: string };
            document?: { link: string; filename: string };
        }>;
    }>;
}

class WhatsAppService {
    private twilioWhatsAppNumber: string | undefined;
    private twilioAccountSid: string | undefined;
    private twilioAuthToken: string | undefined;

    constructor() {
        this.initializeProviders();
    }

    private initializeProviders() {
        // Twilio WhatsApp is configured via Twilio Account
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_WHATSAPP_NUMBER) {
            this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
            this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
            this.twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER;
            logger.info('WhatsApp service initialized with Twilio');
        } else {
            logger.warn('WhatsApp service not configured - outbound delivery is unavailable');
        }
    }

    /**
     * Format a phone number for WhatsApp (remove + prefix for WhatsApp IDs)
     */
    private formatWhatsAppId(phone: string): string {
        const digits = phone.replace(/\+/g, '').replace(/\D/g, '');
        return digits;
    }

    private async dispatchTwilioWhatsApp(options: WhatsAppOptions & { to: string }): Promise<WhatsAppDeliveryResult> {
        const toWhatsApp = `whatsapp:+${this.formatWhatsAppId(options.to)}`;
        const fromWhatsApp = `whatsapp:${this.twilioWhatsAppNumber}`;

        const url = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`;
        const auth = Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString('base64');

        const params: Record<string, string> = {
            To: toWhatsApp,
            From: fromWhatsApp,
            Body: options.message,
        };

        if (options.templateName) {
            params.ProvideFeedback = 'true';
        }

        try {
            const response = await axios.post(url, new URLSearchParams(params), {
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });

            const success = response.data.status !== 'failed';
            await this.persistMessage(options, success ? 'sent' : 'failed');

            if (success) {
                logger.info(`WhatsApp message sent to ${options.to}`);
            } else {
                logger.error(`WhatsApp message failed: ${response.data.error_message}`);
            }

            return {
                success,
                status: success ? 'sent' : 'failed',
                provider: 'twilio',
                ...(success ? {} : { error: response.data.error_message || 'WhatsApp provider rejected the message' }),
            };
        } catch (error: any) {
            logger.error('WhatsApp send error:', error.response?.data || error.message);
            await this.persistMessage(options, 'failed');
            return {
                success: false,
                status: 'failed',
                provider: 'twilio',
                error: error instanceof Error ? error.message : 'WhatsApp provider request failed',
            };
        }
    }

    /**
     * Send a WhatsApp message via Twilio
     */
    async sendMessage(options: WhatsAppOptions): Promise<WhatsAppDeliveryResult> {
        if (!options.to) {
            logger.warn('WhatsApp sendMessage called without a recipient');
            return { success: false, status: 'failed', provider: 'none', error: 'Recipient is required' };
        }

        if (!this.twilioAccountSid || !this.twilioWhatsAppNumber || !this.twilioAuthToken) {
            const status = process.env.WHATSAPP_LOG_ONLY === 'true' && process.env.NODE_ENV !== 'production'
                ? 'logged'
                : 'not_configured';
            await this.persistMessage(options, status);
            logger.warn(`WhatsApp delivery unavailable for ${options.to}: ${status}`);
            return {
                success: false,
                status,
                provider: 'none',
                error: 'WhatsApp provider is not configured',
            };
        }

        return this.dispatchTwilioWhatsApp(options as WhatsAppOptions & { to: string });
    }

    /**
     * Send a templated WhatsApp message (for notifications, alerts, etc.)
     */
    async sendTemplateMessage(options: WhatsAppOptions & { templateName: string }): Promise<WhatsAppDeliveryResult> {
        // Templates are sent as regular messages with structured content
        // Twilio WhatsApp supports templates via the Content API
        return this.sendMessage(options);
    }

    /**
     * Send bulk WhatsApp messages
     */
    async sendBulkMessages(options: WhatsAppOptions & { recipients: string[] }): Promise<{
        sent: number;
        failed: number;
        results: Array<{ to: string; success: boolean; status: WhatsAppDeliveryStatus }>;
    }> {
        const results: Array<{ to: string; success: boolean; status: WhatsAppDeliveryStatus }> = [];
        let sent = 0;
        let failed = 0;

        for (const recipient of options.recipients) {
            const result = await this.sendMessage({
                ...options,
                to: recipient,
            });
            results.push({ to: recipient, success: result.success, status: result.status });
            if (result.success) sent++;
            else failed++;
        }

        return { sent, failed, results };
    }

    /**
     * Send an agricultural alert via WhatsApp
     */
    async sendAlert(
        to: string,
        alertTitle: string,
        alertDescription: string,
        severity: 'low' | 'medium' | 'high' | 'critical',
        farmerId?: string
    ): Promise<WhatsAppDeliveryResult> {
        const severityEmoji = {
            low: 'ℹ️',
            medium: '⚠️',
            high: '🔴',
            critical: '🚨',
        };

        const message = [
            `${severityEmoji[severity]} *Agricultural Alert: ${alertTitle}*`,
            '',
            alertDescription,
            '',
            '_Sent via AG-Extension Decision Support System_',
        ].join('\n');

        return this.sendMessage({ to, message, farmerId });
    }

    /**
     * Send a weather update via WhatsApp
     */
    async sendWeatherUpdate(
        to: string,
        location: string,
        temperature: number,
        condition: string,
        humidity: number,
        farmerId?: string
    ): Promise<WhatsAppDeliveryResult> {
        const message = [
            `🌤 *Weather Update for ${location}*`,
            '',
            `Temperature: ${temperature}°C`,
            `Condition: ${condition}`,
            `Humidity: ${humidity}%`,
            '',
            '_Sent via AG-Extension Decision Support System_',
        ].join('\n');

        return this.sendMessage({ to, message, farmerId });
    }

    /**
     * Send a market price update via WhatsApp
     */
    async sendMarketPriceUpdate(
        to: string,
        prices: Array<{ crop: string; price: string; trend: string }>,
        farmerId?: string
    ): Promise<WhatsAppDeliveryResult> {
        const priceLines = prices.map(p => `• ${p.crop}: ${p.price} (${p.trend})`).join('\n');
        const message = [
            `📊 *Market Price Update*`,
            '',
            priceLines,
            '',
            '_Sent via AG-Extension Decision Support System_',
        ].join('\n');

        return this.sendMessage({ to, message, farmerId });
    }

    /**
     * Persist WhatsApp message to history
     */
    private async persistMessage(options: WhatsAppOptions, status: string): Promise<void> {
        try {
            await query(
                `INSERT INTO sms_history (sender_id, recipient_phone, farmer_id, message, status, provider)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    options.senderId || null,
                    options.to || 'unknown',
                    options.farmerId || null,
                    `[WhatsApp] ${options.message}`,
                    status,
                    'whatsapp',
                ]
            );
        } catch (error: any) {
            logger.error('Failed to persist WhatsApp message:', error);
        }
    }

    /**
     * Check if WhatsApp service is configured
     */
    isConfigured(): boolean {
        return !!(this.twilioAccountSid && this.twilioWhatsAppNumber && this.twilioAuthToken);
    }
}

export const whatsappService = new WhatsAppService();
