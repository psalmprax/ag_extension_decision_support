/**
 * Posting into a farmer thread outside the web chat route: shared by the chat API
 * and by officers replying over SMS.
 */
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { getRealtimeServer } from '@/services/realtimeHub';
import { deliverToFarmerChannel } from '@/services/chat/channelThread';
import { queueAdviceFollowUp } from '@/services/pilots/followups';
import type { ChatMessageRow } from '@/types/rowTypes';
import { mapChatMessageRow } from '@/types/dtos';

/** Push a new message to everyone watching the thread (best effort). */
export function fanoutNewMessage(conversationId: string, message: ChatMessageRow): void {
    try {
        getRealtimeServer()?.to(`conversation:${conversationId}`).emit('new_message', mapChatMessageRow(message));
    } catch (error) {
        logger.debug('Realtime fanout skipped:', error);
    }
}

/** An officer's reply goes out on the channel the farmer last wrote from (SMS, WhatsApp, Telegram). */
export function scheduleChannelDelivery(conversationId: string, messageId: string, content: string): void {
    setImmediate(() => {
        deliverToFarmerChannel(conversationId, messageId, content, { askAiButton: true })
            .catch(error => logger.warn('Channel delivery failed:', error));
    });
}

/** Store an officer's reply in a thread, show it live and send it to the farmer's channel. */
export async function postOfficerReply(conversationId: string, content: string): Promise<ChatMessageRow | null> {
    const { rows } = await query<ChatMessageRow>(
        `INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, 'officer', $2) RETURNING *`,
        [conversationId, content],
    );
    await query('UPDATE chat_conversations SET started_at = NOW() WHERE id = $1', [conversationId]);
    const created = rows[0] ?? null;
    if (created) {
        fanoutNewMessage(conversationId, created);
        scheduleChannelDelivery(conversationId, created.id, created.content);
        // In a running pilot, the farmer is later asked whether they followed this advice.
        setImmediate(() => {
            queueAdviceFollowUp(conversationId, created.id).catch(error => logger.warn('Could not queue a pilot follow-up:', error));
        });
    }
    return created;
}
