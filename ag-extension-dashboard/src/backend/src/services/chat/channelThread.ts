/**
 * SMS, WhatsApp and Telegram in the farmer's thread.
 *
 * A registered farmer's message on any channel lands in their thread, so
 * their officer sees and answers it in Farmer Chat; the officer's reply, and
 * any AI answer, goes back out on the channel the farmer last used. The
 * farmer asks the AI with a button on Telegram and WhatsApp, or by sending
 * "ASK AI <question>" by SMS (any channel accepts the code).
 */
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { sendSmsReply } from '@/services/sms/smsReply';
import { whatsappService } from '@/services/whatsappService';
import { telegramService } from '@/services/telegramService';
import { persistTurnMessage } from '@/services/chat/advisoryAnswer';
import { toPlainText } from '@/services/chat/plainText';
import { synthesizeVoiceReply } from '@/services/chat/voiceReply';
import { storeFarmerMedia, type InboundMedia } from './inboundMedia';

export type FarmerChannel = 'sms' | 'whatsapp' | 'telegram';

/** Telegram inline button; its callback data is handled by the Telegram webhook. */
export const TELEGRAM_ASK_AI_DATA = 'ask_ai';
export const TELEGRAM_ASK_AI_KEYBOARD = {
    inline_keyboard: [[{ text: 'Ask AI', callback_data: TELEGRAM_ASK_AI_DATA }]],
};

/** WhatsApp quick-reply template (a Twilio Content SID mapped in WHATSAPP_TEMPLATE_SIDS). */
export const WHATSAPP_ASK_AI_TEMPLATE = 'ask_ai_prompt';
/** Payload of that template's button, as Twilio posts it back. */
export const WHATSAPP_ASK_AI_PAYLOAD = 'ask_ai';

/**
 * "ASK AI <question>" (also "ASK <question>", "/ask", "ULIZA" in Swahili).
 * Returns the question ('' when only the code was sent), or null for any
 * other message.
 */
export function parseAskAiCommand(text: string): string | null {
    const match = /^(?:\/ask|ask|uliza)(?:\s*ai)?\b\s*[:,.-]?\s*([\s\S]*)$/i.exec(text.trim());
    return match ? match[1].trim() : null;
}

/** The farmer's thread with their assigned officer, created on first contact. */
export async function farmerThreadFor(farmerId: string): Promise<string> {
    const existing = await query<{ id: string }>(
        `SELECT cv.id FROM chat_conversations cv
           JOIN farmers f ON f.id = cv.farmer_id
          WHERE cv.farmer_id = $1 AND cv.kind = 'farmer_thread'
            AND (cv.officer_id = f.assigned_officer_id OR f.assigned_officer_id IS NULL)
          ORDER BY cv.started_at DESC NULLS LAST
          LIMIT 1`,
        [farmerId],
    );
    if (existing.rows[0]) return existing.rows[0].id;
    const created = await query<{ id: string }>(
        `INSERT INTO chat_conversations (farmer_id, officer_id, language, status, kind)
         SELECT f.id, f.assigned_officer_id, COALESCE(f.language_preference, 'en'), 'active', 'farmer_thread'
           FROM farmers f WHERE f.id = $1
         RETURNING id`,
        [farmerId],
    );
    if (!created.rows[0]) throw new Error(`Farmer ${farmerId} not found`);
    return created.rows[0].id;
}

/** Record a registered farmer's channel message in their thread. */
export async function recordChannelMessage(params: {
    farmerId: string;
    channel: FarmerChannel;
    content: string;
    language?: string;
    /** A transcribed voice note: replies are spoken too (WhatsApp). */
    isVoice?: boolean;
    /** Photos, videos or the voice note itself, kept in the thread for the officer. */
    media?: InboundMedia[];
}): Promise<string> {
    const conversationId = await farmerThreadFor(params.farmerId);
    const attachmentIds = await storeFarmerMedia(params.farmerId, params.media ?? []);
    await persistTurnMessage(conversationId, 'user', params.content, params.language, {
        channel: params.channel,
        isVoice: params.isVoice,
        attachmentIds,
    });
    return conversationId;
}

interface ReplyRoute {
    channel: FarmerChannel;
    /** The farmer's latest message was a voice note. */
    isVoice: boolean;
    language: string | null;
}

/** How to reach the farmer: the channel (and voice) of their latest message; null = the app. */
async function replyRouteFor(conversationId: string): Promise<ReplyRoute | null> {
    const { rows } = await query<{ channel: string | null; is_voice: boolean | null; language: string | null }>(
        `SELECT channel, is_voice, language FROM chat_messages
          WHERE conversation_id = $1 AND role IN ('user', 'farmer')
          ORDER BY created_at DESC LIMIT 1`,
        [conversationId],
    );
    const channel = rows[0]?.channel;
    if (channel !== 'sms' && channel !== 'whatsapp' && channel !== 'telegram') return null;
    return { channel, isVoice: Boolean(rows[0]?.is_voice), language: rows[0]?.language ?? null };
}

