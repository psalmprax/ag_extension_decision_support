/**
 * A conversation is either a farmer's thread (the farmer, their officer and,
 * when allowed, the AI) or an officer's private AI chat. Farmers never see
 * private AI chats, even ones about them, and officer messages in a farmer
 * thread never trigger an automatic AI reply.
 */
export const CONVERSATION_KINDS = ['farmer_thread', 'officer_ai'] as const;
export type ConversationKind = (typeof CONVERSATION_KINDS)[number];

export const DEFAULT_CONVERSATION_KIND: ConversationKind = 'farmer_thread';

/** The kind named in a request, or null when absent or unknown. */
export function parseConversationKind(value: unknown): ConversationKind | null {
    return typeof value === 'string' && (CONVERSATION_KINDS as readonly string[]).includes(value)
        ? (value as ConversationKind)
        : null;
}

/** Roles under which a farmer's own messages are stored. */
export const FARMER_MESSAGE_ROLES = ['user', 'farmer'] as const;
