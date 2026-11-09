import { Router, Request, Response } from 'express';
import { AIRouter } from '@/services/aiProvider/aiProvider';
import { query, getPool } from '@/services/databaseService';
import type {
  ChatMessageRow,
  CountRow,
  SatisfactionAvgRow,
  AuthenticatedRequestUser,
} from '@/types/rowTypes';
import {
  mapChatMessageRow,
  mapCountRow,
  mapSatisfactionAvgRow,
} from '@/types/dtos';
import { logger } from '@/utils/logger';
import { z } from 'zod';
import { validate } from '@/middleware/validate';
import { chatCompletionSchema } from '@/shared-api/chatbot';
import { safeError } from '@/utils/safeResponse';
import { authorize } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { retrieveAdvisoryEvidence } from '@/services/knowledge/advisoryRetrieval';
import { buildAdvisoryDirective, resolveAdvisoryCountry, validateAdvisoryCitations } from '@/services/knowledge/advisoryPolicy';
import { resolveUserContext } from '@/services/knowledge/userContext';
import { callAdvisoryTool, getAdvisoryTools } from '@/services/knowledge/advisoryTools';
import { AdvisoryTimeoutError, withAdvisoryTimeout } from '@/services/knowledge/advisoryRuntime';
import { agronomicSafetyGuard } from '@/services/security/agronomicSafetyGuard';
import { getRealtimeServer } from '@/services/realtimeHub';
import { assertConversationAccess, MessageAccessError, resolvePrincipalRegion } from '@/services/messageAccessService';

const router = Router();

type AuthedRequest = Request & { user?: AuthenticatedRequestUser };

/**
 * Load the last turns of a conversation as a context block (empty when
 * none/unavailable). The conversation must belong to the caller: farmers match
 * via their farmer record id or user id, officers via officer_id — the same
 * scoping the /conversations endpoints enforce. Without this check any
 * authenticated user could pass a foreign conversation_id and have another
 * user's messages injected into their prompt context (IDOR).
 */
