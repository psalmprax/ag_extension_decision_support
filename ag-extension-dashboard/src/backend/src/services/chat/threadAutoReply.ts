/**
 * Answering a farmer in their thread on the AI's turn: when the farmer asks
 * the AI, when their officer has not replied in time, or straight away with
 * fixed safety steps when the message is urgent. The officer is notified
 * whenever the AI answered in their place.
 */
import { query } from '@/services/databaseService';
import { logger } from '@/utils/logger';
import { notificationService } from '@/services/notificationService';
import { generateAdvisoryAnswer, persistTurnMessage } from '@/services/chat/advisoryAnswer';
import { deliverToFarmerChannel, replyChannelFor, smsAiAnswersToday } from '@/services/chat/channelThread';
import {
    autoAnswerFooter,
    isUrgentMessage,
    resolveTurnTakingSettings,
    urgentSafetyText,
    type ThreadTurnState,
    type TurnTakingSettings,
} from '@/services/chat/turnTaking';

/** What answering a thread needs to know. */
export interface ThreadForReply {
    conversationId: string;
    farmerId: string;
    farmerName: string;
    farmerUserId: string | null;
    officerId: string | null;
    settings: TurnTakingSettings;
    /** The farmer's latest message. */
    question: { content: string; language: string | null; at: Date } | null;
    state: ThreadTurnState;
    /** The AI has already answered since the farmer's latest message. */
    aiAnsweredSinceFarmer: boolean;
}

interface ThreadRow {
    id: string;
    farmer_id: string;
    officer_id: string | null;
    farmer_user_id: string | null;
    first_name: string | null;
    last_name: string | null;
    capabilities: unknown;
    question: string | null;
    question_language: string | null;
    question_at: Date | null;
    last_officer_at: Date | null;
    answered_since_farmer: boolean;
    ai_answered_since_farmer: boolean;
}

/** The SELECT shared by the single-thread lookup and the job's candidate scan. */
export const THREAD_FOR_REPLY_SQL = `
    SELECT cv.id, cv.farmer_id, cv.officer_id,
           f.user_id AS farmer_user_id, f.first_name, f.last_name, t.capabilities,
           q.content AS question, q.language AS question_language, q.created_at AS question_at,
           (SELECT MAX(o.created_at) FROM chat_messages o
             WHERE o.conversation_id = cv.id AND o.role = 'officer') AS last_officer_at,
           EXISTS (SELECT 1 FROM chat_messages r
                    WHERE r.conversation_id = cv.id AND r.role IN ('officer', 'assistant')
                      AND r.created_at > q.created_at) AS answered_since_farmer,
           EXISTS (SELECT 1 FROM chat_messages r
                    WHERE r.conversation_id = cv.id AND r.role = 'assistant'
                      AND r.created_at > q.created_at) AS ai_answered_since_farmer
      FROM chat_conversations cv
      JOIN farmers f ON f.id = cv.farmer_id AND COALESCE(f.is_demo, false) = false
      LEFT JOIN tenants t ON t.id = f.tenant_id
      LEFT JOIN LATERAL (
            SELECT m.content, m.language, m.created_at FROM chat_messages m
             WHERE m.conversation_id = cv.id AND m.role IN ('user', 'farmer')
             ORDER BY m.created_at DESC LIMIT 1
      ) q ON true
     WHERE cv.kind = 'farmer_thread'`;

export function toThreadForReply(row: ThreadRow): ThreadForReply {
    const questionAt = row.question_at ? new Date(row.question_at) : null;
    return {
        conversationId: row.id,
        farmerId: row.farmer_id,
        farmerName: [row.first_name, row.last_name].filter(Boolean).join(' ') || 'A farmer',
        farmerUserId: row.farmer_user_id,
        officerId: row.officer_id,
        settings: resolveTurnTakingSettings(row.capabilities),
        question: row.question && questionAt
            ? { content: row.question, language: row.question_language, at: questionAt }
            : null,
        state: {
            lastFarmerMessageAt: questionAt,
            lastOfficerMessageAt: row.last_officer_at ? new Date(row.last_officer_at) : null,
            answeredSinceFarmer: Boolean(row.answered_since_farmer),
        },
        aiAnsweredSinceFarmer: Boolean(row.ai_answered_since_farmer),
    };
}

export async function loadThreadForReply(conversationId: string): Promise<ThreadForReply | null> {
    const { rows } = await query<ThreadRow>(`${THREAD_FOR_REPLY_SQL} AND cv.id = $1 LIMIT 1`, [conversationId]);
    return rows[0] ? toThreadForReply(rows[0]) : null;
}

