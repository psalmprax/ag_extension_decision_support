/**
 * Inbound SMS, WhatsApp and Telegram messages from registered farmers.
 *
 * The message goes into the farmer's thread for their officer. "ASK AI
 * <question>" (or the Ask AI button on Telegram and WhatsApp) has the AI
 * answer on the same channel. Webhooks return at once; the work, which can
 * include an AI answer, runs in the background.
 */
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { onboardingEngine } from '@/services/onboardingEngine';
import {
    farmerThreadFor,
    noticeOnChannel,
    parseAskAiCommand,
    recordChannelMessage,
    type FarmerChannel,
} from '@/services/chat/channelThread';
import { aiAnswersAvailable, answerFarmerInThread, loadThreadForReply, respondIfUrgent } from '@/services/chat/threadAutoReply';
import type { TurnTakingSettings } from '@/services/chat/turnTaking';
import { smsCopy } from '@/services/sms/smsCopy';

/** A new conversation, worth an acknowledgement: SMS costs money, so less often there. */
const ACK_GAP_MS: Record<FarmerChannel, number> = {
    sms: 12 * 60 * 60 * 1000,
    whatsapp: 60 * 60 * 1000,
    telegram: 60 * 60 * 1000,
};

export function acknowledgementText(
    channel: FarmerChannel,
    settings: TurnTakingSettings,
    aiAvailable = true,
    language: string | null = null,
): string {
    // Never promise an AI answer the officer's plan does not include.
    if (!aiAvailable) return smsCopy('ack_no_ai', language);
    if (channel === 'sms') return smsCopy('ack_sms', language);
    return smsCopy('ack_chat', language).replace('{minutes}', String(settings.aiFallbackMinutes));
}

export const ASK_AI_USAGE = smsCopy('ask_ai_usage', 'en');
export const ALREADY_ANSWERED = smsCopy('already_answered', 'en');
export const SMS_LIMIT_REACHED = smsCopy('sms_limit_reached', 'en');
export const AI_NOT_ON_PLAN = smsCopy('ai_not_on_plan', 'en');

/** The farmer's saved language, for fixed notices (the AI answers in the question's language). */
async function farmerLanguage(farmerId: string): Promise<string | null> {
    const { rows } = await query<{ language_preference: string | null }>(
        'SELECT language_preference FROM farmers WHERE id = $1',
        [farmerId],
    );
    return rows[0]?.language_preference ?? null;
}

/** Whether the farmer's previous message (before this one) is older than the channel's gap. */
async function startsNewConversation(conversationId: string, channel: FarmerChannel): Promise<boolean> {
    const { rows } = await query<{ created_at: Date }>(
        `SELECT created_at FROM chat_messages
          WHERE conversation_id = $1 AND role IN ('user', 'farmer')
          ORDER BY created_at DESC OFFSET 1 LIMIT 1`,
        [conversationId],
    );
    const previous = rows[0]?.created_at;
    return !previous || Date.now() - new Date(previous).getTime() > ACK_GAP_MS[channel];
}

async function answerWithAi(conversationId: string, channel: FarmerChannel, language: string | null): Promise<void> {
    const thread = await loadThreadForReply(conversationId);
    if (!thread?.question) {
        await noticeOnChannel(conversationId, channel, smsCopy('ask_ai_usage', language));
        return;
    }
    if (thread.aiAnsweredSinceFarmer) {
        await noticeOnChannel(conversationId, channel, smsCopy('already_answered', language));
        return;
    }
    const outcome = await answerFarmerInThread(thread, 'farmer_request');
    if (outcome === 'sms_limit') await noticeOnChannel(conversationId, channel, smsCopy('sms_limit_reached', language));
    if (outcome === 'not_on_plan') await noticeOnChannel(conversationId, channel, smsCopy('ai_not_on_plan', language));
}

/** Handle one message from a registered farmer (runs in the background). */
export async function handleRegisteredFarmerChannelMessage(params: {
    farmerId: string;
    channel: FarmerChannel;
    text: string;
    language?: string;
    isVoice?: boolean;
}): Promise<void> {
    const { farmerId, channel, text, language, isVoice } = params;
    const question = parseAskAiCommand(text);
    const noticeLanguage = language ?? (await farmerLanguage(farmerId));

    if (question === null) {
        const conversationId = await recordChannelMessage({ farmerId, channel, content: text, language, isVoice });
        await respondIfUrgent(conversationId);
        if (await startsNewConversation(conversationId, channel)) {
            const thread = await loadThreadForReply(conversationId);
            // An urgent message has had its safety reply; no second notice.
            if (thread && !thread.state.answeredSinceFarmer) {
                const aiAvailable = await aiAnswersAvailable(thread);
                await noticeOnChannel(conversationId, channel, acknowledgementText(channel, thread.settings, aiAvailable, noticeLanguage), {
                    askAiButton: aiAvailable,
                });
            }
        }
        return;
    }

    const conversationId = question
        ? await recordChannelMessage({ farmerId, channel, content: question, language, isVoice })
        : await farmerThreadFor(farmerId);
    await answerWithAi(conversationId, channel, noticeLanguage);
}

/** Record that a webhook event was processed; false when it already was (a provider retry). */
export async function claimInboundEvent(channel: FarmerChannel, identifier: string, eventId: string): Promise<boolean> {
    const { rows } = await query<{ event_id: string }>(
        `INSERT INTO messaging_inbound_events (channel, external_identifier, event_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (channel, external_identifier, event_id) DO NOTHING
         RETURNING event_id`,
        [channel, identifier, eventId],
    );
    return rows.length > 0;
}

/**
 * If the sender is a registered farmer, take the message into their thread
 * (in the background) and return true; otherwise return false so the caller
 * runs onboarding as before.
 */
export async function takeRegisteredFarmerMessage(params: {
    channel: FarmerChannel;
    identifier: string;
    text: string;
    language?: string;
    eventId?: string;
    isVoice?: boolean;
}): Promise<boolean> {
    const farmer = await onboardingEngine.findFarmerByIdentifier(params.identifier, params.channel);
    if (!farmer?.id) return false;
    if (params.eventId && !(await claimInboundEvent(params.channel, params.identifier, params.eventId))) {
        return true;
    }
    setImmediate(() => {
        handleRegisteredFarmerChannelMessage({
            farmerId: String(farmer.id),
            channel: params.channel,
            text: params.text,
            language: params.language,
            isVoice: params.isVoice,
        }).catch(error => logger.error(`Could not handle a ${params.channel} message from farmer ${farmer.id}:`, error));
    });
    return true;
}
