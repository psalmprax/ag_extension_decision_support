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
import { answerFarmerInThread, loadThreadForReply, respondIfUrgent } from '@/services/chat/threadAutoReply';
import type { TurnTakingSettings } from '@/services/chat/turnTaking';

/** A new conversation, worth an acknowledgement: SMS costs money, so less often there. */
const ACK_GAP_MS: Record<FarmerChannel, number> = {
    sms: 12 * 60 * 60 * 1000,
    whatsapp: 60 * 60 * 1000,
    telegram: 60 * 60 * 1000,
};

export function acknowledgementText(channel: FarmerChannel, settings: TurnTakingSettings): string {
    if (channel === 'sms') {
        return 'Thanks, your officer will reply. For an AI answer now, send ASK AI and your question.';
    }
    return `Thanks, your officer will reply, usually within ${settings.aiFallbackMinutes} minutes in working hours. ` +
        'For an answer now, tap Ask AI or send ASK AI.';
}

export const ASK_AI_USAGE =
    'Send your question after ASK AI. Example: ASK AI maize leaves turning yellow after rain.';
export const ALREADY_ANSWERED =
    'The AI has already answered your last question. Your officer will follow up.';
export const SMS_LIMIT_REACHED =
    "You have used today's AI answers by SMS. Your officer will reply.";

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

async function answerWithAi(conversationId: string, channel: FarmerChannel): Promise<void> {
    const thread = await loadThreadForReply(conversationId);
    if (!thread?.question) {
        await noticeOnChannel(conversationId, channel, ASK_AI_USAGE);
        return;
    }
    if (thread.aiAnsweredSinceFarmer) {
        await noticeOnChannel(conversationId, channel, ALREADY_ANSWERED);
        return;
    }
    if ((await answerFarmerInThread(thread, 'farmer_request')) === 'sms_limit') {
        await noticeOnChannel(conversationId, channel, SMS_LIMIT_REACHED);
    }
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

    if (question === null) {
        const conversationId = await recordChannelMessage({ farmerId, channel, content: text, language, isVoice });
        await respondIfUrgent(conversationId);
        if (await startsNewConversation(conversationId, channel)) {
            const thread = await loadThreadForReply(conversationId);
            // An urgent message has had its safety reply; no second notice.
            if (thread && !thread.state.answeredSinceFarmer) {
                await noticeOnChannel(conversationId, channel, acknowledgementText(channel, thread.settings), { askAiButton: true });
            }
        }
        return;
    }

    const conversationId = question
        ? await recordChannelMessage({ farmerId, channel, content: question, language, isVoice })
        : await farmerThreadFor(farmerId);
    await answerWithAi(conversationId, channel);
}

/** Record that a webhook event was processed; false when it already was (a provider retry). */
async function claimInboundEvent(channel: FarmerChannel, identifier: string, eventId: string): Promise<boolean> {
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
