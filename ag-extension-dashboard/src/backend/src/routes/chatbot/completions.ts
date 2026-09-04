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
  mapCountRow,
  mapSatisfactionAvgRow,
} from '@/types/dtos';
import { logger } from '@/utils/logger';
import { z } from 'zod';
import { validate } from '@/middleware/validate';
import { chatCompletionSchema } from '@/shared-api/chatbot';
import { parseToolArguments } from '@/services/aiProvider/toolCalling';
import { VectorService } from '@/services/vectorService';
import { safeError } from '@/utils/safeResponse';
import { authorize } from '@/middleware/authorize';
import { checkUsageLimit } from '@/middleware/usageMiddleware';
import { RAGV2Service } from '@/services/ragV2Service';
import { mcpAdapter } from '@/services/mcpAdapter';

const router = Router();

type AuthedRequest = Request & { user?: AuthenticatedRequestUser };

/** Load the last turns of a conversation as a context block (empty when none/unavailable). */
async function loadHistoryBlock(conversationId?: string): Promise<string> {
  if (!conversationId) return '';
  try {
    const { rows } = await query<ChatMessageRow>(
      `SELECT role, content FROM chat_messages
        WHERE conversation_id = $1
        ORDER BY created_at DESC LIMIT 10`,
      [conversationId]
    );
    const history = rows.reverse().map(m => `${m.role}: ${String(m.content).slice(0, 300)}`).join('\n');
    return history ? `\n\nRECENT CONVERSATION:\n${history}` : '';
  } catch (err) {
    logger.warn('Failed to load chat history for completions:', err);
    return '';
  }
}

/** Retrieve grounded knowledge-base context via RAG v2 enhanced search (empty on failure). */
interface CompletionCitation { sourceId: string; title: string; category: string; excerpt: string; score: number }

async function loadRagBlock(message: string): Promise<{ context: string; citations: CompletionCitation[] }> {
  try {
    let { results, citations } = await RAGV2Service.enhancedSearch(message, {
      limit: 3,
      useChunks: true,
      useGraph: true,
      useReranking: true,
    });
    // Chunk table can be empty (fresh deploy, embeddings still backfilling). Fall
    // back to article-level hybrid search rather than answering with no context.
    if (results.length === 0) {
      const fallback = await VectorService.hybridSearch(message, 3, undefined, 0.0);
      results = fallback.map(doc => {
        const title = typeof doc.metadata?.title === 'string' ? doc.metadata.title : 'Knowledge article';
        return {
          id: String(doc.id),
          articleId: String(doc.id),
          content: String(doc.content),
          metadata: doc.metadata,
          score: doc.score,
          citation: title,
        };
      });
      citations = fallback.map(doc => ({
        sourceId: String(doc.id),
        title: typeof doc.metadata?.title === 'string' ? doc.metadata.title : 'Knowledge article',
        category: typeof doc.metadata?.category === 'string' ? doc.metadata.category : 'general',
        excerpt: String(doc.content).slice(0, 200),
        score: doc.score,
      }));
    }
    if (results.length === 0) return { context: '', citations: [] };
    const snippets = results
      .map((doc, i) => {
        const title = typeof doc.metadata?.title === 'string' ? doc.metadata.title : 'Knowledge article';
        return `[${i + 1}] ${title}: ${String(doc.content).slice(0, 400)}`;
      })
      .join('\n');
    const citationList: CompletionCitation[] = citations.map(c => ({
      sourceId: c.sourceId,
      title: c.title,
      category: c.category,
      excerpt: c.excerpt,
      score: c.score,
    }));
    return {
      context: `\n\nKNOWLEDGE BASE CONTEXT (cite sources when used):\n${snippets}`,
      citations: citationList
    };
  } catch (err) {
    logger.warn('RAG v2 retrieval failed for chat completions, continuing without context:', err);
    return { context: '', citations: [] };
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
  mcpAdapter.convertToMCPTools().map((t: { name: string; description: string; inputSchema: Record<string, unknown> }) => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.inputSchema },
  }));

const MAX_TOOL_ROUNDS = 3;

type ToolCall = { id?: string; function: { name: string; arguments: unknown } };

