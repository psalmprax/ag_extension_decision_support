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

/** How an officer asked for a reply to be sent. */
export interface OfficerReplyOptions {
    /** Also send it as a spoken voice message where the channel can carry one (WhatsApp). */
    speak?: boolean;
}

/** An officer's reply goes out on the channel the farmer last wrote from (SMS, WhatsApp, Telegram). */
export function scheduleChannelDelivery(conversationId: string, messageId: string, content: string, options: OfficerReplyOptions = {}): void {
    setImmediate(() => {
        deliverToFarmerChannel(conversationId, messageId, content, { askAiButton: true, speak: options.speak })
            .catch(error => logger.warn('Channel delivery failed:', error));
    });
}

/**
 * What follows every officer reply, however it was written (web chat, SMS command, a
 * partner recording): show it live, send it to the farmer's channel and, in a running
 * pilot, ask the farmer later whether they followed the advice.
 */
export function afterOfficerReply(conversationId: string, created: ChatMessageRow, options: OfficerReplyOptions = {}): void {
    fanoutNewMessage(conversationId, created);
    scheduleChannelDelivery(conversationId, created.id, created.content, options);
    setImmediate(() => {
        queueAdviceFollowUp(conversationId, created.id).catch(error => logger.warn('Could not queue a pilot follow-up:', error));
    });
}

/** Who wrote a message, kept so only they (or an administrator) can edit or withdraw it. */
export function senderMetadata(senderId: string | undefined, extra: Record<string, unknown> = {}): string | null {
    const metadata = senderId ? { senderId, ...extra } : extra;
    return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
}

/**
 * Whether this person wrote the message: by its recorded sender, or (for messages from
 * before senders were recorded) by its side of the thread. An administrator may always.
 */
export function isMessageAuthor(message: ChatMessageRow, user: { userId: string; role: string }): boolean {
  if (user.role === 'admin') return true;
  const senderId = (message.metadata as { senderId?: unknown } | null)?.senderId;
  if (typeof senderId === 'string') return senderId === user.userId;
  return message.role === (user.role === 'farmer' ? 'user' : 'officer');
}

/** Store an officer's reply in a thread, then do what follows every reply. */
export async function postOfficerReply(conversationId: string, content: string, senderId?: string): Promise<ChatMessageRow | null> {
    const { rows } = await query<ChatMessageRow>(
        `INSERT INTO chat_messages (conversation_id, role, content, metadata) VALUES ($1, 'officer', $2, $3) RETURNING *`,
        [conversationId, content, senderMetadata(senderId)],
    );
    await query('UPDATE chat_conversations SET started_at = NOW() WHERE id = $1', [conversationId]);
    const created = rows[0] ?? null;
    if (created) afterOfficerReply(conversationId, created);
    return created;
}