/** Farmer threads whose latest farmer message (in the last 24 h) nobody has answered yet. */
export async function listThreadsAwaitingReply(limit = 100): Promise<ThreadForReply[]> {
    const { rows } = await query<ThreadRow>(
        `${THREAD_FOR_REPLY_SQL}
           AND q.created_at > NOW() - INTERVAL '24 hours'
           AND NOT EXISTS (SELECT 1 FROM chat_messages r
                            WHERE r.conversation_id = cv.id AND r.role IN ('officer', 'assistant')
                              AND r.created_at > q.created_at)
         ORDER BY q.created_at ASC
         LIMIT $1`,
        [limit],
    );
    return rows.map(toThreadForReply);
}

export type AnswerReason = 'farmer_request' | 'officer_unavailable' | 'outside_hours';

async function notifyOfficer(thread: ThreadForReply, title: string, message: string, type: 'warning' | 'error'): Promise<void> {
    if (!thread.officerId) return;
    try {
        await notificationService.send({
            userId: thread.officerId,
            type,
            title,
            message,
            channel: 'in_app',
            metadata: { conversationId: thread.conversationId, farmerId: thread.farmerId },
        });
    } catch (error) {
        logger.warn(`Could not notify officer about thread ${thread.conversationId}:`, error);
    }
}

/** Fixed safety steps now, and an urgent alert to the officer. */
export async function sendUrgentSafetyReply(thread: ThreadForReply): Promise<void> {
    const language = thread.question?.language ?? null;
    const text = urgentSafetyText(language);
    const stored = await persistTurnMessage(thread.conversationId, 'assistant', text, language ?? undefined);
    await deliverToFarmerChannel(thread.conversationId, stored?.id ?? null, text);
    await notifyOfficer(
        thread,
        `Urgent: ${thread.farmerName} may need emergency help`,
        `Their message: "${(thread.question?.content ?? '').slice(0, 160)}". They were sent first-aid steps and told to get medical help. Please contact them now.`,
        'error',
    );
}

/** What happened when the AI was asked to answer. */
export type AnswerOutcome = 'answered' | 'urgent' | 'sms_limit' | 'no_question';

/**
 * The AI answers the farmer's latest message in their thread, and the answer
 * goes out on the channel the farmer used. Urgent messages get the fixed
 * safety reply instead. By SMS, the organisation's daily limit applies.
 */
export async function answerFarmerInThread(thread: ThreadForReply, reason: AnswerReason): Promise<AnswerOutcome> {
    const question = thread.question;
    if (!question) return 'no_question';
    if (isUrgentMessage(question.content)) {
        await sendUrgentSafetyReply(thread);
        return 'urgent';
    }
    const channel = await replyChannelFor(thread.conversationId);
    if (channel === 'sms' && (await smsAiAnswersToday(thread.farmerId)) >= thread.settings.smsAiDailyLimit) {
        return 'sms_limit';
    }
    const language = question.language ?? undefined;
    const answer = await generateAdvisoryAnswer({
        message: question.content,
        language,
        contextConversationId: thread.conversationId,
        storeIn: thread.conversationId,
        // Reviews are attributed to the officer responsible for the thread.
        requester: { userId: thread.officerId ?? thread.farmerUserId ?? thread.farmerId, role: 'farmer' },
        trustedHistory: true,
        footer: autoAnswerFooter(reason, language, channel),
        brevity: channel === 'sms' ? 'sms' : undefined,
    });
    await deliverToFarmerChannel(thread.conversationId, answer.storedMessageId, answer.text);
    if (reason !== 'farmer_request') {
        await notifyOfficer(
            thread,
            `The AI answered ${thread.farmerName}`,
            `You had not replied within ${thread.settings.aiFallbackMinutes} minutes${reason === 'outside_hours' ? ' (outside working hours)' : ''}, so the AI answered their question. Please review it in Farmer Chat.`,
            'warning',
        );
    }
    return 'answered';
}

/** Right after a farmer writes: an urgent message gets its safety steps at once. */
export async function respondIfUrgent(conversationId: string): Promise<void> {
    const thread = await loadThreadForReply(conversationId);
    if (thread?.question && !thread.state.answeredSinceFarmer && isUrgentMessage(thread.question.content)) {
        await sendUrgentSafetyReply(thread);
    }
}
