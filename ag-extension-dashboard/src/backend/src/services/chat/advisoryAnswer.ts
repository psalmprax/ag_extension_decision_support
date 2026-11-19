/**
 * The AI advisory answer pipeline: thread history and the farmer's location
 * as context, retrieved evidence, the model with advisory tools, the
 * agronomic safety guard and citation checks, then storing the answer in the
 * thread and queueing unsourced or flagged advice for agronomic review.
 *
 * Used by POST /chatbot/completions and by the turn-taking job that answers a
 * farmer when their officer has not replied in time.
 */
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { query } from '@/services/databaseService';
import type { ChatMessageRow } from '@/types/rowTypes';
import { mapChatMessageRow } from '@/types/dtos';
import { logger } from '@/utils/logger';
import { retrieveAdvisoryEvidence } from '@/services/knowledge/advisoryRetrieval';
import { buildAdvisoryDirective, resolveAdvisoryCountry, validateAdvisoryCitations } from '@/services/knowledge/advisoryPolicy';
import { enqueueAdvisoryReview, reviewTriggerFor, type ReviewTrigger } from '@/services/knowledge/reviewQueue';
import { answerSourceMetadata } from '@/services/chat/answerSources';
import { resolveUserContext } from '@/services/knowledge/userContext';
import { callAdvisoryTool, getAdvisoryTools } from '@/services/knowledge/advisoryTools';
import { AdvisoryTimeoutError, withAdvisoryTimeout } from '@/services/knowledge/advisoryRuntime';
import { agronomicSafetyGuard } from '@/services/security/agronomicSafetyGuard';
import { getRealtimeServer } from '@/services/realtimeHub';

/**
 * Load the last turns of a conversation as a context block (empty when
 * none/unavailable). The conversation must belong to the caller: farmers match
 * via their farmer record id or user id, officers via officer_id — the same
 * scoping the /conversations endpoints enforce. Without this check any
 * authenticated user could pass a foreign conversation_id and have another
 * user's messages injected into their prompt context (IDOR).
 */
export async function loadHistoryBlock(conversationId: string | undefined, userId: string, role: string): Promise<string> {
  if (!conversationId) return '';
  try {
    const ownerClause = role === 'admin' || role === 'regional_manager'
      ? ''
      : ' AND (cv.farmer_id = $2 OR cv.officer_id = $2)';
    const params: unknown[] = [conversationId];
    if (ownerClause) {
      const { rows: farmerRows } = await query<{ id: string }>(
        `SELECT id FROM farmers WHERE user_id = $1 OR id = $1 LIMIT 1`,
        [userId]
      );
      params.push(farmerRows[0]?.id || userId);
    }
    const { rows } = await query<ChatMessageRow>(
      `SELECT m.role, m.content FROM chat_messages m
        JOIN chat_conversations cv ON cv.id = m.conversation_id
        WHERE m.conversation_id = $1${ownerClause}
        ORDER BY m.created_at DESC LIMIT 10`,
      params
    );
    if (rows.length === 0) return '';
    const history = rows.reverse().map(m => `${m.role}: ${String(m.content).slice(0, 300)}`).join('\n');
    return history ? `\n\nRECENT CONVERSATION:\n${history}` : '';
  } catch (err) {
    logger.warn('Failed to load chat history for completions:', err);
    return '';
  }
}


interface ChatToolDefinition {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

const buildToolDefinitions = (): ChatToolDefinition[] =>
  getAdvisoryTools().map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));

const MAX_TOOL_ROUNDS = 3;
const ADVISORY_INFERENCE_TIMEOUT_MS = 60_000;
const ADVISORY_TURN_TIMEOUT_MS = 180_000;

const getRemainingTimeout = (deadline: number, stage: string, maximumMs?: number): number => {
  const remainingMs = deadline - Date.now();
  if (remainingMs <= 0) throw new AdvisoryTimeoutError(stage);
  return maximumMs === undefined ? remainingMs : Math.min(maximumMs, remainingMs);
};

type ToolCall = { id?: string; function: { name: string; arguments: unknown } };

function fanoutMessage(conversationId: string, message: ChatMessageRow): void {
  try {
    getRealtimeServer()?.to(`conversation:${conversationId}`).emit('new_message', mapChatMessageRow(message));
  } catch {
    // Realtime delivery is best-effort; the persisted message remains authoritative.
  }
}