/** The channel of the farmer's latest message in a thread; null = the app (or no message). */
export async function replyChannelFor(conversationId: string): Promise<FarmerChannel | null> {
    return (await replyRouteFor(conversationId))?.channel ?? null;
}

interface FarmerAddress {
    farmer_id: string;
    phone: string | null;
    notes: string | null;
    tenant_id: string | null;
    language_preference: string | null;
}

async function farmerAddress(conversationId: string): Promise<FarmerAddress | null> {
    const { rows } = await query<FarmerAddress>(
        `SELECT f.id AS farmer_id, f.phone, f.notes, f.tenant_id, f.language_preference
           FROM chat_conversations cv JOIN farmers f ON f.id = cv.farmer_id
          WHERE cv.id = $1 LIMIT 1`,
        [conversationId],
    );
    return rows[0] ?? null;
}

/** Telegram chat id recorded at enrolment (`[tg:<id>]` in the farmer's notes). */
function telegramChatId(notes: string | null): string | null {
    return /tg:(-?\d+)/.exec(notes ?? '')?.[1] ?? null;
}

async function sendOnChannel(
    channel: FarmerChannel,
    address: FarmerAddress,
    text: string,
    options: { askAiButton?: boolean; voice?: { language: string | null } },
): Promise<boolean> {
    if (channel === 'sms') {
        if (!address.phone) return false;
        return sendSmsReply({ to: address.phone, text, language: address.language_preference, farmerId: address.farmer_id });
    }
    if (channel === 'whatsapp') {
        if (!address.phone) return false;
        const message = toPlainText(text);
        const mediaUrl = options.voice ? await synthesizeVoiceReply(message, options.voice.language) : undefined;
        const result = await whatsappService.sendMessage({
            to: address.phone, message, farmerId: address.farmer_id, mediaUrl, isVoiceNote: Boolean(mediaUrl),
        });
        return result.success;
    }
    const chatId = telegramChatId(address.notes);
    if (!chatId) return false;
    const result = await telegramService.sendMessage({
        chatId,
        text: toPlainText(text),
        parseMode: null,
        farmerId: address.farmer_id,
        tenantId: address.tenant_id ?? undefined,
        replyMarkup: options.askAiButton ? TELEGRAM_ASK_AI_KEYBOARD : undefined,
    });
    return result.success;
}

/**
 * Send a reply stored in a farmer thread out on the channel the farmer last
 * wrote from, and mark the stored message with that channel. Returns the
 * channel used, or null when the farmer uses the app (or delivery failed).
 */
export async function deliverToFarmerChannel(
    conversationId: string,
    messageId: string | null,
    text: string,
    options: { askAiButton?: boolean } = {},
): Promise<FarmerChannel | null> {
    try {
        const route = await replyRouteFor(conversationId);
        if (!route) return null;
        const { channel } = route;
        const address = await farmerAddress(conversationId);
        if (!address) return null;
        const voice = route.isVoice ? { language: route.language } : undefined;
        const sent = await sendOnChannel(channel, address, text, { ...options, voice });
        if (!sent) {
            logger.warn(`Could not deliver a reply in thread ${conversationId} by ${channel}`);
            return null;
        }
        if (messageId) await query('UPDATE chat_messages SET channel = $2 WHERE id = $1', [messageId, channel]);
        return channel;
    } catch (error) {
        logger.warn(`Delivering a reply in thread ${conversationId} failed:`, error);
        return null;
    }
}

/** AI answers this farmer has been sent by SMS in the last 24 hours. */
export async function smsAiAnswersToday(farmerId: string): Promise<number> {
    const { rows } = await query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM chat_messages m
           JOIN chat_conversations cv ON cv.id = m.conversation_id
          WHERE cv.farmer_id = $1 AND m.role = 'assistant' AND m.channel = 'sms'
            AND m.created_at > NOW() - INTERVAL '24 hours'`,
        [farmerId],
    );
    return Number(rows[0]?.count ?? 0);
}

/** Send a short notice (not stored in the thread) to the farmer on a channel. */
export async function noticeOnChannel(
    conversationId: string,
    channel: FarmerChannel,
    text: string,
    options: { askAiButton?: boolean } = {},
): Promise<void> {
    const address = await farmerAddress(conversationId);
    if (!address) return;
    try {
        if (channel === 'whatsapp' && options.askAiButton && address.phone) {
            // A tap-to-reply button when the Twilio template is set up; plain text otherwise.
            const button = await whatsappService.sendTemplateMessage({
                to: address.phone, message: text, templateName: WHATSAPP_ASK_AI_TEMPLATE, farmerId: address.farmer_id,
            });
            if (button.success) return;
        }
        await sendOnChannel(channel, address, text, options);
    } catch (error) {
        logger.warn(`Notice to the farmer in thread ${conversationId} failed:`, error);
    }
}
