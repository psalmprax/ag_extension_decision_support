/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { query } from '@/services/databaseService';
import { authorize, AuthRequest } from '@/middleware/authorize';
import { getPrincipalTenantId } from '@/services/dataGovernanceService';
import { logger } from '@/utils/logger';
import { safeError } from '@/utils/safeResponse';
import { telegramService } from '@/services/telegramService';
import { whatsappService } from '@/services/whatsappService';
import { smsService } from '@/services/smsService';
import { onboardingEngine } from '@/services/onboardingEngine';
import { WeatherService } from '@/services/weatherService';
import { marketPriceService } from '@/services/marketPriceService';
import type { TenantChannelConfigRow } from '@/types/rowTypes';

const router = Router();

async function resolveTenantId(req: Request): Promise<string | null> {
    if (!req.user?.userId) return null;
    const requestedTenant = typeof req.query.tenantId === 'string' ? req.query.tenantId : null;
    if (req.user.role === 'admin' && requestedTenant) return requestedTenant;
    return getPrincipalTenantId(req.user.userId);
}

function maskSecret(secret?: string): string {
    if (!secret || secret.length < 6) return '••••••••';
    return `${secret.slice(0, 3)}••••${secret.slice(-3)}`;
}

// -----------------------------------------------------------------------------
// PUBLIC WEBHOOKS (No JWT required - incoming updates from Telegram / Meta)
// -----------------------------------------------------------------------------

router.get('/telegram/webhook', (_req: Request, res: Response) => {
    res.json({ status: 'ok', channel: 'telegram', timestamp: new Date().toISOString() });
});

async function handleTelegramWeather(chatId: string) {
    try {
        const weather = await WeatherService.getByLocation('Kenya');
        const forecastLines = weather.forecast.slice(0, 3).map(f =>
            `  • ${f.date}: ${f.maxTemp}°C / ${f.minTemp}°C — ${f.condition}`
        ).join('\n');
        const temp = weather.temperature ?? weather.temp;
        await telegramService.sendMessage({
            chatId,
            text: `🌤 *Live Weather — East Africa*\n• ${weather.condition}, ${temp}°C\n• Humidity: ${weather.humidity}%\n\n3-Day Forecast:\n${forecastLines}`,
        });
    } catch {
        await telegramService.sendMessage({
            chatId,
            text: `🌤 *Weather Forecast*\nWeather data is temporarily unavailable. Please try again shortly.`,
        });
    }
}

async function handleTelegramPrices(chatId: string) {
    try {
        const prices = await marketPriceService.getLatestPrices();
        const priceLines = prices.map(p => `• ${p.crop}: ${p.price} (${p.trend})`).join('\n');
        await telegramService.sendMessage({
            chatId,
            text: `📈 *Market Bulletin*\n${priceLines || 'No current price data.'}\n\n_Source: baseline estimate_`,
        });
    } catch {
        await telegramService.sendMessage({
            chatId,
            text: `📈 *Market Bulletin*\nMarket price data is temporarily unavailable. Please try again shortly.`,
        });
    }
}

router.post('/telegram/webhook', async (req: Request, res: Response) => {
    try {
        const update = req.body;
        if (!update || !update.message) {
            return res.status(200).json({ ok: true, ignored: true });
        }

        const msg = update.message;
        const chatId = msg.chat?.id;
        const text = msg.text || '';
        const username = msg.from?.username || '';
        const firstName = msg.from?.first_name || '';

        if (!chatId || !text) {
            return res.status(200).json({ ok: true });
        }

        // Persist inbound message
        await telegramService.persistMessage({
            tenantId: null,
            chatId: String(chatId),
            username,
            firstName,
            message: text,
            direction: 'inbound',
            status: 'received',
        });

        // Run through auto-onboarding engine
        const onboardingResult = await onboardingEngine.processIncomingMessage({
            channel: 'telegram',
            identifier: String(chatId),
            message: text,
            senderName: firstName,
        });

        if (onboardingResult.isHandled && onboardingResult.responseMessage) {
            await telegramService.sendMessage({
                chatId,
                text: onboardingResult.responseMessage,
                farmerId: onboardingResult.farmerId,
            });
            return res.status(200).json({ ok: true, handled: 'onboarding' });
        }

        // If registered farmer sends a command/query
        const queryLower = text.toLowerCase().trim();
        if (queryLower.startsWith('/weather') || queryLower.includes('weather') || queryLower.includes('hali ya hewa')) {
            await handleTelegramWeather(String(chatId));
            return res.status(200).json({ ok: true });
        }

        if (queryLower.startsWith('/prices') || queryLower.includes('prices') || queryLower.includes('bei')) {
            await handleTelegramPrices(String(chatId));
            return res.status(200).json({ ok: true });
        }

        // Conversational AI fallback
        await telegramService.sendMessage({
            chatId,
            text: `🌾 *Ag Extension AI Assistant:*\nThank you for reaching out! We received your message: _"${text}"_.\n\nOur extension intelligence system is reviewing your inquiry. Type */weather* for forecasts or */prices* for commodity rates.`,
        });

        return res.status(200).json({ ok: true });
    } catch (error) {
        logger.error('Telegram webhook processing error:', error);
        return res.status(200).json({ ok: false, error: 'Internal processing error' });
    }
});