/** Store a message in a thread and push it live; `channel` marks an SMS/WhatsApp/Telegram message. */
export async function persistTurnMessage(
  conversationId: string | undefined,
  role: string,
  content: string,
  language?: string,
  extra: { channel?: 'sms' | 'whatsapp' | 'telegram'; isVoice?: boolean; metadata?: object } = {},
): Promise<ChatMessageRow | null> {
  if (!conversationId) return null;
  const { rows } = await query<ChatMessageRow>(
    `INSERT INTO chat_messages (conversation_id, role, content, language, channel, is_voice, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [conversationId, role, content, language ?? null, extra.channel ?? null, extra.isVoice ?? false,
     extra.metadata ? JSON.stringify(extra.metadata) : null]
  );
  if (rows[0]) fanoutMessage(conversationId, rows[0]);
  return rows[0] ?? null;
}

const executeToolCalls = async (toolCalls: ToolCall[], deadline: number): Promise<Array<{ call: ToolCall; output: string }>> => {
  const results: Array<{ call: ToolCall; output: string }> = [];
  for (const toolCall of toolCalls) {
    try {
      const toolResult = await withAdvisoryTimeout(
        () => callAdvisoryTool(toolCall.function.name, toolCall.function.arguments),
        getRemainingTimeout(deadline, 'Chat tool execution'),
        'Chat tool execution'
      );
      const text = toolResult.content.map(c => c.text).join('\n') || 'No output';
      results.push({ call: toolCall, output: toolResult.isError ? `ERROR: ${text}` : text });
    } catch (toolErr) {
      if (toolErr instanceof AdvisoryTimeoutError && Date.now() >= deadline) throw toolErr;
      logger.error(`Tool ${toolCall.function.name} execution failed:`, toolErr);
      results.push({ call: toolCall, output: 'ERROR: Evidence tool unavailable. Do not infer missing results.' });
    }
  }
  return results;
};

function formatToolCall(tc: ToolCall, fallbackId: string) {
  return {
    id: tc.id || fallbackId,
    type: 'function',
    function: {
      name: tc.function.name,
      arguments: typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments ?? {}),
    },
  };
}

/**
 * Agentic turn: the model may request tools; results are fed back as proper
 * `tool` role messages (OpenAI-compatible) for up to MAX_TOOL_ROUNDS before a
 * final answer is required. Providers that ignore `tools` simply return text on
 * the first pass, so this degrades gracefully.
 */
const runAssistantTurn = async (systemPrompt: string, message: string, tools: ChatToolDefinition[]): Promise<{ text: string; usedToolNames: string[] }> => {
  const messages: Array<Record<string, unknown>> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ];
  const usedToolNames: string[] = [];
  let assistantText = '';
  const deadline = Date.now() + ADVISORY_TURN_TIMEOUT_MS;

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const allowTools = tools.length > 0 && round < MAX_TOOL_ROUNDS;
    const response = await withAdvisoryTimeout(() => AIRouter.routeRequest('generate', {
      prompt: messages,
      options: {
        tools: allowTools ? tools : undefined,
        temperature: 0.2,
        preferredProvider: 'aihubmix',
      },
    }), getRemainingTimeout(deadline, 'Chat inference', ADVISORY_INFERENCE_TIMEOUT_MS), 'Chat inference');

    assistantText = (response?.text ?? '').toString().trim();
    const toolCalls = (response?.toolCalls ?? []) as ToolCall[];
    if (toolCalls.length === 0 || !allowTools) break;

    // Echo the assistant's tool request, then one tool message per call.
    messages.push({
      role: 'assistant',
      content: assistantText || null,
      tool_calls: toolCalls.map((tc, i) => formatToolCall(tc, `call_${round}_${i}`)),
    });
    if (toolCalls.length > 4) throw new Error('Provider exceeded the advisory tool-call limit');
    const results = await executeToolCalls(toolCalls, deadline);
    results.forEach((r, i) => {
      usedToolNames.push(r.call.function.name);
      messages.push({
        role: 'tool',
        tool_call_id: r.call.id || `call_${round}_${i}`,
        name: r.call.function.name,
        content: r.output.slice(0, 8000),
      });
    });
  }

  if (!assistantText) {
    throw new Error('Advisory provider returned no answer');
  }
  return {
    text: assistantText,
    usedToolNames: [...new Set(usedToolNames)],
  };
};


async function loadAdvisoryContext(userId: string, message: string, conversationId?: string, countryHint?: string, language?: string) {
  const profile = await resolveUserContext(userId, message);
  let farmerCrops: string[] | undefined = profile.crop ? [profile.crop] : undefined;
  if (conversationId) {
    const { rows } = await query<{ country: string | null; region: string | null; crops: string[] | null }>(
      `SELECT f.country, f.region, f.crops FROM chat_conversations cv
       JOIN farmers f ON f.id = cv.farmer_id WHERE cv.id = $1 LIMIT 1`,
      [conversationId]
    );
    if (rows[0]) {
      profile.country = rows[0].country ?? undefined;
      profile.region = rows[0].region ?? undefined;
      if (rows[0].crops?.length) farmerCrops = rows[0].crops;
    }
  }
  const country = resolveAdvisoryCountry(message, countryHint || profile.country);
  return {
    country,
    region: countryHint || country !== profile.country ? undefined : profile.region,
    language,
    crops: farmerCrops,
  };
}

/**
 * Queues a farmer conversation's answer for agronomic review after the
 * response is sent, so the farmer never waits on it. Returns the trigger
 * when a review was scheduled, otherwise null.
 */
function scheduleAdvisoryReview(
  conversationId: string | null | undefined,
  createdBy: string,
  recommendation: string,
  trigger: ReviewTrigger | null,
): ReviewTrigger | null {
  if (!conversationId || !trigger) return null;
  setImmediate(() => {
    enqueueAdvisoryReview({ conversationId, createdBy, recommendation, trigger })
      .catch(error => logger.warn('Could not schedule AI recommendation review:', error));
  });
  return trigger;
}

export interface AdvisoryAnswerRequest {
  /** The question, already sanitized. */
  message: string;
  language?: string;
  country?: string;
  /** Thread whose recent history and farmer location give context. */
  contextConversationId?: string;
  /** Thread the answer is stored in and pushed to; undefined = not stored. */
  storeIn?: string;
  /** Store the question in `storeIn` under this role first (after history is read). */
  storeQuestionAs?: 'user' | 'officer';
  /** Who is asking: drives profile context, history scoping and review attribution. */
  requester: { userId: string; role: string; isDemo?: boolean };
  /** The caller already checked access to the thread (system jobs acting on it). */
  trustedHistory?: boolean;
  /** Appended to the answer, e.g. that the officer has been notified. */
  footer?: string;
  /** 'sms': the answer goes out by SMS, so it must be short plain text. */
  brevity?: 'sms';
}

export interface AdvisoryAnswer {
  text: string;
  citations: unknown[];
  evidence: ReturnType<typeof validateAdvisoryCitations>['evidence'];
  usedTools: string[];
  safety: ReturnType<typeof agronomicSafetyGuard.guardAndEnrichAdvice>['boundaryCheck'];
  reviewTrigger: ReviewTrigger | null;
  /** The stored answer's id, when it was stored. */
  storedMessageId: string | null;
}

const SMS_BREVITY =
  '\nThis answer is sent by SMS: reply in plain text (no markdown, no lists), in at most 300 characters. ' +
  'If more detail is needed, say the officer will follow up.';

export async function generateAdvisoryAnswer(req: AdvisoryAnswerRequest): Promise<AdvisoryAnswer> {
  const { requester } = req;
  const advisoryContext = await loadAdvisoryContext(
    requester.userId, req.message, req.contextConversationId, req.country, req.language
  );
  const [historyBlock, ragResult] = await Promise.all([
    loadHistoryBlock(req.contextConversationId, requester.userId, req.trustedHistory ? 'admin' : requester.role),
    retrieveAdvisoryEvidence(req.message, advisoryContext),
  ]);

  if (req.storeQuestionAs) await persistTurnMessage(req.storeIn, req.storeQuestionAs, req.message, req.language);

  const tools = requester.isDemo ? [] : buildToolDefinitions();
  const toolsClause = tools.length > 0
    ? ' You have access to specialized agricultural tools — call them when they can provide accurate, data-driven information; never claim to have used a tool you did not call.'
    : '';
  const brevityClause = req.brevity === 'sms' ? SMS_BREVITY : '';
  const systemPrompt = `${buildAdvisoryDirective(advisoryContext)}${toolsClause}${brevityClause}\n${historyBlock}${ragResult.context}`;

  const { text: assistantText, usedToolNames } = await runAssistantTurn(systemPrompt, req.message, tools);

  const { text: guardedText, boundaryCheck } = agronomicSafetyGuard.guardAndEnrichAdvice(assistantText, req.language);
  const validated = validateAdvisoryCitations(guardedText, ragResult.citations, req.language);
  const text = req.footer ? `${validated.answer}\n\n${req.footer}` : validated.answer;

  // Unsourced, mis-cited or safety-flagged advice in a farmer's thread goes to
  // the agronomic review queue; the answer itself is not held back.
  const trigger = reviewTriggerFor(validated.evidence, boundaryCheck.safe);
  const stored = await persistTurnMessage(req.storeIn, 'assistant', text, req.language, {
    metadata: answerSourceMetadata(ragResult.citations, validated.evidence, req.storeIn ? trigger : null),
  });
  const reviewTrigger = scheduleAdvisoryReview(req.storeIn, requester.userId, validated.answer, trigger);

  return {
    text,
    citations: ragResult.citations,
    evidence: validated.evidence,
    usedTools: usedToolNames,
    safety: boundaryCheck,
    reviewTrigger,
    storedMessageId: stored?.id ?? null,
  };
}