const executeToolCalls = async (toolCalls: ToolCall[]): Promise<Array<{ call: ToolCall; output: string }>> => {
  const results: Array<{ call: ToolCall; output: string }> = [];
  for (const toolCall of toolCalls) {
    const args = parseToolArguments(toolCall.function.arguments);
    try {
      const toolResult = await mcpAdapter.callTool(toolCall.function.name, args);
      const text = toolResult.content.map(c => c.text).join('\n') || 'No output';
      results.push({ call: toolCall, output: toolResult.isError ? `ERROR: ${text}` : text });
    } catch (toolErr) {
      logger.error(`Tool ${toolCall.function.name} execution failed:`, toolErr);
      results.push({ call: toolCall, output: `ERROR: ${toolErr instanceof Error ? toolErr.message : String(toolErr)}` });
    }
  }
  return results;
};

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

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    const allowTools = tools.length > 0 && round < MAX_TOOL_ROUNDS;
    const response = await AIRouter.routeRequest('generate', {
      prompt: messages,
      options: {
        tools: allowTools ? tools : undefined,
        temperature: 0.2,
      },
    });

    assistantText = (response?.text ?? '').toString().trim();
    const toolCalls = (response?.toolCalls ?? []) as ToolCall[];
    if (toolCalls.length === 0 || !allowTools) break;

    // Echo the assistant's tool request, then one tool message per call.
    messages.push({
      role: 'assistant',
      content: assistantText || null,
      tool_calls: toolCalls.map((tc, i) => ({
        id: tc.id || `call_${round}_${i}`,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments ?? {}),
        },
      })),
    });
    const results = await executeToolCalls(toolCalls);
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

  return { text: assistantText || 'I am sorry, I could not generate a response.', usedToolNames: [...new Set(usedToolNames)] };
};

// Request contract = shared `chatCompletionSchema` (camelCase) + legacy `conversation_id`.
const completionsBodySchema = chatCompletionSchema
  .extend({ conversation_id: z.string().uuid().optional() })
  .transform(b => ({ ...b, conversationId: b.conversationId ?? b.conversation_id }));

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

    // Fetch context in parallel: history + RAG
    const [historyBlock, ragResult] = await Promise.all([
      loadHistoryBlock(body.conversation_id),
      loadRagBlock(sanitizedMessage),
    ]);

    // Persist user message
    await query(
      `INSERT INTO chat_messages (conversation_id, role, content, language)
       VALUES ($1, 'user', $2, $3)`,
      [body.conversation_id ?? null, sanitizedMessage, body.language ?? null]
    );

    const tools = buildToolDefinitions();
    const toolsClause = tools.length > 0
      ? ' You have access to specialized agricultural tools — call them when they can provide accurate, data-driven information; never claim to have used a tool you did not call.'
      : '';
    const systemPrompt = `You are an agricultural extension advisory assistant. Answer the farmer's or officer's message using the knowledge base context when relevant.${toolsClause} Be concise and actionable.${historyBlock}${ragResult.context}`;

    const { text: assistantText, usedToolNames } = await runAssistantTurn(systemPrompt, sanitizedMessage, tools);

    // Persist assistant message
    await query(
      `INSERT INTO chat_messages (conversation_id, role, content, language)
       VALUES ($1, 'assistant', $2, $3)`,
      [body.conversation_id ?? null, assistantText, body.language ?? null]
    );

    return res.json({
      success: true,
      data: {
        messages: [
          { role: 'user', content: sanitizedMessage },
          { role: 'assistant', content: assistantText },
        ],
        citations: ragResult.citations,
        usedTools: usedToolNames,
      },
    });
  } catch (error) {
    logger.error('Chat completion failed:', error);
    return safeError(res, 500, 'Chat completion failed');
  }
});

/**
 * GET /api/chatbot/stats/overview — 7-day conversation volume + average satisfaction.
 */
router.get('/stats/overview', authorize(['admin', 'regional_manager', 'extension_officer']), async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(503).json({ success: false, error: 'Database unavailable' });
    }

    const { rows: countRows } = await query<CountRow>(
      "SELECT COUNT(*) AS count FROM chat_conversations WHERE started_at > NOW() - INTERVAL '7 days'"
    );
    const { rows: satRows } = await query<SatisfactionAvgRow>(
      `SELECT AVG(satisfaction_score)::numeric(10,4) AS avg_satisfaction,
              COUNT(satisfaction_score)            AS total_ratings
         FROM chat_conversations
        WHERE satisfaction_score IS NOT NULL`
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