// -----------------------------------------------------------------------------
// AUTHENTICATED MANAGEMENT ENDPOINTS
// -----------------------------------------------------------------------------

router.use(authorize(['admin', 'regional_manager', 'extension_officer']));

async function buildDefaultChannelConfigs(tenantId: string): Promise<Record<string, any>> {
    const baseUrl = process.env.API_BASE_URL || 'https://api.gpexts.com';
    return {
        sms: {
            channel: 'sms',
            provider: process.env.AFRICASTALKING_API_KEY ? 'africas_talking' : 'twilio',
            isEnabled: Boolean(process.env.AFRICASTALKING_API_KEY || process.env.TWILIO_ACCOUNT_SID),
            autoOnboarding: true,
            config: {
                africasTalkingUsername: process.env.AFRICASTALKING_USERNAME || 'sandbox',
                africasTalkingApiKey: maskSecret(process.env.AFRICASTALKING_API_KEY),
                twilioAccountSid: maskSecret(process.env.TWILIO_ACCOUNT_SID),
                twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
                senderId: 'AG-EXTEND',
            },
            webhookUrl: `${baseUrl}/api/sms/inbound`,
        },
        whatsapp: {
            channel: 'whatsapp',
            provider: 'meta_cloud',
            isEnabled: whatsappService.isConfigured(),
            autoOnboarding: true,
            config: {
                phoneNumber: process.env.TWILIO_WHATSAPP_NUMBER || '+14155238886',
                metaPhoneNumberId: maskSecret(process.env.META_PHONE_NUMBER_ID),
                metaAccessToken: maskSecret(process.env.META_ACCESS_TOKEN),
                webhookVerifyToken: 'ag_extension_verify_2026',
            },
            webhookUrl: `${baseUrl}/api/whatsapp/inbound`,
        },
        telegram: {
            channel: 'telegram',
            provider: 'telegram_bot',
            isEnabled: await telegramService.isConfigured(tenantId),
            autoOnboarding: true,
            config: {
                botToken: maskSecret(process.env.TELEGRAM_BOT_TOKEN),
                botUsername: process.env.TELEGRAM_BOT_USERNAME || 'AgExtensionBot',
            },
            webhookUrl: `${baseUrl}/api/channels/telegram/webhook`,
        },
    };
}

function applyChannelConfigOverrides(
    configsMap: Record<string, any>,
    rows: TenantChannelConfigRow[]
): void {
    for (const row of rows) {
        const target = configsMap[row.channel];
        if (!target) continue;
        target.isEnabled = row.is_enabled;
        target.provider = row.provider;
        target.autoOnboarding = row.auto_onboarding;
        target.welcomeTemplate = row.welcome_template;
        if (row.config && typeof row.config === 'object') {
            target.config = { ...target.config, ...row.config };
        }
    }
}

async function getOnboardingStats(): Promise<Record<string, number>> {
    const countRes = await query<{ channel: string; total: string }>(
        `SELECT channel, COUNT(*)::text as total FROM farmer_onboarding_sessions GROUP BY channel`
    );
    const stats: Record<string, number> = { sms: 0, whatsapp: 0, telegram: 0 };
    for (const r of countRes.rows) {
        stats[r.channel] = parseInt(r.total, 10);
    }
    return stats;
}

/**
 * GET /api/channels/config — Load channel configurations for the tenant
 */