async function loadHistoryBlock(conversationId: string | undefined, userId: string, role: string): Promise<string> {
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

async function canAccessConversation(conversationId: string, userId: string, role: string): Promise<boolean> {
  try {
    await assertConversationAccess({ userId, role }, conversationId);
    return true;
  } catch (error) {
    if (error instanceof MessageAccessError) return false;
    throw error;
  }
}

/**
 * POST /api/chatbot/completions — AI Assistant inference proxy with RAG, tools, and history.
 */
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

type ToolCall = { id?: string; function: { name: string; arguments: unknown } };

function fanoutMessage(conversationId: string, message: ChatMessageRow): void {
  try {
    getRealtimeServer()?.to(`conversation:${conversationId}`).emit('new_message', mapChatMessageRow(message));
  } catch {
    // Realtime delivery is best-effort; the persisted message remains authoritative.
  }
}

async function persistTurnMessage(conversationId: string | undefined, role: string, content: string, language?: string): Promise<void> {
  if (!conversationId) return;
  const { rows } = await query<ChatMessageRow>(
    `INSERT INTO chat_messages (conversation_id, role, content, language)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [conversationId, role, content, language ?? null]
  );
  if (rows[0]) fanoutMessage(conversationId, rows[0]);
}

const executeToolCalls = async (toolCalls: ToolCall[], deadline: number): Promise<Array<{ call: ToolCall; output: string }>> => {
  const results: Array<{ call: ToolCall; output: string }> = [];
  for (const toolCall of toolCalls) {
    try {
      const toolResult = await withAdvisoryTimeout(
        () => callAdvisoryTool(toolCall.function.name, toolCall.function.arguments),
        deadline - Date.now(), 'Chat tool execution'
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
    }), Math.min(ADVISORY_INFERENCE_TIMEOUT_MS, deadline - Date.now()), 'Chat inference');

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

// Request contract = shared `chatCompletionSchema` (camelCase) + legacy `conversation_id`.
const completionsBodySchema = chatCompletionSchema
  .extend({ conversation_id: z.string().uuid().optional(), country: z.string().trim().min(2).max(100).optional() })
  .transform(b => ({ ...b, conversationId: b.conversationId ?? b.conversation_id }));

async function loadAdvisoryContext(userId: string, message: string, conversationId?: string, countryHint?: string, language?: string) {
  const profile = await resolveUserContext(userId, message);
  if (conversationId) {
    const { rows } = await query<{ country: string | null; region: string | null }>(
      `SELECT f.country, f.region FROM chat_conversations cv
       JOIN farmers f ON f.id = cv.farmer_id WHERE cv.id = $1 LIMIT 1`,
      [conversationId]
    );
    if (rows[0]) {
      profile.country = rows[0].country ?? undefined;
      profile.region = rows[0].region ?? undefined;
    }
  }
  const country = resolveAdvisoryCountry(message, countryHint || profile.country);
  return {
    country,
    region: countryHint || country !== profile.country ? undefined : profile.region,
    language,
  };
}

router.post('/completions', authorize(['admin', 'regional_manager', 'extension_officer', 'farmer']), checkUsageLimit('ai_chat'), validate({ body: completionsBodySchema }), async (req: AuthedRequest, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const parsed = req.body as z.infer<typeof completionsBodySchema>;
    const body = { message: parsed.message, conversation_id: parsed.conversationId, language: parsed.language };
    const rawMessage = body.message?.trim();
    if (!rawMessage) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }
    // eslint-disable-next-line no-control-regex
    const sanitizedMessage = rawMessage.slice(0, 2000).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

    if (user.isDemo && body.conversation_id) {
      return res.status(403).json({ success: false, error: 'Demo chat is stateless; persistent conversations are unavailable' });
    }

    if (body.conversation_id && !(await canAccessConversation(body.conversation_id, user.userId, user.role))) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    // Fetch context in parallel: history + RAG
    const advisoryContext = await loadAdvisoryContext(
      user.userId, sanitizedMessage, body.conversation_id, parsed.country, body.language
    );
    const [historyBlock, ragResult] = await Promise.all([
      loadHistoryBlock(body.conversation_id, user.userId, user.role),
      retrieveAdvisoryEvidence(sanitizedMessage, advisoryContext),
    ]);

    // Standalone assistant requests (without a conversation) are not chat history.
    await persistTurnMessage(body.conversation_id, user.role === 'farmer' ? 'user' : 'officer', sanitizedMessage, body.language);

    const tools = user.isDemo ? [] : buildToolDefinitions();
    const toolsClause = tools.length > 0
      ? ' You have access to specialized agricultural tools — call them when they can provide accurate, data-driven information; never claim to have used a tool you did not call.'
      : '';
    const systemPrompt = `${buildAdvisoryDirective(advisoryContext)}${toolsClause}\n${historyBlock}${ragResult.context}`;

    const { text: assistantText, usedToolNames } = await runAssistantTurn(systemPrompt, sanitizedMessage, tools);

    // Guard and enrich agronomic advice
    const { text: guardedText, boundaryCheck } = agronomicSafetyGuard.guardAndEnrichAdvice(assistantText, body.language);
    const validated = validateAdvisoryCitations(guardedText, ragResult.citations, body.language);
    const safeAssistantText = validated.answer;

    await persistTurnMessage(body.conversation_id, 'assistant', safeAssistantText, body.language);

    return res.json({
      success: true,
      data: {
        messages: [
          { role: 'user', content: sanitizedMessage },
          { role: 'assistant', content: safeAssistantText },
        ],
        citations: ragResult.citations,
        advisoryQuality: validated.evidence,
        usedTools: usedToolNames,
        safety: boundaryCheck,
      },
    });
  } catch (error) {
    logger.error('Chat completion failed:', error);
    return safeError(res, error instanceof AdvisoryTimeoutError ? 503 : 500, 'Chat completion failed');
  }
});

/**
 * GET /api/chatbot/stats/overview — 7-day conversation volume + average satisfaction.
 */
router.get('/stats/overview', authorize(['admin', 'regional_manager', 'extension_officer']), async (req: AuthedRequest, res: Response) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database unavailable' });
    }

    const user = req.user!;
    let scopeClause = '';
    const scopeParams: string[] = [];
    if (user.role === 'regional_manager') {
      scopeParams.push((await resolvePrincipalRegion(user.userId)) ?? '');
    } else if (user.role === 'extension_officer') {
      scopeParams.push(user.userId);
    }
    if (user.role === 'regional_manager') {
      scopeClause = ' AND f.region = $1';
    } else if (user.role === 'extension_officer') {
      scopeClause = ' AND cv.officer_id = $1';
    }
    const joinFarmers = user.role === 'regional_manager'
      ? ' LEFT JOIN farmers f ON f.id = cv.farmer_id'
      : '';
    const { rows: countRows } = await query<CountRow>(
      `SELECT COUNT(*) AS count FROM chat_conversations cv${joinFarmers}
        WHERE cv.started_at > NOW() - INTERVAL '7 days'${scopeClause}`,
      scopeParams
    );
    const { rows: satRows } = await query<SatisfactionAvgRow>(
      `SELECT AVG(satisfaction_score)::numeric(10,4) AS avg_satisfaction,
              COUNT(satisfaction_score)            AS total_ratings
         FROM chat_conversations cv${joinFarmers}
        WHERE cv.satisfaction_score IS NOT NULL${scopeClause}`,
      scopeParams
    );

    const [conversations7d] = countRows.map(mapCountRow);
    const satisfaction = satRows[0] ? mapSatisfactionAvgRow(satRows[0]) : null;

    return res.json({
      success: true,
      data: {
        conversations7d: conversations7d?.count ?? 0,
        avgSatisfaction: satisfaction?.avgSatisfaction ?? null,
        totalRatings: satisfaction?.totalRatings ?? 0,
      },
    });
  } catch (error) {
    logger.error('Failed to compute chat stats:', error);
    return safeError(res, 500, 'Failed to compute chat stats');
  }
});

export default router;
