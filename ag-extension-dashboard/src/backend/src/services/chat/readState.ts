import { query } from '@/services/databaseService';
import { assertConversationAccess, resolveFarmerId, type MessagePrincipal } from '@/services/messageAccessService';

/** Unread messages in the caller's farmer threads: per conversation and in total. */
export interface UnreadSummary {
    total: number;
    conversations: Record<string, number>;
}

/**
 * Which side of a thread the caller reads as. An officer reads the farmer's
 * messages; a farmer reads their officer's and the AI's. Managers and admins
 * look in on threads without being a party to them, so they have no unread.
 */
async function readerSide(principal: MessagePrincipal): Promise<{ column: 'officer_read_at' | 'farmer_read_at'; roles: string[]; participant: string } | null> {
    if (principal.role === 'extension_officer') {
        return { column: 'officer_read_at', roles: ['user'], participant: principal.userId };
    }
    if (principal.role === 'farmer') {
        const farmerId = await resolveFarmerId(principal.userId);
        return farmerId ? { column: 'farmer_read_at', roles: ['officer', 'assistant'], participant: farmerId } : null;
    }
    return null;
}

export async function unreadSummary(principal: MessagePrincipal): Promise<UnreadSummary> {
    const side = await readerSide(principal);
    if (!side) return { total: 0, conversations: {} };
    const party = side.column === 'officer_read_at' ? 'cv.officer_id' : 'cv.farmer_id';
    const { rows } = await query<{ id: string; unread: string }>(
        `SELECT cv.id, COUNT(m.id)::text AS unread
           FROM chat_conversations cv
           JOIN chat_messages m ON m.conversation_id = cv.id
          WHERE cv.kind = 'farmer_thread'
            AND ${party} = $1
            AND m.role = ANY($2::text[])
            AND m.created_at > COALESCE(cv.${side.column}, 'epoch'::timestamp)
          GROUP BY cv.id`,
        [side.participant, side.roles]
    );
    const conversations: Record<string, number> = {};
    let total = 0;
    for (const row of rows) {
        const count = Number(row.unread) || 0;
        conversations[row.id] = count;
        total += count;
    }
    return { total, conversations };
}

/** Marks a thread read up to now for the caller's side (no-op for managers and admins). */
export async function markThreadRead(principal: MessagePrincipal, conversationId: string): Promise<void> {
    await assertConversationAccess(principal, conversationId);
    const side = await readerSide(principal);
    if (!side) return;
    const party = side.column === 'officer_read_at' ? 'officer_id' : 'farmer_id';
    await query(
        `UPDATE chat_conversations SET ${side.column} = NOW() WHERE id = $1 AND ${party} = $2`,
        [conversationId, side.participant]
    );
}