router.get('/config', async (req: Request, res: Response) => {
    try {
        const tenantId = await resolveTenantId(req);
        if (!tenantId) {
            return res.status(403).json({ success: false, error: 'Tenant membership required' });
        }

        const { rows } = await query<TenantChannelConfigRow>(
            `SELECT * FROM tenant_channel_configs WHERE tenant_id = $1`,
            [tenantId]
        );

        const configsMap = await buildDefaultChannelConfigs(tenantId);
        applyChannelConfigOverrides(configsMap, rows);
        const stats = await getOnboardingStats();

        return res.json({
            success: true,
            data: configsMap,
            stats,
        });
    } catch (error) {
        logger.error('Failed to load channel configs:', error);
        return safeError(res, 500, 'Failed to load channel configurations');
    }
});

/**
 * PATCH /api/channels/config — Save/Update channel configuration
 */
router.patch('/config', authorize(['admin', 'regional_manager']), async (req: Request, res: Response) => {
    try {
        const tenantId = await resolveTenantId(req);
        if (!tenantId) {
            return res.status(403).json({ success: false, error: 'Tenant membership required' });
        }

        const { channel, provider, isEnabled, config: inputConfig, autoOnboarding, welcomeTemplate } = req.body;
        if (!channel || !['sms', 'whatsapp', 'telegram'].includes(channel)) {
            return res.status(400).json({ success: false, error: 'Valid channel (sms, whatsapp, telegram) is required' });
        }

        const { rows } = await query<TenantChannelConfigRow>(
            `INSERT INTO tenant_channel_configs (tenant_id, channel, provider, is_enabled, config, auto_onboarding, welcome_template, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (tenant_id, channel) DO UPDATE
             SET provider = EXCLUDED.provider,
                 is_enabled = EXCLUDED.is_enabled,
                 config = EXCLUDED.config,
                 auto_onboarding = EXCLUDED.auto_onboarding,
                 welcome_template = EXCLUDED.welcome_template,
                 updated_at = NOW()
             RETURNING *`,
            [
                tenantId,
                channel,
                provider || 'default',
                Boolean(isEnabled),
                JSON.stringify(inputConfig || {}),
                autoOnboarding !== undefined ? Boolean(autoOnboarding) : true,
                welcomeTemplate || null,
            ]
        );

        logger.info(`Channel ${channel} updated for tenant ${tenantId}`);
        return res.json({ success: true, data: rows[0], message: `${channel.toUpperCase()} configuration saved successfully` });
    } catch (error) {
        logger.error('Failed to update channel config:', error);
        return safeError(res, 500, 'Failed to update channel configuration');
    }
});

/**
 * POST /api/channels/test — Test dispatch / connection on a channel
 */
router.post('/test', async (req: AuthRequest, res: Response) => {
    try {
        const { channel, recipient, message = '🌾 Test message from AgExtension Decision Support' } = req.body;
        const tenantId = await resolveTenantId(req);

        if (channel === 'telegram') {
            const botToken = req.body.botToken;
            if (botToken) {
                const testResult = await telegramService.testBotConnection(botToken);
                return res.json({ success: testResult.success, bot: testResult.bot, error: testResult.error });
            }

            if (!recipient) {
                return res.status(400).json({ success: false, error: 'Telegram Chat ID is required for dispatch test' });
            }

            const sendResult = await telegramService.sendMessage({
                chatId: recipient,
                text: message,
                tenantId: tenantId || undefined,
                senderId: req.user?.userId,
            });
            return res.json(sendResult);
        }

        if (channel === 'sms') {
            if (!recipient) {
                return res.status(400).json({ success: false, error: 'Recipient phone number is required' });
            }
            const sent = await smsService.sendSMS({
                to: recipient,
                message,
                senderId: req.user?.userId,
            });
            return res.json({ success: sent, channel: 'sms', recipient });
        }

        if (channel === 'whatsapp') {
            if (!recipient) {
                return res.status(400).json({ success: false, error: 'Recipient phone number is required' });
            }
            const sent = await whatsappService.sendMessage({
                to: recipient,
                message,
                senderId: req.user?.userId,
            });
            return res.json({ success: sent.success, status: sent.status, channel: 'whatsapp' });
        }

        return res.status(400).json({ success: false, error: 'Unsupported test channel' });
    } catch (error) {
        logger.error('Channel test dispatch failed:', error);
        return safeError(res, 500, 'Channel test dispatch failed');
    }
});

export default router;
