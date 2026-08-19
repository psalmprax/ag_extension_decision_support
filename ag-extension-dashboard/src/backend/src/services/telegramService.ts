/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import { logger } from '../utils/logger';
import { query } from './databaseService';
import type { TelegramMessageRow, TenantChannelConfigRow } from '../types/rowTypes';

interface TelegramSendOptions {
    chatId: string | number;
    text: string;
    parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML';
    farmerId?: string;
    senderId?: string;
    tenantId?: string;
    replyMarkup?: Record<string, unknown>;
}

interface TelegramBotInfo {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
    can_join_groups?: boolean;
    can_read_all_group_messages?: boolean;
    supports_inline_queries?: boolean;
}

interface TelegramDeliveryResult {
    success: boolean;
    messageId?: number;
    error?: string;
}

class TelegramService {
    private defaultBotToken: string | undefined;

    constructor() {
        this.initialize();
    }

    private initialize() {
        if (process.env.TELEGRAM_BOT_TOKEN) {
            this.defaultBotToken = process.env.TELEGRAM_BOT_TOKEN;
            logger.info('Telegram service initialized with environment BOT_TOKEN');
        } else {
            logger.info('Telegram service initialized (tenant database configs enabled)');
        }
    }

    /**
     * Resolve the active Telegram bot token for a tenant
     */
    async getBotTokenForTenant(tenantId?: string): Promise<string | null> {
        if (tenantId) {
            try {
                const { rows } = await query<TenantChannelConfigRow>(
                    `SELECT config, is_enabled FROM tenant_channel_configs WHERE tenant_id = $1 AND channel = 'telegram'`,
                    [tenantId]
                );
                if (rows[0]?.is_enabled && rows[0].config && typeof rows[0].config.botToken === 'string') {
                    return rows[0].config.botToken;
                }
            } catch (err) {
                logger.warn('Failed to query tenant Telegram config:', err);
            }
        }
        return this.defaultBotToken || null;
    }

    /**
     * Check whether Telegram is configured (either globally or for a specific tenant)
     */
    async isConfigured(tenantId?: string): Promise<boolean> {
        const token = await this.getBotTokenForTenant(tenantId);
        return Boolean(token && token.length > 10);
    }

    /**
     * Test a bot token against Telegram's getMe API
     */
    async testBotConnection(botToken: string): Promise<{ success: boolean; bot?: TelegramBotInfo; error?: string }> {
        try {
            const url = `https://api.telegram.org/bot${botToken}/getMe`;
            const response = await axios.get(url, { timeout: 10000 });
            if (response.data?.ok && response.data?.result) {
                return { success: true, bot: response.data.result as TelegramBotInfo };
            }
            return { success: false, error: response.data?.description || 'Invalid response from Telegram' };
        } catch (error: any) {
            const errDetail = error.response?.data?.description || error.message || 'Connection failed';
            logger.warn('Telegram bot test failed:', errDetail);
            return { success: false, error: errDetail };
        }
    }

    /**
     * Register a webhook with Telegram
     */
    async setWebhook(botToken: string, webhookUrl: string, secretToken?: string): Promise<{ success: boolean; error?: string }> {
        try {
            const url = `https://api.telegram.org/bot${botToken}/setWebhook`;
            const payload: Record<string, string> = { url: webhookUrl };
            if (secretToken) payload.secret_token = secretToken;

            const response = await axios.post(url, payload, { timeout: 10000 });
            if (response.data?.ok) {
                logger.info(`Telegram webhook registered to ${webhookUrl}`);
                return { success: true };
            }
            return { success: false, error: response.data?.description || 'Failed to set webhook' };
        } catch (error: any) {
            const errDetail = error.response?.data?.description || error.message || 'Webhook registration failed';
            logger.error('Failed to set Telegram webhook:', errDetail);
            return { success: false, error: errDetail };
        }
    }

    /**
     * Send a message to a Telegram chat
     */
    async sendMessage(options: TelegramSendOptions): Promise<TelegramDeliveryResult> {
        const { chatId, text, parseMode = 'Markdown', farmerId, senderId, tenantId, replyMarkup } = options;
        const botToken = await this.getBotTokenForTenant(tenantId);

        if (!botToken) {
            logger.warn('Telegram send attempted but bot token is not configured');
            await this.persistMessage({
                tenantId: tenantId || null,
                chatId: String(chatId),
                message: text,
                direction: 'outbound',
                status: 'not_configured',
                farmerId: farmerId || null,
                senderId: senderId || null,
            });
            return { success: false, error: 'Telegram bot is not configured' };
        }

        try {
            const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
            const payload: Record<string, unknown> = {
                chat_id: chatId,
                text,
                parse_mode: parseMode,
            };
            if (replyMarkup) {
                payload.reply_markup = replyMarkup;
            }

            const response = await axios.post(url, payload, { timeout: 15000 });
            if (response.data?.ok) {
                const messageId = response.data.result?.message_id;
                await this.persistMessage({
                    tenantId: tenantId || null,
                    chatId: String(chatId),
                    message: text,
                    direction: 'outbound',
                    status: 'sent',
                    farmerId: farmerId || null,
                    senderId: senderId || null,
                });
                return { success: true, messageId };
            }

            const errorDesc = response.data?.description || 'Unknown Telegram error';
            await this.persistMessage({
                tenantId: tenantId || null,
                chatId: String(chatId),
                message: text,
                direction: 'outbound',
                status: 'failed',
                farmerId: farmerId || null,
                senderId: senderId || null,
            });
            return { success: false, error: errorDesc };
        } catch (error: any) {
            const errorDesc = error.response?.data?.description || error.message || 'Failed to dispatch Telegram message';
            logger.error('Telegram dispatch error:', errorDesc);
            await this.persistMessage({
                tenantId: tenantId || null,
                chatId: String(chatId),
                message: text,
                direction: 'outbound',
                status: 'failed',
                farmerId: farmerId || null,
                senderId: senderId || null,
            });
            return { success: false, error: errorDesc };
        }
    }

    /**
     * Persist Telegram message row
     */
    async persistMessage(params: {
        tenantId: string | null;
        chatId: string;
        username?: string | null;
        firstName?: string | null;
        message: string;
        direction: 'inbound' | 'outbound';
        status: string;
        farmerId?: string | null;
        senderId?: string | null;
    }): Promise<TelegramMessageRow | null> {
        try {
            const { rows } = await query<TelegramMessageRow>(
                `INSERT INTO telegram_messages (tenant_id, chat_id, username, first_name, message, direction, status, farmer_id, sender_id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 RETURNING *`,
                [
                    params.tenantId,
                    params.chatId,
                    params.username || null,
                    params.firstName || null,
                    params.message,
                    params.direction,
                    params.status,
                    params.farmerId || null,
                    params.senderId || null,
                ]
            );
            return rows[0] || null;
        } catch (error) {
            logger.error('Failed to persist telegram message:', error);
            return null;
        }
    }
}

export const telegramService = new TelegramService();
